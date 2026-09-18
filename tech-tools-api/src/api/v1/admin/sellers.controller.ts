import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { getClient, query } from '../../../database/connection'
import { getSellerEarningsSummary } from '../../../services/seller-payout.service'
import logger from '../../../utils/logger'

const VALID_TIERS = ['unverified', 'basic', 'trusted', 'pro']

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
      error: 'Seller verification is not enabled',
    })
    return false
  }

  const ready = await tableExists('seller_verification_requests')
  if (!ready) {
    res.status(503).json({
      success: false,
      error: 'Seller verification infrastructure is not ready yet',
    })
    return false
  }

  return true
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

export const getSellerVerificationQueue = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100)
    const offset = (page - 1) * limit
    const status = String(req.query.status || 'pending').toLowerCase()

    const allowed = ['pending', 'approved', 'rejected', 'suspended', 'none']
    const statusFilter = allowed.includes(status) ? status : 'pending'

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `SELECT svr.*, sp.display_name, sp.handle, sp.tier, sp.verification_status,
                u.email, u.first_name, u.last_name
         FROM seller_verification_requests svr
         INNER JOIN seller_profiles sp ON sp.id = svr.seller_profile_id
         INNER JOIN users u ON u.id = svr.user_id
         WHERE svr.status = $1
         ORDER BY svr.created_at ASC
         LIMIT $2 OFFSET $3`,
        [statusFilter, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM seller_verification_requests
         WHERE status = $1`,
        [statusFilter],
      ),
    ])

    return res.json({
      success: true,
      data: {
        items: itemsResult.rows,
        pagination: {
          page,
          limit,
          total: totalResult.rows[0]?.total || 0,
          totalPages: Math.ceil((totalResult.rows[0]?.total || 0) / limit),
        },
      },
    })
  } catch (error) {
    logger.error('Get seller verification queue error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get seller verification queue',
    })
  }
}

export const approveSellerVerificationRequest = async (
  req: AuthRequest,
  res: Response,
) => {
  const client = await getClient()

  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { requestId } = req.params
    const {
      adminNotes,
      decisionReason,
      phoneVerified,
      idVerified,
      paymentMethodVerified,
    } = req.body

    await client.query('BEGIN')

    const requestResult = await client.query(
      `SELECT svr.*, sp.tier AS current_tier, sp.verification_status AS current_status
       FROM seller_verification_requests svr
       INNER JOIN seller_profiles sp ON sp.id = svr.seller_profile_id
       WHERE svr.id = $1
       LIMIT 1`,
      [requestId],
    )

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: 'Verification request not found',
      })
    }

    const request = requestResult.rows[0]
    if (request.status !== 'pending') {
      await client.query('ROLLBACK')
      return res.status(409).json({
        success: false,
        error: 'Only pending requests can be approved',
      })
    }

    const tierConfigResult = await client.query(
      `SELECT max_active_listings, max_product_price
       FROM seller_tier_config
       WHERE tier = $1
       LIMIT 1`,
      [request.requested_tier],
    )

    const tierConfig = tierConfigResult.rows[0]
    if (!tierConfig) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        error: 'Requested tier configuration not found',
      })
    }

    const updatedRequest = await client.query(
      `UPDATE seller_verification_requests
       SET status = 'approved',
           reviewed_by_admin_id = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           admin_notes = COALESCE($2, admin_notes),
           admin_decision_reason = COALESCE($3, admin_decision_reason),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [adminId, adminNotes || null, decisionReason || null, requestId],
    )

    const updatedProfile = await client.query(
      `UPDATE seller_profiles
       SET tier = $1,
           verification_status = 'approved',
           max_active_listings = $2,
           max_product_price = $3,
           phone_verified = CASE WHEN $4 = true THEN true ELSE phone_verified END,
           id_verified = CASE WHEN $5 = true THEN true ELSE id_verified END,
           payment_method_verified = CASE WHEN $6 = true THEN true ELSE payment_method_verified END,
           verified_at = CURRENT_TIMESTAMP,
           verified_by_admin_id = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        request.requested_tier,
        tierConfig.max_active_listings,
        tierConfig.max_product_price,
        Boolean(phoneVerified),
        Boolean(idVerified),
        Boolean(paymentMethodVerified),
        adminId,
        request.seller_profile_id,
      ],
    )

    await client.query('COMMIT')

    await appendAuditLog({
      profileId: request.seller_profile_id,
      userId: request.user_id,
      actorId: adminId,
      action: 'seller_verification_approved',
      previousState: {
        tier: request.current_tier,
        verification_status: request.current_status,
      },
      newState: {
        tier: request.requested_tier,
        verification_status: 'approved',
      },
      details: {
        requestId,
        adminNotes: adminNotes || null,
      },
      req,
    })

    return res.json({
      success: true,
      data: {
        request: updatedRequest.rows[0],
        sellerProfile: updatedProfile.rows[0],
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Approve seller verification request error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to approve seller verification request',
    })
  } finally {
    client.release()
  }
}

export const rejectSellerVerificationRequest = async (
  req: AuthRequest,
  res: Response,
) => {
  const client = await getClient()

  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { requestId } = req.params
    const { adminNotes, decisionReason } = req.body

    await client.query('BEGIN')

    const requestResult = await client.query(
      `SELECT *
       FROM seller_verification_requests
       WHERE id = $1
       LIMIT 1`,
      [requestId],
    )

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: 'Verification request not found',
      })
    }

    const request = requestResult.rows[0]
    if (request.status !== 'pending') {
      await client.query('ROLLBACK')
      return res.status(409).json({
        success: false,
        error: 'Only pending requests can be rejected',
      })
    }

    const updatedRequest = await client.query(
      `UPDATE seller_verification_requests
       SET status = 'rejected',
           reviewed_by_admin_id = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           admin_notes = COALESCE($2, admin_notes),
           admin_decision_reason = COALESCE($3, admin_decision_reason),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [adminId, adminNotes || null, decisionReason || null, requestId],
    )

    const updatedProfile = await client.query(
      `UPDATE seller_profiles
       SET verification_status = 'rejected',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [request.seller_profile_id],
    )

    await client.query('COMMIT')

    await appendAuditLog({
      profileId: request.seller_profile_id,
      userId: request.user_id,
      actorId: adminId,
      action: 'seller_verification_rejected',
      previousState: {
        verification_status: 'pending',
      },
      newState: {
        verification_status: 'rejected',
      },
      details: {
        requestId,
        adminNotes: adminNotes || null,
      },
      req,
    })

    return res.json({
      success: true,
      data: {
        request: updatedRequest.rows[0],
        sellerProfile: updatedProfile.rows[0],
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Reject seller verification request error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to reject seller verification request',
    })
  } finally {
    client.release()
  }
}

export const suspendSellerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { sellerProfileId } = req.params
    const { suspensionReason } = req.body

    const current = await query(
      'SELECT * FROM seller_profiles WHERE id = $1 LIMIT 1',
      [sellerProfileId],
    )

    if (current.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Seller profile not found',
      })
    }

    const updated = await query(
      `UPDATE seller_profiles
       SET is_suspended = true,
           is_active = false,
           verification_status = 'suspended',
           suspension_reason = COALESCE($1, suspension_reason),
           suspended_at = CURRENT_TIMESTAMP,
           suspended_by_admin_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [suspensionReason || null, adminId, sellerProfileId],
    )

    await appendAuditLog({
      profileId: sellerProfileId,
      userId: updated.rows[0].user_id,
      actorId: adminId,
      action: 'seller_suspended',
      previousState: current.rows[0],
      newState: updated.rows[0],
      details: {
        suspensionReason: suspensionReason || null,
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
    logger.error('Suspend seller profile error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to suspend seller profile',
    })
  }
}

