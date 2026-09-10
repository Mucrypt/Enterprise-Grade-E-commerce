import { Router } from 'express'
import {
  getPublicHomepageSettings,
  getHomepageSettings,
  updateHomepageSettings,
} from './homepage.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// Public -- both storefronts fetch this on every homepage load
router.get('/public', getPublicHomepageSettings)

// Admin
router.get(
  '/admin',
  authenticate,
  authorize('admin', 'super_admin'),
  getHomepageSettings,
)
router.put(
  '/admin',
  authenticate,
  authorize('admin', 'super_admin'),
  updateHomepageSettings,
)

export default router
