import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, authorize } from '../../../middleware/auth'
import { adminSellerSchemas, validate } from '../../../middleware/validation'
import {
  approveSellerVerificationRequest,
  getSellerVerificationQueue,
  rejectSellerVerificationRequest,
  setSellerCreatorAccess,
  suspendSellerProfile,
} from './sellers.controller'

const router = Router()

const adminSellerWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many seller moderation requests. Please try again shortly.',
  },
})

router.use(authenticate, authorize('admin', 'super_admin'))

router.get('/verification-queue', getSellerVerificationQueue)
router.post(
  '/verification-requests/:requestId/approve',
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.approveVerification),
  approveSellerVerificationRequest,
)
router.post(
  '/verification-requests/:requestId/reject',
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.rejectVerification),
  rejectSellerVerificationRequest,
)
router.post(
  '/:sellerProfileId/suspend',
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.suspendSeller),
  suspendSellerProfile,
)
router.post(
  '/:sellerProfileId/creator-access',
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.setCreatorAccess),
  setSellerCreatorAccess,
)

export default router
