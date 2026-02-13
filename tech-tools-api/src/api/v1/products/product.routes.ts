import { Router } from 'express'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  bulkDeleteProducts,
  bulkUpdateProducts,
  getProductVariations,
  addProductVariation,
  updateProductVariation,
  deleteProductVariation,
  searchProducts,
} from './product.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { validate } from '../../../middleware/validation'
import { productSchemas } from '../../../middleware/validation'
import { upload } from '../../../utils/media'

const router = Router()

// Public routes
router.get('/', getProducts)
router.get('/search', searchProducts)
router.get('/:id', getProductById)
router.get('/:id/variations', getProductVariations)

// Protected routes (admin only)
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 3 },
  ]),
  validate(productSchemas.create),
  createProduct,
)

// Bulk operations (must come before :id routes)
router.post(
  '/bulk/delete',
  authenticate,
  authorize('admin', 'super_admin'),
  bulkDeleteProducts,
)
router.post(
  '/bulk/update',
  authenticate,
  authorize('admin', 'super_admin'),
  bulkUpdateProducts,
)

router.put(
  '/:productId',
  authenticate,
  authorize('admin', 'super_admin'),
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 3 },
  ]),
  validate(productSchemas.update),
  updateProduct,
)
router.delete(
  '/:productId',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteProduct,
)
router.post(
  '/:productId/restore',
  authenticate,
  authorize('admin', 'super_admin'),
  restoreProduct,
)
router.post(
  '/:id/variations',
  authenticate,
  authorize('admin', 'super_admin'),
  addProductVariation,
)
router.put(
  '/:id/variations/:variationId',
  authenticate,
  authorize('admin', 'super_admin'),
  updateProductVariation,
)
router.delete(
  '/:id/variations/:variationId',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteProductVariation,
)

export default router
