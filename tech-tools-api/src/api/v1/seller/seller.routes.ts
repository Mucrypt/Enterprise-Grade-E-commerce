import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, authenticateIfPresent, authorize } from '../../../middleware/auth'
import { requireAdminOrApprovedSeller } from '../../../middleware/seller-auth'
import { sellerSchemas, productSchemas, validate } from '../../../middleware/validation'
import { upload, handleUploadErrors, uploadSellerDocument } from '../../../utils/media'
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
  getMyOnboardingProgress,
  submitMySellerApplication,
  getMySellerCapabilities,
} from './seller-onboarding.controller'
import {
  uploadMySellerDocument,
  listMySellerDocuments,
  downloadMySellerDocument,
  deleteMySellerDocument,
} from './seller-documents.controller'
import {
  getMySellerProducts,
  getPendingSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  reviewSellerProduct,
} from './seller-product.controller'
import { getMyEarningsSummary, getMyEarningsLedger } from './seller-earnings.controller'
import sellerSupportRoutes from './seller-support.routes'
import sellerAnnouncementsRoutes from './seller-announcements.routes'

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
// Resumable onboarding -- backend-derived progress/eligibility, and the
// single capability response the frontend is meant to trust instead of
// re-deriving eligibility per page.
// =====================================================
router.get('/onboarding/progress', getMyOnboardingProgress)
router.post(
  '/onboarding/submit',
  sellerWriteLimiter,
  validate(sellerSchemas.submitApplication),
  submitMySellerApplication,
)
router.get('/capabilities', getMySellerCapabilities)

// =====================================================
// Verification documents -- private storage only (see
// media-storage.service.ts's storePrivateMediaBuffer/streamPrivateMedia).
// A lighter limiter than sellerWriteLimiter would allow more requests,
// but documents are exactly the kind of endpoint the founder's spec
// calls out for rate limiting, so this reuses the stricter one.
// =====================================================
const uploadDocumentMiddleware = handleUploadErrors(uploadSellerDocument.single('document'))

router.post(
  '/documents',
  sellerWriteLimiter,
  uploadDocumentMiddleware,
  validate(sellerSchemas.uploadDocument),
  uploadMySellerDocument,
)
router.get('/documents', listMySellerDocuments)
router.get('/documents/:documentId/download', downloadMySellerDocument)
router.delete('/documents/:documentId', deleteMySellerDocument)

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

// =====================================================
// Seller-facing earnings -- read-only. Admin's view over ALL sellers'
// balances/payouts lives separately at /admin/seller-payouts (a distinct
// money-movement surface with its own permission gates, not bolted onto
// this file).
// =====================================================
router.get('/earnings/summary', requireAdminOrApprovedSeller, getMyEarningsSummary)
router.get('/earnings/ledger', requireAdminOrApprovedSeller, getMyEarningsLedger)

// =====================================================
// Seller support tickets -- real threaded conversation with admin
// staff. Gated by requireSellerProfile (applied inside
// seller-support.routes.ts), looser than requireAdminOrApprovedSeller:
// an unverified/pending seller can still reach support.
// =====================================================
router.use('/support/tickets', sellerSupportRoutes)

// Broadcast announcements -- separate router (not "tickets") since it's
// a genuinely different, one-to-many shape, same requireSellerProfile
// gate applied inside seller-announcements.routes.ts.
router.use('/support/announcements', sellerAnnouncementsRoutes)

export default router
