/**
 * NOTIFICATION PREFERENCES ROUTES
 */

import { Router } from 'express'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from './notification-preferences.controller'
import { authenticate } from '../../../middleware/auth'

const router = Router()

// All notification preference routes require authentication
router.use(authenticate)

/**
 * GET /api/v1/settings/notification-preferences
 * Get current admin's notification preferences
 */
router.get('/', getNotificationPreferences)

/**
 * PUT /api/v1/settings/notification-preferences
 * Update current admin's notification preferences
 */
router.put('/', updateNotificationPreferences)

export default router
