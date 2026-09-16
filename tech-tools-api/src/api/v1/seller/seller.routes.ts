import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, authenticateIfPresent } from '../../../middleware/auth'
import { sellerSchemas, validate } from '../../../middleware/validation'
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

export default router
