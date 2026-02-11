import { Router } from 'express'
import {
  uploadCategoryMedia,
  getCategoryMedia,
  getMediaById,
  updateCategoryMedia,
  deleteCategoryMedia,
} from './category-media.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { upload } from '../../../utils/media'

const router = Router()

// =====================================================
// CATEGORY MEDIA ROUTES
// All routes require authentication
// Upload/Update/Delete require admin role
// =====================================================

// Upload media (image or video) to a category
router.post(
  '/:categoryId/media',
  authenticate,
  authorize('admin', 'super_admin'),
  upload.single('file'),
  uploadCategoryMedia,
)

// Get all media for a category (public)
router.get('/:categoryId/media', getCategoryMedia)

// Get single media item (public)
router.get('/:categoryId/media/:mediaId', getMediaById)

// Update media metadata (alt text, title, position, purpose, etc.)
router.put(
  '/:categoryId/media/:mediaId',
  authenticate,
  authorize('admin', 'super_admin'),
  updateCategoryMedia,
)

// Delete media
router.delete(
  '/:categoryId/media/:mediaId',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteCategoryMedia,
)

export default router
