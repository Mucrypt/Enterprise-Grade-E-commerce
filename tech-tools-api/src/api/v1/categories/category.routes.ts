import { Router } from 'express'
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
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
  updateCategory,
)
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteCategory,
)

export default router
