import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  ensureBusinessModeActivated,
  ensureCreatorProfileForUser,
} from '../../../services/account-mode-reconciliation.service'
import { submitSellerApplication, IllegalTransitionError } from '../../../services/seller-lifecycle.service'

const VALID_SELLER_TYPES = ['individual', 'registered_business']

const isSellerSystemEnabled = () =>
  String(process.env.ENABLE_SELLER_TIERS || 'false').toLowerCase() === 'true'

const tableExists = async (tableName: string) => {
  const result = await query(`SELECT to_regclass($1) AS regclass`, [
    `public.${tableName}`,
  ])

  return Boolean(result.rows[0]?.regclass)
}

const ensureSellerInfrastructure = async (res: Response) => {
  if (!isSellerSystemEnabled()) {
    res.status(404).json({
      success: false,
      error: 'Seller onboarding is not enabled',
    })
    return false
  }

  const ready = await tableExists('seller_profiles')
  if (!ready) {
    res.status(503).json({
      success: false,
      error: 'Seller infrastructure is not ready yet',
    })
    return false
  }

  return true
}

// Onboarding is now the entry point itself (see onboardSeller below) --
// it auto-activates business mode for whoever starts it, so there is no
// longer a real precondition that can make a customer ineligible.
// Previously this checked `userType === 'creator'`, a value
// `users.user_type`'s CHECK constraints have never actually allowed --
// that branch was dead code. Kept as a named function (rather than
// inlining `true`) so a real future restriction (e.g. a banned user)
// has one place to land.
const canBecomeSeller = (_userType: string, _isBusinessAccount: boolean) => true

const getTierConfig = async (tier: string) => {
  const result = await query(
    `SELECT tier, max_active_listings, max_product_price, commission_rate,
            requires_phone_verification, requires_id_verification,
            requires_payment_method, requires_admin_approval,
            buyer_protection_level, description
     FROM seller_tier_config
     WHERE tier = $1
     LIMIT 1`,
    [tier],
  )

  return result.rows[0] || null
}

const appendAuditLog = async (options: {
  profileId: string
  userId: string
  actorId?: string | null
  action: string
  previousState?: Record<string, unknown> | null
  newState?: Record<string, unknown> | null
  details?: Record<string, unknown> | null
  req: AuthRequest
}) => {
  try {
    await query(
      `INSERT INTO seller_audit_log
        (seller_profile_id, user_id, actor_id, action, previous_state, new_state, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)`,
      [
        options.profileId,
        options.userId,
        options.actorId || null,
        options.action,
        options.previousState ? JSON.stringify(options.previousState) : null,
        options.newState ? JSON.stringify(options.newState) : null,
        options.details ? JSON.stringify(options.details) : null,
        options.req.ip || null,
        options.req.headers['user-agent'] || null,
      ],
    )
  } catch (error) {
    logger.warn('Failed to append seller audit log', error)
  }
}

export const getSellerTierConfig = async (_req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const result = await query(
      `SELECT tier, max_active_listings, max_product_price, commission_rate,
              requires_phone_verification, requires_id_verification,
              requires_payment_method, requires_admin_approval,
              buyer_protection_level, description
       FROM seller_tier_config
       ORDER BY CASE tier
         WHEN 'unverified' THEN 1
         WHEN 'basic' THEN 2
         WHEN 'trusted' THEN 3
         WHEN 'pro' THEN 4
         ELSE 5
       END`,
    )

    return res.json({
      success: true,
      data: {
        tiers: result.rows,
      },
    })
  } catch (error) {
    logger.error('Get seller tier config error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get seller tier config',
    })
  }
}

export const getMySellerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const result = await query(
      `SELECT sp.*, u.user_type, u.is_business_account
       FROM seller_profiles sp
       INNER JOIN users u ON u.id = sp.user_id
       WHERE sp.user_id = $1
       LIMIT 1`,
      [userId],
    )

    if (result.rows.length === 0) {
      const userResult = await query(
        'SELECT id, user_type, is_business_account FROM users WHERE id = $1 LIMIT 1',
        [userId],
      )

      const user = userResult.rows[0]
      const eligible = user
        ? canBecomeSeller(user.user_type, Boolean(user.is_business_account))
        : false

      return res.json({
        success: true,
        data: {
          sellerProfile: null,
          eligible,
        },
      })
    }

    return res.json({
      success: true,
      data: {
        sellerProfile: result.rows[0],
        eligible: true,
      },
    })
  } catch (error) {
    logger.error('Get my seller profile error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get seller profile',
    })
  }
}

