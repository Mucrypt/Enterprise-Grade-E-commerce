import { Router } from 'express'
import {
  activateBusinessMode,
  getProfile,
  updateProfile,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
} from './user.controller'
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
router.post(
  '/business-mode/activate',
  businessModeLimiter,
  validate(userSchemas.activateBusinessMode),
  activateBusinessMode,
)

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
