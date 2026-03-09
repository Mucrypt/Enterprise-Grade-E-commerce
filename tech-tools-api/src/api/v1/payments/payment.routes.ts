// ============================================
// TechTools API - Payment Routes
// Stripe Payment Integration
// ============================================

import { Router, raw } from 'express'
import {
  getStripeConfig,
  createPaymentIntent,
  updatePaymentIntent,
  getPaymentIntentStatus,
  confirmPayment,
  cancelPayment,
  getPaymentMethods,
  createSetupIntent,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  getPaymentHistory,
  createRefund,
  handleWebhook,
} from './payment.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// ============================================
// Public Routes
// ============================================

// Get Stripe publishable key (public)
router.get('/config', getStripeConfig)

// Stripe webhook (must use raw body parser)
// Note: This route should be registered before json body parser in app.ts
router.post('/webhook', raw({ type: 'application/json' }), handleWebhook)

// ============================================
// Authenticated Customer Routes
// ============================================

// Payment Intent Management
router.post('/intent', authenticate, createPaymentIntent)
router.put('/intent', authenticate, updatePaymentIntent)
router.get('/intent/:paymentIntentId', authenticate, getPaymentIntentStatus)
router.post('/confirm', authenticate, confirmPayment)
router.delete('/intent/:paymentIntentId', authenticate, cancelPayment)

// Payment Methods
router.get('/methods', authenticate, getPaymentMethods)
router.post('/methods/setup', authenticate, createSetupIntent)
router.post('/methods', authenticate, addPaymentMethod)
router.delete('/methods/:methodId', authenticate, removePaymentMethod)
router.put('/methods/default', authenticate, setDefaultPaymentMethod)

// Payment History
router.get('/history', authenticate, getPaymentHistory)

// ============================================
// Admin Routes
// ============================================

// Refunds (admin only)
router.post('/refund', authenticate, authorize('admin', 'super_admin'), createRefund)

export default router
