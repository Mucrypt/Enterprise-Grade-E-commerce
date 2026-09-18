import { Response } from 'express'
import { SellerAuthRequest } from '../../../middleware/seller-auth'
import { getSellerEarningsSummary, getSellerPayoutLedger } from '../../../services/seller-payout.service'
import logger from '../../../utils/logger'

// =====================================================
// Seller-facing earnings -- read-only view over the seller_earnings/
// seller_payout_ledger tables (see 071_seller_earnings_payouts.sql and
// seller-payout.service.ts). Mirrors seller-product.controller.ts's
// req.sellerProfileId guard exactly -- an admin hitting these endpoints
// without their own seller profile gets the same 403 a seller-product
// endpoint would give them.
// =====================================================

export const getMyEarningsSummary = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only approved sellers have earnings here' })
    }

    const summary = await getSellerEarningsSummary(req.sellerProfileId)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    logger.error('Error fetching seller earnings summary:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch your earnings', error: error.message })
  }
}

export const getMyEarningsLedger = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only approved sellers have earnings here' })
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(50, parseInt(String(req.query.limit || '20'), 10))
    const result = await getSellerPayoutLedger(req.sellerProfileId, { page, limit })
    res.json({ success: true, data: result })
  } catch (error: any) {
    logger.error('Error fetching seller payout ledger:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch your earnings history', error: error.message })
  }
}
