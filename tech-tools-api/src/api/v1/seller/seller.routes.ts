import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../../middleware/auth'
import { sellerSchemas, validate } from '../../../middleware/validation'
import {
  getMySellerProfile,
  getMySellerVerificationRequests,
  getSellerTierConfig,
  onboardSeller,
  requestSellerVerification,
} from './seller.controller'

const router = Router()

const sellerWriteLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many seller write requests. Please try again shortly.',
  },
})

router.get('/tiers', getSellerTierConfig)

router.use(authenticate)

router.get('/me', getMySellerProfile)
router.post('/onboard', sellerWriteLimiter, validate(sellerSchemas.onboard), onboardSeller)
router.get('/verification-requests', getMySellerVerificationRequests)
router.post(
  '/verification-requests',
  sellerWriteLimiter,
  validate(sellerSchemas.requestVerification),
  requestSellerVerification,
)

export default router
