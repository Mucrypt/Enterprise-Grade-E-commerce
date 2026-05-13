/**
 * ALERTS ROUTES
 * Alert management endpoints
 */

import { Router } from 'express';
import {
  getActiveAlerts,
  getAlertById,
  acknowledgeAlert,
  dismissAlert,
  getAlertStats,
} from './alerts.controller';
import { authenticate, authorize } from '../../../middleware/auth';

const router = Router();

// All alert routes require admin authentication
router.use(authenticate, authorize('admin', 'super_admin'));

/**
 * GET /api/v1/alerts
 * Get active alerts with optional filtering by severity
 */
router.get('/', getActiveAlerts);

/**
 * GET /api/v1/alerts/stats
 * Get alert statistics summary
 */
router.get('/stats', getAlertStats);

/**
 * GET /api/v1/alerts/:id
 * Get alert details
 */
router.get('/:id', getAlertById);

/**
 * POST /api/v1/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/:id/acknowledge', acknowledgeAlert);

/**
 * POST /api/v1/alerts/:id/dismiss
 * Dismiss an alert
 */
router.post('/:id/dismiss', dismissAlert);

export default router;