export const setSellerCreatorAccess = async (
  req: AuthRequest,
  res: Response,
) => {
  const client = await getClient()

  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { sellerProfileId } = req.params
    const { accessEnabled, reason } = req.body as {
      accessEnabled: boolean
      reason?: string
    }

    await client.query('BEGIN')

    const currentResult = await client.query(
      `SELECT sp.*, u.is_business_account, u.business_mode_activated_at
       FROM seller_profiles sp
       INNER JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1
       LIMIT 1`,
      [sellerProfileId],
    )

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: 'Seller profile not found',
      })
    }

    const current = currentResult.rows[0]

    if (Boolean(accessEnabled) && current.is_suspended) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        success: false,
        error: 'Cannot grant creator access while seller profile is suspended',
      })
    }

    if (Boolean(accessEnabled) && !current.is_business_account) {
      await client.query(
        `UPDATE users
         SET is_business_account = true,
             business_mode_activated_at = COALESCE(business_mode_activated_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [current.user_id],
      )
    }

    const updatedProfileResult = await client.query(
      `UPDATE seller_profiles
       SET verification_status = $1,
           is_active = CASE WHEN $2 = true THEN true ELSE is_active END,
           is_suspended = CASE WHEN $2 = true THEN false ELSE is_suspended END,
           suspension_reason = CASE WHEN $2 = true THEN NULL ELSE suspension_reason END,
           suspended_at = CASE WHEN $2 = true THEN NULL ELSE suspended_at END,
           suspended_by_admin_id = CASE WHEN $2 = true THEN NULL ELSE suspended_by_admin_id END,
           verified_at = CASE
             WHEN $2 = true THEN COALESCE(verified_at, CURRENT_TIMESTAMP)
             ELSE verified_at
           END,
           verified_by_admin_id = CASE
             WHEN $2 = true THEN COALESCE(verified_by_admin_id, $3)
             ELSE verified_by_admin_id
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        accessEnabled ? 'approved' : 'none',
        Boolean(accessEnabled),
        adminId,
        sellerProfileId,
      ],
    )

    await client.query('COMMIT')

    const updatedProfile = updatedProfileResult.rows[0]

    await appendAuditLog({
      profileId: sellerProfileId,
      userId: updatedProfile.user_id,
      actorId: adminId,
      action: accessEnabled
        ? 'creator_dashboard_access_granted'
        : 'creator_dashboard_access_revoked',
      previousState: {
        verification_status: current.verification_status,
        is_suspended: current.is_suspended,
        is_business_account: current.is_business_account,
      },
      newState: {
        verification_status: updatedProfile.verification_status,
        is_suspended: updatedProfile.is_suspended,
      },
      details: {
        reason: reason || null,
      },
      req,
    })

    return res.json({
      success: true,
      data: {
        sellerProfile: updatedProfile,
        creatorAccess: {
          enabled: accessEnabled,
          updatedBy: adminId,
        },
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Set seller creator access error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update creator dashboard access',
    })
  } finally {
    client.release()
  }
}

