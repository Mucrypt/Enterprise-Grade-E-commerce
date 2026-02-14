/**
 * Review Routes
 * API routes for product reviews and ratings
 */

import { Router } from 'express'
import { authenticate, authorize } from '../../../middleware/auth'
import * as reviewController from './review.controller'

const router = Router()

// Public routes
router.get('/product/:productId', reviewController.getProductReviews)

// Protected routes (authenticated users)
router.post('/', authenticate, reviewController.createReview)
router.post('/:id/helpful', authenticate, reviewController.markHelpful)
router.post('/:id/report', authenticate, reviewController.reportReview)

// Admin routes
router.get(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.getReviews,
)
router.get(
  '/stats',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.getReviewStats,
)
router.get(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.getReviewById,
)
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.updateReview,
)
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.deleteReview,
)

// Moderation routes
router.post(
  '/:id/approve',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.approveReview,
)
router.post(
  '/:id/reject',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.rejectReview,
)
router.post(
  '/:id/response',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.addResponse,
)
router.post(
  '/:id/featured',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.toggleFeatured,
)

// Bulk actions
router.post(
  '/bulk/approve',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.bulkApprove,
)
router.post(
  '/bulk/reject',
  authenticate,
  authorize('admin', 'super_admin'),
  reviewController.bulkReject,
)

export default router
