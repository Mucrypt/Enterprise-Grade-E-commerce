import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import {
  getSellerPayoutBalances,
  getSellerLedger,
  getEligibleEarnings,
  recordSellerPayoutBatch,
} from './seller-payouts.controller'

const router = Router()

const payoutWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many payout requests. Please try again shortly.',
  },
})

router.use(authenticate)

router.get('/balances', requirePermissionOrLegacyRole('sellers.payouts.view', 'admin', 'super_admin'), getSellerPayoutBalances)
router.get(
  '/:sellerProfileId/ledger',
  requirePermissionOrLegacyRole('sellers.payouts.view', 'admin', 'super_admin'),
  getSellerLedger,
)
router.get(
  '/:sellerProfileId/eligible-earnings',
  requirePermissionOrLegacyRole('sellers.payouts.view', 'admin', 'super_admin'),
  getEligibleEarnings,
)
router.post(
  '/:sellerProfileId/batches',
  payoutWriteLimiter,
  requirePermissionOrLegacyRole('sellers.payouts.manage', 'admin', 'super_admin'),
  recordSellerPayoutBatch,
)

export default router
