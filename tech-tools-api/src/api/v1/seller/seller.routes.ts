import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, authenticateIfPresent, authorize } from '../../../middleware/auth'
import { requireAdminOrApprovedSeller } from '../../../middleware/seller-auth'
import { sellerSchemas, productSchemas, validate } from '../../../middleware/validation'
import { upload, handleUploadErrors } from '../../../utils/media'
import {
  getMySellerProfile,
  getMySellerVerificationRequests,
  getSellerTierConfig,
  getPublicSellerProfile,
  followSeller,
  unfollowSeller,
  onboardSeller,
  requestSellerVerification,
} from './seller.controller'
import {
  getMySellerProducts,
  getPendingSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  reviewSellerProduct,
} from './seller-product.controller'

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

// Public storefront profile -- /profile/:handle rather than a bare
// /:handle, since a bare param route registered here would shadow /me
// (Express matches routes in registration order, and /me is registered
// further down after router.use(authenticate)). authenticateIfPresent
// so a signed-in viewer's isFollowing resolves without requiring auth
// for guests, same convention as the Discover feed.
router.get('/profile/:handle', authenticateIfPresent, getPublicSellerProfile)

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
router.post('/profile/:id/follow', followSeller)
router.delete('/profile/:id/follow', unfollowSeller)

// =====================================================
// Seller-owned products -- requireAdminOrApprovedSeller lets both admin
// and a real approved seller in; every handler then scopes by
// ownership. Every seller-created/edited product is forced pending
// review, same real trust/safety gate as Discover posts.
// =====================================================
const uploadProductImages = handleUploadErrors(upload.fields([{ name: 'images', maxCount: 10 }]))

router.get('/products', requireAdminOrApprovedSeller, getMySellerProducts)
router.post(
  '/products',
  requireAdminOrApprovedSeller,
  uploadProductImages,
  validate(productSchemas.create),
  createSellerProduct,
)
router.put('/products/:id', requireAdminOrApprovedSeller, updateSellerProduct)
router.delete('/products/:id', requireAdminOrApprovedSeller, deleteSellerProduct)

// Admin-only review queue -- must come after the generic /products
// routes above are declared (order doesn't matter here since the path
// is distinct), but stays strictly admin, unlike the seller-facing ones.
router.get('/products/pending', authorize('admin', 'super_admin'), getPendingSellerProducts)
router.patch('/products/:id/review', authorize('admin', 'super_admin'), reviewSellerProduct)

export default router
