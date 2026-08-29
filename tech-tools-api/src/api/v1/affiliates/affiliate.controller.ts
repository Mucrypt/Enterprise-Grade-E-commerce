import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { StaffAuthRequest } from '../../../middleware/staff'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  getAffiliateSettings,
  getOrCreateAffiliateProfile,
  getStoreCreditBalance,
} from '../../../services/affiliate.service'

// Public, unauthenticated. Fire-and-forget from the storefront on every
// page load that carries a ?ref= param. Never 404s / never reveals whether
// a code is valid via status code -- always 200, `valid` in the body tells
// the (non-error-branching) caller nothing it needs to act on.
export const trackClick = async (req: any, res: Response) => {
  try {
    const { code, path, visitorId } = req.body || {}
    if (!code || typeof code !== 'string') {
      return res.json({ success: true, valid: false })
    }

    const settings = await getAffiliateSettings()
    if (!settings.programEnabled) {
      return res.json({ success: true, valid: false })
    }

    const affiliate = await query(
      `SELECT id FROM affiliate_profiles WHERE referral_code = $1 AND status = 'active'`,
      [code.trim().toUpperCase()],
    )
    if (!affiliate.rows[0]) {
      return res.json({ success: true, valid: false })
    }

    await query(
      `INSERT INTO affiliate_clicks (affiliate_id, referral_code, visitor_id, landing_path)
       VALUES ($1, $2, $3, $4)`,
      [
        affiliate.rows[0].id,
        code.trim().toUpperCase(),
        typeof visitorId === 'string' ? visitorId.slice(0, 64) : null,
        typeof path === 'string' ? path.slice(0, 500) : null,
      ],
    )
    res.json({ success: true, valid: true })
  } catch (error) {
    // Click tracking is best-effort -- never let it surface as an error to
    // the storefront's fire-and-forget call.
    logger.warn('trackClick failed (non-fatal):', error)
    res.json({ success: true, valid: false })
  }
}

// Public. Just the flat rate, for the storefront and the /affiliates
// marketing page to display honestly -- never a hardcoded number in the UI.
export const getPublicSettings = async (_req: any, res: Response) => {
  try {
    const settings = await getAffiliateSettings()
    res.json({
      success: true,
      data: { commissionRatePercent: settings.commissionRatePercent, programEnabled: settings.programEnabled },
    })
  } catch (error) {
    logger.error('Get public affiliate settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch affiliate settings' })
  }
}

export const getOrCreateMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const profile = await getOrCreateAffiliateProfile(userId)
    res.json({
      success: true,
      data: {
        referralCode: profile.referralCode,
        status: profile.status,
      },
    })
  } catch (error) {
    logger.error('Get or create affiliate profile error:', error)
    res.status(500).json({ success: false, error: 'Failed to load your referral profile' })
  }
}

export const getMyStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const profile = await getOrCreateAffiliateProfile(userId)

    const totalsResult = await query(
      `SELECT
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) AS pending_earnings,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'confirmed'), 0) AS confirmed_earnings,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
         COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_count
       FROM affiliate_conversions
       WHERE affiliate_id = $1`,
      [profile.id],
    )
    const totals = totalsResult.rows[0]

    const clicksResult = await query(
      `SELECT total_clicks FROM affiliate_profiles WHERE id = $1`,
      [profile.id],
    )

    // Zero PII of the referred buyer -- relative date + status bucket +
    // commission amount only. Never their name/email/address.
    const recentResult = await query(
      `SELECT id, order_value, commission_amount, status, created_at, confirmed_at
       FROM affiliate_conversions
       WHERE affiliate_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [profile.id],
    )

    const storeCreditBalance = await getStoreCreditBalance(userId)

    res.json({
      success: true,
      data: {
        referralCode: profile.referralCode,
        status: profile.status,
        totalClicks: Number(clicksResult.rows[0]?.total_clicks || 0),
        pendingEarnings: Number(totals.pending_earnings),
        confirmedEarnings: Number(totals.confirmed_earnings),
        pendingCount: Number(totals.pending_count),
        confirmedCount: Number(totals.confirmed_count),
        storeCreditBalance,
        recentReferrals: recentResult.rows.map((r) => ({
          id: r.id,
          orderValue: Number(r.order_value),
          commissionAmount: Number(r.commission_amount),
          status: r.status,
          createdAt: r.created_at,
          confirmedAt: r.confirmed_at,
        })),
      },
    })
  } catch (error) {
    logger.error('Get affiliate stats error:', error)
    res.status(500).json({ success: false, error: 'Failed to load your referral stats' })
  }
}

export const getMyStoreCredit = async (req: AuthRequest, res: Response) => {
  try {
    const balance = await getStoreCreditBalance(req.user!.userId)
    res.json({ success: true, data: { balance } })
  } catch (error) {
    logger.error('Get store credit balance error:', error)
    res.status(500).json({ success: false, error: 'Failed to load your store credit balance' })
  }
}

// ---- Admin ----

export const listAffiliates = async (req: StaffAuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const offset = (page - 1) * limit
    const search = typeof req.query.search === 'string' ? `%${req.query.search}%` : null
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null

    const whereClauses: string[] = []
    const params: unknown[] = []
    if (search) {
      params.push(search)
      whereClauses.push(`(u.email ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR ap.referral_code ILIKE $${params.length})`)
    }
    if (status) {
      params.push(status)
      whereClauses.push(`ap.status = $${params.length}`)
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM affiliate_profiles ap JOIN users u ON u.id = ap.user_id ${whereSql}`,
      params,
    )

    params.push(limit, offset)
    const listResult = await query(
      `SELECT ap.id, ap.referral_code, ap.status, ap.total_clicks, ap.total_conversions, ap.total_earned,
              ap.created_at, u.first_name, u.last_name, u.email
       FROM affiliate_profiles ap
       JOIN users u ON u.id = ap.user_id
       ${whereSql}
       ORDER BY ap.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({
      success: true,
      data: {
        affiliates: listResult.rows,
        total: Number(countResult.rows[0]?.total || 0),
        page,
        limit,
      },
    })
  } catch (error) {
    logger.error('List affiliates error:', error)
    res.status(500).json({ success: false, error: 'Failed to list affiliates' })
  }
}

export const getAffiliateConversions = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const result = await query(
      `SELECT id, order_id, order_value, commission_rate_snapshot, commission_amount,
              status, cancelled_reason, created_at, confirmed_at, cancelled_at
       FROM affiliate_conversions
       WHERE affiliate_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [id],
    )
    res.json({ success: true, data: { conversions: result.rows } })
  } catch (error) {
    logger.error('Get affiliate conversions error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch conversions' })
  }
}

