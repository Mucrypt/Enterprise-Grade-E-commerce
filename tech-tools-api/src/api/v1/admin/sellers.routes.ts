import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { adminSellerSchemas, validate } from '../../../middleware/validation'
import {
  approveSellerVerificationRequest,
  getAllSellers,
  getSellerDetail,
  getSellerVerificationQueue,
  grantSellerAccess,
  reactivateSellerProfile,
  rejectSellerVerificationRequest,
  setSellerCreatorAccess,
  setSellerTier,
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

router.use(authenticate)

const view = requirePermissionOrLegacyRole('sellers.view', 'admin', 'super_admin')
const manage = requirePermissionOrLegacyRole('sellers.manage', 'admin', 'super_admin')

router.get('/', view, getAllSellers)
router.get('/verification-queue', view, getSellerVerificationQueue)
router.get('/:sellerProfileId', view, getSellerDetail)

router.post(
  '/grant',
  manage,
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.grantSellerAccess),
  grantSellerAccess,
)
router.patch(
  '/:sellerProfileId/tier',
  manage,
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.setSellerTier),
  setSellerTier,
)
router.post(
  '/:sellerProfileId/reactivate',
  manage,
  adminSellerWriteLimiter,
  reactivateSellerProfile,
)
router.post(
  '/verification-requests/:requestId/approve',
  manage,
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.approveVerification),
  approveSellerVerificationRequest,
)
router.post(
  '/verification-requests/:requestId/reject',
  manage,
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.rejectVerification),
  rejectSellerVerificationRequest,
)
router.post(
  '/:sellerProfileId/suspend',
  manage,
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.suspendSeller),
  suspendSellerProfile,
)
router.post(
  '/:sellerProfileId/creator-access',
  manage,
  adminSellerWriteLimiter,
  validate(adminSellerSchemas.setCreatorAccess),
  setSellerCreatorAccess,
)

export default router