// ============================================
// General seller management -- list/detail/grant/tier/reactivate.
// Distinct from the verification-queue flow above: these act on the
// full seller population, not just self-filed requests.
// ============================================

export const getAllSellers = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100)
    const offset = (page - 1) * limit
    const tier = String(req.query.tier || '').toLowerCase()
    const status = String(req.query.status || '').toLowerCase()
    const suspended = req.query.suspended
    const search = String(req.query.search || '').trim()

    const conditions: string[] = []
    const params: unknown[] = []

    if (VALID_TIERS.includes(tier)) {
      params.push(tier)
      conditions.push(`sp.tier = $${params.length}`)
    }
    if (['none', 'pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      params.push(status)
      conditions.push(`sp.verification_status = $${params.length}`)
    }
    if (suspended === 'true' || suspended === 'false') {
      params.push(suspended === 'true')
      conditions.push(`sp.is_suspended = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      const idx = params.length
      conditions.push(
        `(sp.display_name ILIKE $${idx} OR sp.handle ILIKE $${idx} OR u.email ILIKE $${idx} OR u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx})`,
      )
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `SELECT sp.*, u.email, u.first_name, u.last_name
         FROM seller_profiles sp
         INNER JOIN users u ON u.id = sp.user_id
         ${whereClause}
         ORDER BY sp.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM seller_profiles sp
         INNER JOIN users u ON u.id = sp.user_id
         ${whereClause}`,
        params,
      ),
    ])

    return res.json({
      success: true,
      data: {
        items: itemsResult.rows,
        pagination: {
          page,
          limit,
          total: totalResult.rows[0]?.total || 0,
          totalPages: Math.ceil((totalResult.rows[0]?.total || 0) / limit),
        },
      },
    })
  } catch (error) {
    logger.error('Get all sellers error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to load sellers',
    })
  }
}

export const getSellerDetail = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const { sellerProfileId } = req.params

    const profileResult = await query(
      `SELECT sp.*, u.email, u.first_name, u.last_name, u.is_business_account
       FROM seller_profiles sp
       INNER JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1
       LIMIT 1`,
      [sellerProfileId],
    )

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Seller profile not found',
      })
    }

    const profile = profileResult.rows[0]

    const [requestsResult, storeProductCountResult, discoverPostCountResult, earningsSummary] =
      await Promise.all([
        query(
          `SELECT * FROM seller_verification_requests
           WHERE seller_profile_id = $1
           ORDER BY created_at DESC`,
          [sellerProfileId],
        ),
        query(
          `SELECT COUNT(*)::int AS count FROM products WHERE seller_profile_id = $1`,
          [sellerProfileId],
        ).catch(() => ({ rows: [{ count: 0 }] })),
        query(
          `SELECT COUNT(*)::int AS count FROM discover_posts WHERE seller_profile_id = $1`,
          [sellerProfileId],
        ).catch(() => ({ rows: [{ count: 0 }] })),
        getSellerEarningsSummary(sellerProfileId).catch(() => null),
      ])

    return res.json({
      success: true,
      data: {
        sellerProfile: profile,
        verificationRequests: requestsResult.rows,
        storeProductCount: storeProductCountResult.rows[0]?.count || 0,
        discoverPostCount: discoverPostCountResult.rows[0]?.count || 0,
        earningsSummary,
      },
    })
  } catch (error) {
    logger.error('Get seller detail error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to load seller detail',
    })
  }
}

export const grantSellerAccess = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { userId, tier } = req.body as { userId: string; tier?: string }
    const targetTier = VALID_TIERS.includes(String(tier)) ? String(tier) : 'unverified'

    const userResult = await query(
      `SELECT id, email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    )
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const existing = await query(
      `SELECT id FROM seller_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'This user already has a seller profile',
      })
    }

    const tierConfigResult = await query(
      `SELECT max_active_listings, max_product_price
       FROM seller_tier_config WHERE tier = $1 LIMIT 1`,
      [targetTier],
    )
    const tierConfig = tierConfigResult.rows[0]
    if (!tierConfig) {
      return res.status(400).json({
        success: false,
        error: 'Tier configuration not found',
      })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      await client.query(
        `UPDATE users
         SET is_business_account = true,
             business_mode_activated_at = COALESCE(business_mode_activated_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId],
      )

      const insertedResult = await client.query(
        `INSERT INTO seller_profiles (
          user_id, tier, verification_status,
          max_active_listings, max_product_price,
          terms_accepted, terms_accepted_at,
          verified_at, verified_by_admin_id
        )
        VALUES (
          $1, $2, 'approved',
          $3, $4,
          true, CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP, $5
        )
        RETURNING *`,
        [userId, targetTier, tierConfig.max_active_listings, tierConfig.max_product_price, adminId],
      )

      await client.query('COMMIT')

      const inserted = insertedResult.rows[0]

      await appendAuditLog({
        profileId: inserted.id,
        userId,
        actorId: adminId,
        action: 'seller_granted_by_admin',
        previousState: null,
        newState: { tier: targetTier, verification_status: 'approved' },
        req,
      })

      return res.status(201).json({
        success: true,
        data: { sellerProfile: inserted },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    logger.error('Grant seller access error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to grant seller access',
    })
  }
}

