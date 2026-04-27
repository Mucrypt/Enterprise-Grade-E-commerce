import { Router } from 'express'
import {
  submitContactForm,
  getContactSubmissions,
  getSupportProfile,
  replyToContactSubmission,
  trackContactAnalyticsEvent,
  getContactAnalytics,
} from './contact.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import rateLimit from 'express-rate-limit'

const router = Router()

// Rate limit for contact form to prevent spam
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 submissions per 15 minutes
  message: {
    success: false,
    error: 'Too many contact form submissions. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// =====================================================
// Public Routes (no authentication required)
// =====================================================

/**
 * POST /api/v1/contact
 * Submit contact form
 */
router.post('/', contactFormLimiter, submitContactForm)

// =====================================================
// Admin Routes (authentication required)
// =====================================================

/**
 * GET /api/v1/contact/submissions
 * Get all contact form submissions (admin only)
 */
router.get(
  '/submissions',
  authenticate,
  authorize('admin', 'super_admin'),
  getContactSubmissions,
)

router.get('/support/profile', authenticate, getSupportProfile)

// =====================================================
// Analytics Routes
// =====================================================

/**
 * POST /api/v1/contact/analytics
 * Record a contact funnel event (public, fire-and-forget)
 */
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})
router.post('/analytics', analyticsLimiter, trackContactAnalyticsEvent)

/**
 * GET /api/v1/contact/analytics
 * Retrieve analytics summary (admin only)
 */
router.get(
  '/analytics',
  authenticate,
  authorize('admin', 'super_admin'),
  getContactAnalytics,
)

router.post(
  '/submissions/:id/reply',
  authenticate,
  authorize('admin', 'super_admin'),
  replyToContactSubmission,
)

export default router
