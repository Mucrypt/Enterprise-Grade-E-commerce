import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { adminSupportTicketSchemas, validate } from '../../../middleware/validation'
import {
  assignAdminTicket,
  getAdminTicket,
  getAdminTickets,
  replyToAdminTicket,
  updateAdminTicketStatus,
} from './support-tickets.controller'

const router = Router()

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many support ticket requests. Please try again shortly.' },
})

router.use(authenticate)

const view = requirePermissionOrLegacyRole('support.view', 'admin', 'super_admin')
const manage = requirePermissionOrLegacyRole('support.manage', 'admin', 'super_admin')

router.get('/', view, getAdminTickets)
router.get('/:id', view, getAdminTicket)
router.post('/:id/messages', manage, writeLimiter, validate(adminSupportTicketSchemas.reply), replyToAdminTicket)
router.patch('/:id/assign', manage, writeLimiter, validate(adminSupportTicketSchemas.assign), assignAdminTicket)
router.patch('/:id/status', manage, writeLimiter, validate(adminSupportTicketSchemas.status), updateAdminTicketStatus)

export default router
