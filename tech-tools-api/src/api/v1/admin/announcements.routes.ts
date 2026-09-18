import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { adminAnnouncementSchemas, validate } from '../../../middleware/validation'
import { createAdminAnnouncement, getAdminAnnouncements } from './announcements.controller'

const router = Router()

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many announcement requests. Please try again shortly.' },
})

router.use(authenticate)

// Same domain as support tickets -- communicating with sellers.
router.get('/', requirePermissionOrLegacyRole('support.view', 'admin', 'super_admin'), getAdminAnnouncements)
router.post(
  '/',
  requirePermissionOrLegacyRole('support.manage', 'admin', 'super_admin'),
  writeLimiter,
  validate(adminAnnouncementSchemas.create),
  createAdminAnnouncement,
)

export default router
