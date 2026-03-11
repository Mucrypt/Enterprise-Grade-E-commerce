import { Router } from 'express'
import {
  getMessages,
  getMessageStats,
  getMessageById,
  sendMessage,
  resendMessage,
  sendToOrder,
  getSettings,
  updateSettings,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getConfigStatus,
} from './whatsapp.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// All WhatsApp routes require authentication and admin privileges
router.use(authenticate)
router.use(authorize('admin', 'super_admin'))

// =====================================================
// WhatsApp Messages
// =====================================================

// Get all messages with pagination and filters
router.get('/messages', getMessages)

// Get message statistics
router.get('/messages/stats', getMessageStats)

// Get a single message by ID
router.get('/messages/:id', getMessageById)

// Send a custom message
router.post('/messages/send', sendMessage)

// Resend a failed message
router.post('/messages/:id/resend', resendMessage)

// Send WhatsApp to an order
router.post('/orders/:orderId/send', sendToOrder)

// =====================================================
// WhatsApp Settings
// =====================================================

// Get WhatsApp settings
router.get('/settings', getSettings)

// Update WhatsApp settings
router.put('/settings', updateSettings)

// Get configuration status
router.get('/config/status', getConfigStatus)

// =====================================================
// WhatsApp Templates
// =====================================================

// Get all templates
router.get('/templates', getTemplates)

// Get a single template
router.get('/templates/:id', getTemplateById)

// Create a new template
router.post('/templates', createTemplate)

// Update a template
router.put('/templates/:id', updateTemplate)

// Delete a template
router.delete('/templates/:id', deleteTemplate)

export default router
