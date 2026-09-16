import { NextFunction, Request, Response } from 'express'
import { query as dbQuery } from '../database/connection'
import { AuthRequest } from './auth'
import logger from '../utils/logger'

// =====================================================
// Lets an approved, active, non-suspended seller manage their OWN
// content (Discover posts, and now products) alongside admin/staff,
// without a blanket `authorize('seller')` role check --
// verification_status can change, so this is a real DB read every
// request, not a cached JWT claim. `sellerProfileId` is attached to the
// request when the caller reached this via seller approval rather than
// an admin/staff role; callers use it to scope ownership and force a
// pending-review gate on create. Shared by discover.controller.ts and
// seller-product.controller.ts -- originally lived only in
// discover.controller.ts, moved here once a second, unrelated feature
// needed the exact same check rather than a copy of it.
// =====================================================

export interface SellerAuthRequest extends AuthRequest {
  sellerProfileId?: string
}

export async function requireAdminOrApprovedSeller(req: Request, res: Response, next: NextFunction) {
  const authReq = req as SellerAuthRequest
  if (!authReq.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' })
  }

  if (authReq.user.userType === 'admin' || authReq.user.userType === 'super_admin') {
    return next()
  }

  try {
    const sellerResult = await dbQuery(
      `SELECT id FROM seller_profiles
       WHERE user_id = $1 AND verification_status = 'approved' AND is_active = TRUE AND is_suspended = FALSE
       LIMIT 1`,
      [authReq.user.id],
    )
    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or approved sellers can do this',
      })
    }
    authReq.sellerProfileId = sellerResult.rows[0].id
    next()
  } catch (error: any) {
    logger.error('Error checking seller approval:', error)
    res.status(500).json({ success: false, message: 'Failed to verify seller status', error: error.message })
  }
}
