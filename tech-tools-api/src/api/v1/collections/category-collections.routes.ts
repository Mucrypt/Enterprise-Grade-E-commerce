import { Router } from 'express'
import {
  createCategoryCollection,
  getAllCategoryCollections,
  getCategoryCollectionById,
  updateCategoryCollection,
  deleteCategoryCollection,
  addCategoriesToCollection,
  removeCategoryFromCollection,
  reorderCategoriesInCollection,
} from './category-collections.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// =====================================================
// CATEGORY COLLECTIONS ROUTES
// Public routes: GET
// Protected routes: POST, PUT, DELETE (admin only)
// =====================================================

// Create a new category collection
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  createCategoryCollection,
)

// Get all category collections (public with filters)
router.get('/', getAllCategoryCollections)

// Get single category collection by ID (public)
router.get('/:collectionId', getCategoryCollectionById)

// Update category collection
router.put(
  '/:collectionId',
  authenticate,
  authorize('admin', 'super_admin'),
  updateCategoryCollection,
)

// Delete category collection
router.delete(
  '/:collectionId',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteCategoryCollection,
)

// Add categories to collection
router.post(
  '/:collectionId/categories',
  authenticate,
  authorize('admin', 'super_admin'),
  addCategoriesToCollection,
)

// Remove category from collection
router.delete(
  '/:collectionId/categories/:categoryId',
  authenticate,
  authorize('admin', 'super_admin'),
  removeCategoryFromCollection,
)

// Reorder categories in collection
router.put(
  '/:collectionId/categories/reorder',
  authenticate,
  authorize('admin', 'super_admin'),
  reorderCategoriesInCollection,
)

export default router
