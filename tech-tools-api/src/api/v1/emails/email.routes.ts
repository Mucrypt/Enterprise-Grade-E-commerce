import { Router } from 'express'
import {
  getMessages,
  getMessageStats,
  sendEmail,
  resendEmail,
  getConfigStatus,
  getSettings,
  updateSettings,
  getAliases,
  createAlias,
  updateAlias,
  deleteAlias,
  testAlias,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from './email.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// All email routes require authentication and admin privileges
router.use(authenticate)
router.use(authorize('admin', 'super_admin'))

// =====================================================
// Email Messages
// =====================================================

// Get all messages with pagination and filters
router.get('/messages', getMessages)

// Get message statistics
router.get('/messages/stats', getMessageStats)

// Send a custom email
router.post('/messages/send', sendEmail)

// Resend a failed email
router.post('/messages/:id/resend', resendEmail)

// Get configuration status
router.get('/config/status', getConfigStatus)

// =====================================================
// Email Settings
// =====================================================

// Get email settings
router.get('/settings', getSettings)

// Update email settings
router.put('/settings', updateSettings)

// =====================================================
// Email Aliases
// =====================================================

// Get all aliases
router.get('/aliases', getAliases)

// Create a new alias
router.post('/aliases', createAlias)

// Update an alias
router.put('/aliases/:id', updateAlias)

// Delete an alias
router.delete('/aliases/:id', deleteAlias)

// Test an alias
router.post('/aliases/:id/test', testAlias)

// =====================================================
// Email Templates
// =====================================================

// Get all templates
router.get('/templates', getTemplates)

// Create a new template
router.post('/templates', createTemplate)

// Update a template
router.put('/templates/:id', updateTemplate)

// Delete a template
router.delete('/templates/:id', deleteTemplate)

export default router