export const onboardSeller = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const {
      displayName,
      handle,
      bio,
      avatarUrl,
      bannerUrl,
      metadata,
      source,
      termsAccepted,
      sellerType,
      sellerTypeDetails,
    } = req.body

    if (sellerType && !VALID_SELLER_TYPES.includes(sellerType)) {
      return res.status(400).json({
        success: false,
        error: `sellerType must be one of: ${VALID_SELLER_TYPES.join(', ')}`,
      })
    }

    const userResult = await query(
      `SELECT id, user_type, is_business_account
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = userResult.rows[0]

    // Onboarding is now the entry point, not a second step gated behind
    // a separate "activate business mode" click -- a customer starting
    // onboarding IS the business-mode-activation event. This closes the
    // gap where a user could end up with is_business_account=true and a
    // creator_profiles row but no seller_profiles row (or vice versa)
    // depending on which endpoint they happened to call first.
    if (!user.is_business_account) {
      await ensureBusinessModeActivated({
        userId,
        source: source || 'seller_onboarding',
        actor: { actorId: userId, ip: req.ip, userAgent: req.headers['user-agent'] as string },
      })
      await ensureCreatorProfileForUser({ userId, handle, displayName })
    }

    const existing = await query(
      'SELECT * FROM seller_profiles WHERE user_id = $1 LIMIT 1',
      [userId],
    )

    const current = existing.rows[0]

    if (current && ['SUBMITTED', 'COMPLETED'].includes(current.onboarding_status) && current.account_status !== 'ACTIVE') {
      return res.status(409).json({
        success: false,
        error: 'Your application has already been submitted and cannot be edited while under review',
      })
    }

    if (!current && !termsAccepted) {
      return res.status(400).json({
        success: false,
        error: 'You must accept seller terms before onboarding',
      })
    }

    if (handle) {
      const handleExists = await query(
        `SELECT id
         FROM seller_profiles
         WHERE handle = $1
           AND user_id <> $2
         LIMIT 1`,
        [handle, userId],
      )

      if (handleExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Handle is already in use',
        })
      }
    }

    const unverifiedConfig = await getTierConfig('unverified')

    if (!current) {
      const inserted = await query(
        `INSERT INTO seller_profiles (
          user_id, display_name, handle, bio, avatar_url, banner_url,
          tier, verification_status, account_status, onboarding_status, store_status,
          seller_type, seller_type_details,
          max_active_listings, max_product_price,
          terms_accepted, terms_accepted_at, metadata
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          'unverified', 'NOT_STARTED', 'DRAFT', 'IN_PROGRESS', 'DRAFT',
          $7, $8::jsonb,
          $9, $10,
          true, CURRENT_TIMESTAMP, $11::jsonb
        )
        RETURNING *`,
        [
          userId,
          displayName || null,
          handle || null,
          bio || null,
          avatarUrl || null,
          bannerUrl || null,
          sellerType || null,
          sellerTypeDetails ? JSON.stringify(sellerTypeDetails) : null,
          unverifiedConfig?.max_active_listings || 5,
          unverifiedConfig?.max_product_price || 99.99,
          metadata ? JSON.stringify(metadata) : null,
        ],
      )

      await appendAuditLog({
        profileId: inserted.rows[0].id,
        userId,
        actorId: userId,
        action: 'seller_onboarded',
        newState: inserted.rows[0],
        details: {
          source: source || 'self_service',
        },
        req,
      })

      return res.status(201).json({
        success: true,
        data: {
          sellerProfile: inserted.rows[0],
        },
      })
    }

    const updated = await query(
      `UPDATE seller_profiles
       SET display_name = COALESCE($1, display_name),
           handle = COALESCE($2, handle),
           bio = COALESCE($3, bio),
           avatar_url = COALESCE($4, avatar_url),
           banner_url = COALESCE($5, banner_url),
           metadata = COALESCE($6::jsonb, metadata),
           seller_type = COALESCE($7, seller_type),
           seller_type_details = COALESCE($8::jsonb, seller_type_details),
           terms_accepted = CASE WHEN $9 = true THEN true ELSE terms_accepted END,
           terms_accepted_at = CASE
             WHEN $9 = true AND terms_accepted_at IS NULL THEN CURRENT_TIMESTAMP
             ELSE terms_accepted_at
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $10
       RETURNING *`,
      [
        displayName || null,
        handle || null,
        bio || null,
        avatarUrl || null,
        bannerUrl || null,
        metadata ? JSON.stringify(metadata) : null,
        sellerType || null,
        sellerTypeDetails ? JSON.stringify(sellerTypeDetails) : null,
        Boolean(termsAccepted),
        userId,
      ],
    )

    await appendAuditLog({
      profileId: updated.rows[0].id,
      userId,
      actorId: userId,
      action: 'seller_profile_updated',
      previousState: current,
      newState: updated.rows[0],
      details: {
        source: source || 'self_service',
      },
      req,
    })

    return res.json({
      success: true,
      data: {
        sellerProfile: updated.rows[0],
      },
    })
  } catch (error) {
    logger.error('Seller onboarding error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to onboard seller',
    })
  }
}

export const requestSellerVerification = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { requestedTier = 'basic' } = req.body

    if (!['basic', 'trusted', 'pro'].includes(requestedTier)) {
      return res.status(400).json({
        success: false,
        error: 'requestedTier must be basic, trusted, or pro',
      })
    }

    const profileResult = await query(
      'SELECT * FROM seller_profiles WHERE user_id = $1 LIMIT 1',
      [userId],
    )

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Complete seller onboarding first',
      })
    }

    const profile = profileResult.rows[0]
    if (profile.is_suspended || profile.account_status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: 'Seller account is suspended',
      })
    }

    if (profile.account_status === 'ACTIVE' && profile.tier === requestedTier) {
      return res.status(409).json({
        success: false,
        error: `You are already on ${requestedTier} tier`,
      })
    }

    try {
      const result = await submitSellerApplication({
        sellerProfileId: profile.id,
        actor: { actorId: userId, ip: req.ip, userAgent: req.headers['user-agent'] as string },
        requestedTier,
      })

      return res.status(result.noop ? 200 : 201).json({
        success: true,
        data: { request: result.verificationRequest },
      })
    } catch (error) {
      if (error instanceof IllegalTransitionError) {
        return res.status(409).json({ success: false, error: error.message })
      }
      throw error
    }
  } catch (error) {
    logger.error('Request seller verification error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to request seller verification',
    })
  }
}

export const getMySellerVerificationRequests = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const result = await query(
      `SELECT *
       FROM seller_verification_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    )

    return res.json({
      success: true,
      data: {
        requests: result.rows,
      },
    })
  } catch (error) {
    logger.error('Get seller verification requests error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get seller verification requests',
    })
  }
}

