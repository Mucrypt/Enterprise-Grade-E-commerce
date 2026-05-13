/**
 * ALERT THRESHOLDS ROUTES
 * Configuration endpoints for anomaly detection thresholds
 */

import { Router } from 'express'
import {
  getAlertThresholds,
  getAlertThreshold,
  updateAlertThreshold,
  resetAlertThreshold,
} from './alert-thresholds.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// All threshold routes require admin authentication
router.use(authenticate, authorize('admin', 'super_admin'))

/**
 * GET /api/v1/settings/alert-thresholds
 * Get all alert threshold configurations
 */
router.get('/', getAlertThresholds)

/**
 * GET /api/v1/settings/alert-thresholds/:id
 * Get single alert threshold configuration
 */
router.get('/:id', getAlertThreshold)

/**
 * PUT /api/v1/settings/alert-thresholds/:id
 * Update alert threshold configuration
 */
router.put('/:id', updateAlertThreshold)

/**
 * POST /api/v1/settings/alert-thresholds/:id/reset
 * Reset threshold to default values
 */
router.post('/:id/reset', resetAlertThreshold)

export default router