export const setSellerTier = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { sellerProfileId } = req.params
    const { tier } = req.body as { tier: string }

    if (!VALID_TIERS.includes(tier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier',
      })
    }

    const current = await query(
      `SELECT * FROM seller_profiles WHERE id = $1 LIMIT 1`,
      [sellerProfileId],
    )
    if (current.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Seller profile not found',
      })
    }

    const tierConfigResult = await query(
      `SELECT max_active_listings, max_product_price
       FROM seller_tier_config WHERE tier = $1 LIMIT 1`,
      [tier],
    )
    const tierConfig = tierConfigResult.rows[0]
    if (!tierConfig) {
      return res.status(400).json({
        success: false,
        error: 'Tier configuration not found',
      })
    }

    const updated = await query(
      `UPDATE seller_profiles
       SET tier = $1,
           max_active_listings = $2,
           max_product_price = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [tier, tierConfig.max_active_listings, tierConfig.max_product_price, sellerProfileId],
    )

    await appendAuditLog({
      profileId: sellerProfileId,
      userId: current.rows[0].user_id,
      actorId: adminId,
      action: 'seller_tier_changed_by_admin',
      previousState: { tier: current.rows[0].tier },
      newState: { tier },
      req,
    })

    return res.json({
      success: true,
      data: { sellerProfile: updated.rows[0] },
    })
  } catch (error) {
    logger.error('Set seller tier error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update seller tier',
    })
  }
}

export const reactivateSellerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { sellerProfileId } = req.params

    const current = await query(
      `SELECT * FROM seller_profiles WHERE id = $1 LIMIT 1`,
      [sellerProfileId],
    )
    if (current.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Seller profile not found',
      })
    }
    if (!current.rows[0].is_suspended) {
      return res.status(409).json({
        success: false,
        error: 'Seller profile is not suspended',
      })
    }

    const updated = await query(
      `UPDATE seller_profiles
       SET is_suspended = false,
           is_active = true,
           verification_status = 'approved',
           suspension_reason = NULL,
           suspended_at = NULL,
           suspended_by_admin_id = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [sellerProfileId],
    )

    await appendAuditLog({
      profileId: sellerProfileId,
      userId: current.rows[0].user_id,
      actorId: adminId,
      action: 'seller_reactivated_by_admin',
      previousState: current.rows[0],
      newState: updated.rows[0],
      req,
    })

    return res.json({
      success: true,
      data: { sellerProfile: updated.rows[0] },
    })
  } catch (error) {
    logger.error('Reactivate seller profile error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to reactivate seller profile',
    })
  }
}
