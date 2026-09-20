import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import { getSellerEarningsSummary } from '../../../services/seller-payout.service'
import logger from '../../../utils/logger'
import {
  approveVerification,
  rejectVerification,
  requestMoreInformation,
  expireVerification,
  setSellerTier as setSellerTierTransition,
  grantSellerAccess as grantSellerAccessTransition,
  suspendSellerAccount,
  restrictSellerAccount,
  reactivateSellerAccount,
  closeSellerAccount,
  setSellerAccountStatus,
  setStoreStatus,
  IllegalTransitionError,
  SelfApprovalError,
  NotFoundError,
  type TransitionActor,
  type SellerStoreStatus,
} from '../../../services/seller-lifecycle.service'
import {
  listCurrentSellerDocuments,
  getSellerDocumentForDownload,
  applySecureDocumentDownloadHeaders,
  reviewSellerDocument as reviewSellerDocumentService,
} from '../../../services/seller-documents.service'

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

const actorFrom = (req: AuthRequest): TransitionActor => ({
  actorId: req.user?.userId || null,
  ip: req.ip || null,
  userAgent: (req.headers['user-agent'] as string) || null,
})

const mapTransitionError = (res: Response, error: unknown, fallbackMessage: string) => {
  if (error instanceof NotFoundError) {
    return res.status(404).json({ success: false, error: error.message })
  }
  if (error instanceof SelfApprovalError) {
    return res.status(403).json({ success: false, error: error.message })
  }
  if (error instanceof IllegalTransitionError) {
    return res.status(409).json({ success: false, error: error.message })
  }
  if (error instanceof Error && /reason is required/i.test(error.message)) {
    return res.status(400).json({ success: false, error: error.message })
  }
  logger.error(fallbackMessage, error)
  return res.status(500).json({ success: false, error: fallbackMessage })
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
    // Query param stays lowercase for backward compatibility with the
    // existing admin-dashboard filter dropdown (still sends
    // pending/approved/rejected/suspended/none, values that predate the
    // profile-vs-case enum split below) -- mapped to the new dedicated
    // seller_verification_case_status values before touching the DB.
    // 'suspended'/'none' were never real case states (only ever a
    // profile concept) and fall back to 'pending', same graceful
    // degradation as an unrecognized value always had.
    const rawStatus = String(req.query.status || 'pending').toLowerCase()
    const caseStatusMap: Record<string, string> = {
      pending: 'PENDING',
      approved: 'APPROVED',
      rejected: 'REJECTED',
      more_information_required: 'MORE_INFORMATION_REQUIRED',
      expired: 'EXPIRED',
      superseded: 'SUPERSEDED',
    }
    const statusFilter = caseStatusMap[rawStatus] || 'PENDING'

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `SELECT svr.*, sp.display_name, sp.handle, sp.tier, sp.verification_status, sp.account_status,
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
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { requestId } = req.params
    const { decisionReason, phoneVerified, paymentMethodVerified, grantedTier } = req.body

    const result = await approveVerification({
      requestId,
      actor: actorFrom(req),
      grantedTier: VALID_TIERS.includes(grantedTier) ? grantedTier : undefined,
      reason: decisionReason,
      markPhoneVerified: Boolean(phoneVerified),
      markPaymentMethodVerified: Boolean(paymentMethodVerified),
    })

    return res.json({
      success: true,
      data: {
        request: result.verificationRequest,
        sellerProfile: result.sellerProfile,
        noop: result.noop,
      },
    })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to approve seller verification request')
  }
}

export const rejectSellerVerificationRequest = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { requestId } = req.params
    const { decisionReason } = req.body

    if (!decisionReason || !String(decisionReason).trim()) {
      return res.status(400).json({ success: false, error: 'decisionReason is required' })
    }

    const result = await rejectVerification({
      requestId,
      actor: actorFrom(req),
      reason: decisionReason,
    })

    return res.json({
      success: true,
      data: {
        request: result.verificationRequest,
        sellerProfile: result.sellerProfile,
        noop: result.noop,
      },
    })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to reject seller verification request')
  }
}

export const requestMoreInformationOnVerification = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { requestId } = req.params
    const { reason } = req.body

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, error: 'reason is required' })
    }

    const result = await requestMoreInformation({ requestId, actor: actorFrom(req), reason })

    return res.json({
      success: true,
      data: { request: result.verificationRequest, noop: result.noop },
    })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to request more information')
  }
}

export const expireSellerVerificationRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { requestId } = req.params
    const result = await expireVerification({ requestId, actor: actorFrom(req) })

    return res.json({ success: true, data: { request: result.verificationRequest, noop: result.noop } })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to expire verification request')
  }
}

export const suspendSellerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { sellerProfileId } = req.params
    const { suspensionReason } = req.body

    if (!suspensionReason || !String(suspensionReason).trim()) {
      return res.status(400).json({ success: false, error: 'suspensionReason is required' })
    }

    const result = await suspendSellerAccount({
      sellerProfileId,
      actor: actorFrom(req),
      reason: suspensionReason,
    })

    // Preserve the pre-existing response shape (`data.sellerProfile`)
    // by also mirroring the legacy is_suspended/is_active flags, since
    // some existing frontend surfaces still read those directly.
    await query(
      `UPDATE seller_profiles SET is_suspended = true, is_active = false, suspension_reason = $1,
        suspended_at = CURRENT_TIMESTAMP, suspended_by_admin_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND is_suspended = false`,
      [suspensionReason, req.user.userId, sellerProfileId],
    ).catch(() => undefined)

    const reloaded = await query(`SELECT * FROM seller_profiles WHERE id = $1`, [sellerProfileId])

    return res.json({
      success: true,
      data: { sellerProfile: reloaded.rows[0] || result.sellerProfile, noop: result.noop },
    })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to suspend seller profile')
  }
}

export const restrictSellerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { sellerProfileId } = req.params
    const { reason } = req.body
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, error: 'reason is required' })
    }

    const result = await restrictSellerAccount({ sellerProfileId, actor: actorFrom(req), reason })
    return res.json({ success: true, data: { sellerProfile: result.sellerProfile, noop: result.noop } })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to restrict seller profile')
  }
}

export const closeSellerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { sellerProfileId } = req.params
    const { reason } = req.body
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, error: 'reason is required' })
    }

    const result = await closeSellerAccount({ sellerProfileId, actor: actorFrom(req), reason })
    return res.json({ success: true, data: { sellerProfile: result.sellerProfile, noop: result.noop } })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to close seller profile')
  }
}

export const setSellerCreatorAccess = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { sellerProfileId } = req.params
    const { accessEnabled, reason } = req.body as { accessEnabled: boolean; reason?: string }

    const current = await query(`SELECT * FROM seller_profiles WHERE id = $1 LIMIT 1`, [sellerProfileId])
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seller profile not found' })
    }

    const result = accessEnabled
      ? await reactivateSellerAccount({
          sellerProfileId,
          actor: actorFrom(req),
          reason: reason || 'Creator dashboard access granted by admin',
        }).catch((error) => {
          if (error instanceof IllegalTransitionError) {
            // Not currently in a state reactivate can move from (e.g.
            // still DRAFT) -- go straight to ACTIVE instead.
            return setSellerAccountStatus({
              sellerProfileId,
              toStatus: 'ACTIVE',
              actor: actorFrom(req),
              reason: reason || 'Creator dashboard access granted by admin',
              action: 'creator_dashboard_access_granted',
            })
          }
          throw error
        })
      : await setSellerAccountStatus({
          sellerProfileId,
          toStatus: 'RESTRICTED',
          actor: actorFrom(req),
          reason: reason || 'Creator dashboard access revoked by admin',
          action: 'creator_dashboard_access_revoked',
        })

    return res.json({
      success: true,
      data: {
        sellerProfile: result.sellerProfile,
        creatorAccess: { enabled: Boolean(accessEnabled), updatedBy: req.user.userId },
      },
    })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to update creator dashboard access')
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
    // Same backward-compatible lowercase-query-param mapping as the
    // verification-queue filter above, onto the PROFILE-level enum this
    // time (seller_profile_verification_status) -- 'suspended' maps to
    // nothing here since it's an account_status concept now, not a
    // filterable verification_status value.
    const profileStatusMap: Record<string, string> = {
      none: 'NOT_STARTED',
      pending: 'PENDING_REVIEW',
      approved: 'APPROVED',
      rejected: 'REJECTED',
      more_information_required: 'MORE_INFORMATION_REQUIRED',
      expired: 'EXPIRED',
    }
    if (profileStatusMap[status]) {
      params.push(profileStatusMap[status])
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

    const [requestsResult, storeProductCountResult, discoverPostCountResult, earningsSummary, documents] =
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
        listCurrentSellerDocuments(sellerProfileId).catch(() => []),
      ])

    return res.json({
      success: true,
      data: {
        sellerProfile: profile,
        verificationRequests: requestsResult.rows,
        storeProductCount: storeProductCountResult.rows[0]?.count || 0,
        discoverPostCount: discoverPostCountResult.rows[0]?.count || 0,
        earningsSummary,
        documents,
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

export const getSellerAuditLogForAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const { sellerProfileId } = req.params
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100)
    const offset = (page - 1) * limit

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `SELECT sal.*, u.email AS actor_email
         FROM seller_audit_log sal
         LEFT JOIN users u ON u.id = sal.actor_id
         WHERE sal.seller_profile_id = $1
         ORDER BY sal.created_at DESC
         LIMIT $2 OFFSET $3`,
        [sellerProfileId, limit, offset],
      ),
      query(`SELECT COUNT(*)::int AS total FROM seller_audit_log WHERE seller_profile_id = $1`, [
        sellerProfileId,
      ]),
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
    logger.error('Get seller audit log error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load seller audit log' })
  }
}

export const getSellerDocumentsForAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const { sellerProfileId } = req.params
    const documents = await listCurrentSellerDocuments(sellerProfileId)
    return res.json({ success: true, data: { documents } })
  } catch (error) {
    logger.error('Get seller documents error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load seller documents' })
  }
}

export const downloadSellerDocumentForAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }

    const { documentId } = req.params
    const result = await getSellerDocumentForDownload(documentId, { isAdmin: true })
    if (!result) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    applySecureDocumentDownloadHeaders(res, {
      contentType: result.contentType,
      category: result.category,
      contentLength: result.stream.contentLength,
    })
    result.stream.stream.pipe(res)
  } catch (error) {
    logger.error('Download seller document (admin) error:', error)
    return res.status(500).json({ success: false, error: 'Failed to download document' })
  }
}

export const reviewSellerDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { documentId } = req.params
    const { reviewStatus, reviewNotes } = req.body as {
      reviewStatus: 'accepted' | 'rejected'
      reviewNotes?: string
    }

    if (!['accepted', 'rejected'].includes(reviewStatus)) {
      return res.status(400).json({ success: false, error: 'reviewStatus must be accepted or rejected' })
    }

    const updated = await reviewSellerDocumentService({
      documentId,
      reviewStatus,
      reviewNotes,
      actor: actorFrom(req),
    })
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    return res.json({ success: true, data: { document: updated } })
  } catch (error) {
    logger.error('Review seller document error:', error)
    return res.status(500).json({ success: false, error: 'Failed to review document' })
  }
}

export const setSellerStoreStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { sellerProfileId } = req.params
    const { toStatus, reason } = req.body as { toStatus: string; reason?: string }

    // Deliberately excludes 'SUSPENDED' -- that's only reachable via
    // the dedicated suspend action, never a direct admin-picked value
    // on this generic endpoint.
    const allowed = ['DRAFT', 'READY', 'LIVE', 'PAUSED', 'CLOSED']
    if (!allowed.includes(toStatus)) {
      return res.status(400).json({ success: false, error: `toStatus must be one of: ${allowed.join(', ')}` })
    }

    const result = await setStoreStatus({
      sellerProfileId,
      toStatus: toStatus as SellerStoreStatus,
      actor: actorFrom(req),
      reason,
    })

    return res.json({ success: true, data: { sellerProfile: result.sellerProfile, noop: result.noop } })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to update store status')
  }
}

export const grantSellerAccess = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
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

    const result = await grantSellerAccessTransition({
      userId,
      tier: targetTier as any,
      actor: actorFrom(req),
    })

    return res.status(201).json({
      success: true,
      data: { sellerProfile: result.sellerProfile },
    })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to grant seller access')
  }
}

export const setSellerTier = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { sellerProfileId } = req.params
    const { tier } = req.body as { tier: string }

    if (!VALID_TIERS.includes(tier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier',
      })
    }

    const result = await setSellerTierTransition({
      sellerProfileId,
      toTier: tier as any,
      actor: actorFrom(req),
    })

    return res.json({
      success: true,
      data: { sellerProfile: result.sellerProfile, noop: result.noop },
    })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to update seller tier')
  }
}

export const reactivateSellerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureSellerInfrastructure(res))) {
      return
    }
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { sellerProfileId } = req.params

    const current = await query(`SELECT * FROM seller_profiles WHERE id = $1 LIMIT 1`, [sellerProfileId])
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seller profile not found' })
    }
    if (current.rows[0].account_status !== 'SUSPENDED' && current.rows[0].account_status !== 'RESTRICTED') {
      return res.status(409).json({ success: false, error: 'Seller profile is not suspended or restricted' })
    }

    const result = await reactivateSellerAccount({ sellerProfileId, actor: actorFrom(req) })

    // Mirror the legacy boolean flags for any frontend surface still
    // reading them directly.
    await query(
      `UPDATE seller_profiles SET is_suspended = false, is_active = true,
        suspension_reason = NULL, suspended_at = NULL, suspended_by_admin_id = NULL,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sellerProfileId],
    ).catch(() => undefined)

    const reloaded = await query(`SELECT * FROM seller_profiles WHERE id = $1`, [sellerProfileId])

    return res.json({ success: true, data: { sellerProfile: reloaded.rows[0] || result.sellerProfile } })
  } catch (error) {
    return mapTransitionError(res, error, 'Failed to reactivate seller profile')
  }
}
