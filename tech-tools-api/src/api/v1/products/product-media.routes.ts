import { Router } from 'express'
import {
  uploadProductMedia,
  getProductMedia,
  getMediaById,
  updateProductMedia,
  deleteProductMedia,
  reorderProductMedia,
  setPrimaryImage,
} from './product-media.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { upload } from '../../../utils/media'

const router = Router()

// =====================================================
// PRODUCT MEDIA ROUTES
// All routes require authentication
// Upload/Update/Delete require admin role
// =====================================================

// Upload media (image or video) to a product
router.post(
  '/:productId/media',
  authenticate,
  authorize('admin', 'super_admin'),
  upload.single('file'),
  uploadProductMedia,
)

// Get all media for a product (public)
router.get('/:productId/media', getProductMedia)

// Reorder media items (must be before /:mediaId routes)
router.put(
  '/:productId/media/reorder',
  authenticate,
  authorize('admin', 'super_admin'),
  reorderProductMedia,
)

// Get single media item (public)
router.get('/:productId/media/:mediaId', getMediaById)

// Update media metadata (alt text, title, position, etc.)
router.put(
  '/:productId/media/:mediaId',
  authenticate,
  authorize('admin', 'super_admin'),
  updateProductMedia,
)

// Delete media
router.delete(
  '/:productId/media/:mediaId',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteProductMedia,
)

// Set primary image for product
router.put(
  '/:productId/media/:mediaId/set-primary',
  authenticate,
  authorize('admin', 'super_admin'),
  setPrimaryImage,
)

export default router
