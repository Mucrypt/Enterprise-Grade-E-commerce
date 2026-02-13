import { Router } from 'express'
import {
  getCategories,
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteCategoryMedia,
  restoreCategory,
  getCategoryProducts,
} from './category.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { upload } from '../../../utils/media'

const router = Router()

// Public routes
router.get('/', getCategories)
router.get('/:id', getCategoryById)
router.get('/:id/products', getCategoryProducts)

// Protected routes (admin only)
router.get(
  '/admin/all',
  authenticate,
  authorize('admin', 'super_admin'),
  getAllCategories,
)

router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'icon', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  createCategory,
)

router.put(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'icon', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  updateCategory,
)

router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteCategory,
)

router.delete(
  '/:id/media/:mediaId',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteCategoryMedia,
)

router.post(
  '/:id/restore',
  authenticate,
  authorize('admin', 'super_admin'),
  restoreCategory,
)

export default router
