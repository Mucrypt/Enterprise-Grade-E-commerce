import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { getClient, query } from '../../../database/connection'
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