export const updateAffiliateStatus = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: "status must be 'active' or 'suspended'" })
    }
    const result = await query(
      `UPDATE affiliate_profiles SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id, status`,
      [id, status],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' })
    }
    res.json({ success: true, data: { affiliate: result.rows[0] } })
  } catch (error) {
    logger.error('Update affiliate status error:', error)
    res.status(500).json({ success: false, error: 'Failed to update affiliate status' })
  }
}

export const getSettings = async (_req: StaffAuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT commission_rate_percent, hold_period_days, fallback_hold_period_days,
              min_payout_amount, program_enabled
       FROM affiliate_settings WHERE id = 1`,
    )
    res.json({ success: true, data: { settings: result.rows[0] } })
  } catch (error) {
    logger.error('Get affiliate settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch settings' })
  }
}

export const updateSettings = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { commissionRatePercent, holdPeriodDays, fallbackHoldPeriodDays, programEnabled } = req.body

    if (commissionRatePercent !== undefined && (Number(commissionRatePercent) < 0 || Number(commissionRatePercent) > 100)) {
      return res.status(400).json({ success: false, error: 'commissionRatePercent must be between 0 and 100' })
    }

    const result = await query(
      `UPDATE affiliate_settings
       SET commission_rate_percent = COALESCE($1, commission_rate_percent),
           hold_period_days = COALESCE($2, hold_period_days),
           fallback_hold_period_days = COALESCE($3, fallback_hold_period_days),
           program_enabled = COALESCE($4, program_enabled),
           updated_at = NOW()
       WHERE id = 1
       RETURNING commission_rate_percent, hold_period_days, fallback_hold_period_days,
                 min_payout_amount, program_enabled`,
      [
        commissionRatePercent !== undefined ? Number(commissionRatePercent) : null,
        holdPeriodDays !== undefined ? Number(holdPeriodDays) : null,
        fallbackHoldPeriodDays !== undefined ? Number(fallbackHoldPeriodDays) : null,
        programEnabled !== undefined ? Boolean(programEnabled) : null,
      ],
    )
    res.json({ success: true, data: { settings: result.rows[0] } })
  } catch (error) {
    logger.error('Update affiliate settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to update settings' })
  }
}

export const getStoreCreditLedger = async (req: StaffAuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25))
    const offset = (page - 1) * limit

    const countResult = await query(`SELECT COUNT(*) AS total FROM store_credit_ledger`)
    const result = await query(
      `SELECT scl.id, scl.delta_amount, scl.reason, scl.reference_type, scl.reference_id, scl.created_at,
              u.first_name, u.last_name, u.email
       FROM store_credit_ledger scl
       JOIN users u ON u.id = scl.user_id
       ORDER BY scl.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    )
    res.json({
      success: true,
      data: { entries: result.rows, total: Number(countResult.rows[0]?.total || 0), page, limit },
    })
  } catch (error) {
    logger.error('Get store credit ledger error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch store credit ledger' })
  }
}
