import { Router } from 'express'
import {
  createCategoryCollection,
  getAllCategoryCollections,
  getCategoryCollectionById,
  getCategoryCollectionBySlug,
  updateCategoryCollection,
  deleteCategoryCollection,
  addCategoriesToCollection,
  removeCategoryFromCollection,
  reorderCategoriesInCollection,
} from './category-collections.controller'
import {
  authenticate,
  authenticateIfPresent,
  authorize,
} from '../../../middleware/auth'

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
router.get('/', authenticateIfPresent, getAllCategoryCollections)

// Get single category collection by slug (public storefront page) -- must
// be registered before /:collectionId; it's a distinct two-segment path so
// there's no route-shape collision, but keeping the more specific route
// first matches this file's own convention for the rest.
router.get('/slug/:slug', authenticateIfPresent, getCategoryCollectionBySlug)

// Get single category collection by ID (public)
router.get('/:collectionId', authenticateIfPresent, getCategoryCollectionById)

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