// =====================================================
// PUBLIC SELLER PROFILE -- the storefront-facing page for an approved
// seller's own brand (real follower count via seller_follows, mirroring
// brand_follows exactly; real approved-only post count, never a
// fabricated number). Unapproved/suspended sellers 404 here even if the
// row exists -- there's nothing public to show for a profile that isn't
// live yet.
// =====================================================

export const getPublicSellerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const { handle } = req.params
    const viewerId = req.user?.userId

    const result = await query(
      `SELECT sp.id, sp.display_name, sp.handle, sp.bio, sp.avatar_url, sp.banner_url, sp.created_at,
              (SELECT COUNT(*) FROM seller_follows sf WHERE sf.seller_profile_id = sp.id) as follower_count,
              (SELECT COUNT(*) FROM discover_posts dp WHERE dp.seller_profile_id = sp.id AND dp.is_active = TRUE) as post_count
              ${viewerId ? ', EXISTS(SELECT 1 FROM seller_follows sf2 WHERE sf2.seller_profile_id = sp.id AND sf2.user_id = $2) as is_following' : ''}
       FROM seller_profiles sp
       WHERE sp.handle = $1 AND sp.account_status = 'ACTIVE'
       LIMIT 1`,
      viewerId ? [handle, viewerId] : [handle],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seller not found' })
    }

    const seller = result.rows[0]
    return res.json({
      success: true,
      data: {
        ...seller,
        followerCount: parseInt(seller.follower_count, 10),
        postCount: parseInt(seller.post_count, 10),
        isFollowing: seller.is_following ?? false,
      },
    })
  } catch (error) {
    logger.error('Get public seller profile error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get seller profile' })
  }
}

export const followSeller = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { id } = req.params

    await query(
      `INSERT INTO seller_follows (user_id, seller_profile_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, seller_profile_id) DO NOTHING`,
      [userId, id],
    )

    res.json({ success: true, message: 'Following seller' })
  } catch (error) {
    logger.error('Follow seller error:', error)
    res.status(500).json({ success: false, error: 'Failed to follow seller' })
  }
}

export const unfollowSeller = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { id } = req.params

    await query('DELETE FROM seller_follows WHERE user_id = $1 AND seller_profile_id = $2', [userId, id])

    res.json({ success: true, message: 'Unfollowed seller' })
  } catch (error) {
    logger.error('Unfollow seller error:', error)
    res.status(500).json({ success: false, error: 'Failed to unfollow seller' })
  }
}
