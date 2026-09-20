import { NextFunction, Request, Response } from 'express'
import { query as dbQuery } from '../database/connection'
import { AuthRequest } from './auth'
import logger from '../utils/logger'

// =====================================================
// Lets an onboarded seller in good standing manage their OWN content
// (Discover posts, products, earnings) alongside admin/staff, without a
// blanket `authorize('seller')` role check -- account_status can
// change, so this is a real DB read every request, not a cached JWT
// claim. `sellerProfileId` is attached to the request when the caller
// reached this via a seller_profiles row rather than an admin/staff
// role; callers use it to scope ownership and force a pending-review
// gate on create. Shared by discover.controller.ts and
// seller-product.controller.ts -- originally lived only in
// discover.controller.ts, moved here once a second, unrelated feature
// needed the exact same check rather than a copy of it.
// =====================================================

export interface SellerAuthRequest extends AuthRequest {
  sellerProfileId?: string
}

// Looser than requireAdminOrOnboardedSeller -- any user with a
// seller_profiles row at all, regardless of account_status (including
// SUSPENDED). Used for seller support tickets: an unverified/pending or
// even suspended seller is exactly who most needs to reach staff (e.g.
// "why is my verification stuck" or "why was I suspended"), so gating
// support behind good standing would lock out the sellers who need it
// most.
export async function requireSellerProfile(req: Request, res: Response, next: NextFunction) {
  const authReq = req as SellerAuthRequest
  if (!authReq.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' })
  }

  if (authReq.user.userType === 'admin' || authReq.user.userType === 'super_admin') {
    return next()
  }

  try {
    const sellerResult = await dbQuery(
      `SELECT id FROM seller_profiles WHERE user_id = $1 LIMIT 1`,
      [authReq.user.id],
    )
    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only sellers can do this',
      })
    }
    authReq.sellerProfileId = sellerResult.rows[0].id
    next()
  } catch (error: any) {
    logger.error('Error checking seller profile:', error)
    res.status(500).json({ success: false, message: 'Failed to verify seller status', error: error.message })
  }
}

// Business-strategy gate, not a stricter security one: a seller can
// build (create/edit their own products and Discover content, read
// their own earnings) as soon as they're onboarded, not only once fully
// verified -- every listing this lets them create still forces its own
// `is_active = false` pending-admin-review state regardless of tier, so
// nothing becomes buyer-visible just because this got looser. Only
// SUSPENDED/CLOSED actually cut a seller off from managing their own
// stuff; going PUBLIC (the seller's own storefront page,
// evaluateStoreReadiness) is the one thing that still requires real
// verification, enforced separately and untouched by this function.
export async function requireAdminOrOnboardedSeller(req: Request, res: Response, next: NextFunction) {
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
       WHERE user_id = $1 AND account_status NOT IN ('SUSPENDED', 'CLOSED')
       LIMIT 1`,
      [authReq.user.id],
    )
    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or onboarded sellers in good standing can do this',
      })
    }
    authReq.sellerProfileId = sellerResult.rows[0].id
    next()
  } catch (error: any) {
    logger.error('Error checking seller standing:', error)
    res.status(500).json({ success: false, message: 'Failed to verify seller status', error: error.message })
  }
}
