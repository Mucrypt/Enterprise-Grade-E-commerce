import { Router } from 'express'
import {
  createProductCollection,
  getAllProductCollections,
  getProductCollectionById,
  updateProductCollection,
  deleteProductCollection,
  addProductsToCollection,
  removeProductFromCollection,
  reorderProductsInCollection,
} from './product-collections.controller'
import {
  authenticate,
  authenticateIfPresent,
  authorize,
} from '../../../middleware/auth'
import { upload, handleUploadErrors } from '../../../utils/media'

const router = Router()

// =====================================================
// PRODUCT COLLECTIONS ROUTES
// Public routes: GET
// Protected routes: POST, PUT, DELETE (admin only)
// =====================================================

// Create a new product collection -- multer runs before the controller so
// req.files.image/req.files.banner (if provided) are ready for
// processCollectionImage; a plain JSON body (no files) still works exactly
// as before, upload.fields() is a no-op when the request isn't multipart.
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  handleUploadErrors(
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ]),
  ),
  createProductCollection,
)

// Get all product collections (public with filters)
router.get('/', authenticateIfPresent, getAllProductCollections)

// Get single product collection by ID (public)
router.get('/:collectionId', authenticateIfPresent, getProductCollectionById)

// Update product collection
router.put(
  '/:collectionId',
  authenticate,
  authorize('admin', 'super_admin'),
  handleUploadErrors(
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ]),
  ),
  updateProductCollection,
)

// Delete product collection
router.delete(
  '/:collectionId',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteProductCollection,
)

// Add products to collection
router.post(
  '/:collectionId/products',
  authenticate,
  authorize('admin', 'super_admin'),
  addProductsToCollection,
)

// Remove product from collection
router.delete(
  '/:collectionId/products/:productId',
  authenticate,
  authorize('admin', 'super_admin'),
  removeProductFromCollection,
)

// Reorder products in collection
router.put(
  '/:collectionId/products/reorder',
  authenticate,
  authorize('admin', 'super_admin'),
  reorderProductsInCollection,
)

export default router
