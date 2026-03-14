import { Router } from 'express'
import { submitContactForm, getContactSubmissions } from './contact.controller'
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

export default router
