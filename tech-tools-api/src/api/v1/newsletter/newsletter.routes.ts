import { Router } from 'express'
import {
  // Public endpoints
  subscribe,
  unsubscribe,
  // Admin endpoints
  getSubscribers,
  getSubscriberStats,
  getSubscriberById,
  updateSubscriber,
  deleteSubscriber,
  exportSubscribers,
  importSubscribers,
  // Campaign endpoints
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  getCampaignStats,
  getCampaignConversions,
  getDeliverabilityDashboard,
  recordComplaint,
  trackClickRedirect,
  // Settings
  getSettings,
  updateSettings,
} from './newsletter.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// =====================================================
// Public Endpoints (No auth required)
// =====================================================

// Subscribe to newsletter
router.post('/subscribe', subscribe)

// Unsubscribe from newsletter
router.post('/unsubscribe', unsubscribe)

router.get('/track/click/:token', trackClickRedirect)

// =====================================================
// Admin Endpoints (Auth required)
// =====================================================

// Subscriber management
router.get(
  '/subscribers',
  authenticate,
  authorize('admin', 'super_admin'),
  getSubscribers,
)
router.get(
  '/subscribers/stats',
  authenticate,
  authorize('admin', 'super_admin'),
  getSubscriberStats,
)
router.get(
  '/subscribers/export',
  authenticate,
  authorize('admin', 'super_admin'),
  exportSubscribers,
)
router.post(
  '/subscribers/import',
  authenticate,
  authorize('admin', 'super_admin'),
  importSubscribers,
)
router.get(
  '/subscribers/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  getSubscriberById,
)
router.put(
  '/subscribers/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  updateSubscriber,
)
router.delete(
  '/subscribers/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteSubscriber,
)

// Campaign management
router.get(
  '/campaigns',
  authenticate,
  authorize('admin', 'super_admin'),
  getCampaigns,
)
router.post(
  '/campaigns',
  authenticate,
  authorize('admin', 'super_admin'),
  createCampaign,
)
router.get(
  '/campaigns/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  getCampaignById,
)
router.get(
  '/campaigns/:id/stats',
  authenticate,
  authorize('admin', 'super_admin'),
  getCampaignStats,
)
router.get(
  '/campaigns/:id/conversions',
  authenticate,
  authorize('admin', 'super_admin'),
  getCampaignConversions,
)
router.put(
  '/campaigns/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  updateCampaign,
)
router.delete(
  '/campaigns/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteCampaign,
)
router.post(
  '/campaigns/:id/send',
  authenticate,
  authorize('admin', 'super_admin'),
  sendCampaign,
)

router.get(
  '/deliverability/dashboard',
  authenticate,
  authorize('admin', 'super_admin'),
  getDeliverabilityDashboard,
)

router.post(
  '/deliverability/complaints',
  authenticate,
  authorize('admin', 'super_admin'),
  recordComplaint,
)

// Settings
router.get(
  '/settings',
  authenticate,
  authorize('admin', 'super_admin'),
  getSettings,
)
router.put(
  '/settings',
  authenticate,
  authorize('admin', 'super_admin'),
  updateSettings,
)

export default router
