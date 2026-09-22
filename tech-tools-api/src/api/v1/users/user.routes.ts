import { Router } from 'express'
import {
  activateBusinessMode,
  getProfile,
  updateProfile,
  updateLocalePreferences,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
} from './user.controller'
import { registerPushToken, unregisterPushToken } from './push-token.controller'
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  syncWishlist,
} from './wishlist.controller'
import { getFollowedBrands, followBrand, unfollowBrand } from './brand-follow.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { validate } from '../../../middleware/validation'
import { userSchemas } from '../../../middleware/validation'
import rateLimit from 'express-rate-limit'

const router = Router()

const businessModeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many business mode activation attempts. Please try again later.',
  },
})

// All routes require authentication
router.use(authenticate)

// Profile routes
router.get('/profile', getProfile)
router.put('/profile', validate(userSchemas.updateProfile), updateProfile)
router.put(
  '/locale-preferences',
  validate(userSchemas.updateLocalePreferences),
  updateLocalePreferences,
)
router.post(
  '/business-mode/activate',
  businessModeLimiter,
  validate(userSchemas.activateBusinessMode),
  activateBusinessMode,
)

// Push notification device registration
router.post('/push-token', registerPushToken)
router.delete('/push-token', unregisterPushToken)

// Wishlist routes -- the real, server-synced wishlist (guests stay
// local-only client-side; these are only ever called for a signed-in
// user). /sync must come before /:productId so 'sync' is never parsed
// as a product id.
router.get('/wishlist', getWishlist)
router.post('/wishlist/sync', syncWishlist)
router.post('/wishlist', addToWishlist)
router.delete('/wishlist/:productId', removeFromWishlist)
router.delete('/wishlist', clearWishlist)

// Brand-follow routes -- the real, server-backed "Follow" on the
// Trending pages (web + mobile), replacing a client-only toggle that
// reset on every refresh.
router.get('/followed-brands', getFollowedBrands)
router.post('/followed-brands', followBrand)
router.delete('/followed-brands/:brandId', unfollowBrand)

// Address routes
router.get('/addresses', getUserAddresses)
router.post('/addresses', validate(userSchemas.updateAddress), addUserAddress)
router.put(
  '/addresses/:addressId',
  validate(userSchemas.updateAddress),
  updateUserAddress,
)
router.delete('/addresses/:addressId', deleteUserAddress)

// Admin only routes
router.get('/admin/users', authorize('admin', 'super_admin'), getProfile)
router.put(
  '/admin/users/:userId',
  authorize('admin', 'super_admin'),
  updateProfile,
)

export default router
