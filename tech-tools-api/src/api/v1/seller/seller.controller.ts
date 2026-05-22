import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

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

const canBecomeSeller = (userType: string, isBusinessAccount: boolean) => {
  if (isBusinessAccount) {
    return true
  }

  return ['creator', 'admin', 'super_admin'].includes(userType)
}

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
    } = req.body

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
    if (!canBecomeSeller(user.user_type, Boolean(user.is_business_account))) {
      return res.status(403).json({
        success: false,
        error: 'Switch to business mode before onboarding as seller',
      })
    }

    const existing = await query(
      'SELECT * FROM seller_profiles WHERE user_id = $1 LIMIT 1',
      [userId],
    )

    const current = existing.rows[0]

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
          tier, verification_status,
          max_active_listings, max_product_price,
          terms_accepted, terms_accepted_at, metadata
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          'unverified', 'none',
          $7, $8,
          true, CURRENT_TIMESTAMP, $9::jsonb
        )
        RETURNING *`,
        [
          userId,
          displayName || null,
          handle || null,
          bio || null,
          avatarUrl || null,
          bannerUrl || null,
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
           terms_accepted = CASE WHEN $7 = true THEN true ELSE terms_accepted END,
           terms_accepted_at = CASE
             WHEN $7 = true AND terms_accepted_at IS NULL THEN CURRENT_TIMESTAMP
             ELSE terms_accepted_at
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $8
       RETURNING *`,
      [
        displayName || null,
        handle || null,
        bio || null,
        avatarUrl || null,
        bannerUrl || null,
        metadata ? JSON.stringify(metadata) : null,
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

    const { requestedTier = 'basic', documentsSubmitted, notes } = req.body

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
    if (profile.is_suspended) {
      return res.status(403).json({
        success: false,
        error: 'Seller account is suspended',
      })
    }

    if (profile.tier === requestedTier) {
      return res.status(409).json({
        success: false,
        error: `You are already on ${requestedTier} tier`,
      })
    }

    const pending = await query(
      `SELECT id
       FROM seller_verification_requests
       WHERE user_id = $1
         AND status = 'pending'
       LIMIT 1`,
      [userId],
    )

    if (pending.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'You already have a pending verification request',
      })
    }

    const inserted = await query(
      `INSERT INTO seller_verification_requests (
        user_id,
        seller_profile_id,
        requested_tier,
        status,
        documents_submitted,
        notes
      )
      VALUES ($1, $2, $3, 'pending', $4::jsonb, $5)
      RETURNING *`,
      [
        userId,
        profile.id,
        requestedTier,
        documentsSubmitted ? JSON.stringify(documentsSubmitted) : null,
        notes || null,
      ],
    )

    await query(
      `UPDATE seller_profiles
       SET verification_status = 'pending',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [profile.id],
    )

    await appendAuditLog({
      profileId: profile.id,
      userId,
      actorId: userId,
      action: 'seller_verification_requested',
      previousState: profile,
      newState: {
        verification_status: 'pending',
        requested_tier: requestedTier,
      },
      details: {
        requestId: inserted.rows[0].id,
      },
      req,
    })

    return res.status(201).json({
      success: true,
      data: {
        request: inserted.rows[0],
      },
    })
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
