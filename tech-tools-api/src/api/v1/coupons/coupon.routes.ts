/**
 * Coupon Routes
 * API routes for coupon and promotion management
 */

import { Router } from 'express'
import { authenticate, authorize } from '../../../middleware/auth'
import * as couponController from './coupon.controller'

const router = Router()

// =====================================================
// Public Routes
// =====================================================

// Validate a coupon code
router.post('/validate', couponController.validateCoupon)

// =====================================================
// Protected Routes (Authenticated Users)
// =====================================================

// Apply coupon to order
router.post('/apply', authenticate, couponController.applyCoupon)

// =====================================================
// Admin Routes
// =====================================================

// Get all coupons
router.get(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.getCoupons,
)

// Get coupon statistics
router.get(
  '/stats',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.getCouponStats,
)

// Generate bulk coupons
router.post(
  '/generate',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.generateCoupons,
)

// Get coupon by ID
router.get(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.getCouponById,
)

// Create a new coupon
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.createCoupon,
)

// Update a coupon
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.updateCoupon,
)

// Delete a coupon
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.deleteCoupon,
)

// Toggle coupon active status
router.patch(
  '/:id/toggle',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.toggleCouponStatus,
)

// Get coupon usage history
router.get(
  '/:couponId/usage',
  authenticate,
  authorize('admin', 'super_admin'),
  couponController.getCouponUsage,
)

export default router
