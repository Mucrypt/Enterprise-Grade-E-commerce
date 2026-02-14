/**
 * Shipping Routes
 * API routes for shipping functionality
 */

import { Router } from 'express'
import { authenticate, authorize } from '../../../middleware/auth'
import {
  getRates,
  trackShipment,
  createShipment,
  validateAddress,
  cancelShipment,
  getCarrierServices,
  getEnabledCarriers,
  getShippingCarriers,
  updateShippingCarrier,
  getShippingSettings,
  updateShippingSettings,
  getOrderLabels,
  calculateShipping,
} from './shipping.controller'

const router = Router()

// =====================================================
// Public / Customer Routes (authenticated)
// =====================================================

// Get shipping rates for checkout
router.post('/rates', authenticate, getRates)

// Calculate shipping for cart
router.post('/calculate', authenticate, calculateShipping)

// Track a shipment
router.get('/track/:carrier/:trackingNumber', authenticate, trackShipment)

// Get available services
router.get('/services', authenticate, getCarrierServices)
router.get('/services/:carrier', authenticate, getCarrierServices)

// Validate address
router.post('/validate-address', authenticate, validateAddress)

// =====================================================
// Admin Routes
// =====================================================

// Get enabled carriers
router.get(
  '/admin/carriers',
  authenticate,
  authorize('admin', 'super_admin'),
  getEnabledCarriers,
)

// Get all carrier configurations
router.get(
  '/admin/carriers/config',
  authenticate,
  authorize('admin', 'super_admin'),
  getShippingCarriers,
)

// Update carrier configuration
router.put(
  '/admin/carriers/:carrierCode',
  authenticate,
  authorize('admin', 'super_admin'),
  updateShippingCarrier,
)

// Get shipping settings
router.get(
  '/admin/settings',
  authenticate,
  authorize('admin', 'super_admin'),
  getShippingSettings,
)

// Update shipping settings
router.put(
  '/admin/settings',
  authenticate,
  authorize('admin', 'super_admin'),
  updateShippingSettings,
)

// Create shipment/label
router.post(
  '/admin/shipments',
  authenticate,
  authorize('admin', 'super_admin'),
  createShipment,
)

// Get order labels
router.get(
  '/admin/orders/:orderId/labels',
  authenticate,
  authorize('admin', 'super_admin'),
  getOrderLabels,
)

// Cancel shipment
router.delete(
  '/admin/shipments/:carrier/:trackingNumber',
  authenticate,
  authorize('admin', 'super_admin'),
  cancelShipment,
)

export default router
