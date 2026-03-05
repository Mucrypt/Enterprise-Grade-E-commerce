// ============================================
// Blog Routes - Production Ready
// ============================================

import { Router } from 'express'
import { authenticate, authorize } from '../../../middleware/auth'
import { upload } from '../../../utils/media'
import {
  // Public endpoints
  getPublishedPosts,
  getPostBySlug,
  recordPostView,
  getRelatedPosts,
  getPublicCategories,
  getPublicTags,
  getPublicAuthors,
  getAuthorBySlug,
  // Admin post endpoints
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  // Admin category endpoints
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Admin tag endpoints
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  // Admin author endpoints
  getAllAuthors,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  // Media endpoints
  uploadPostMedia,
  getPostMedia,
  deletePostMedia,
  // Dashboard
  getBlogStats,
} from './blog.controller'

const router = Router()

// ============================================
// PUBLIC ROUTES
// ============================================

// Posts
router.get('/posts', getPublishedPosts)
router.get('/posts/:slug', getPostBySlug)
router.post('/posts/:slug/view', recordPostView)
router.get('/posts/:slug/related', getRelatedPosts)

// Categories
router.get('/categories', getPublicCategories)

// Tags
router.get('/tags', getPublicTags)

// Authors
router.get('/authors', getPublicAuthors)
router.get('/authors/:slug', getAuthorBySlug)

// ============================================
// ADMIN ROUTES - Requires authentication
// ============================================

// Admin authorization middleware
const adminAuth = authorize('admin', 'super_admin')

// Dashboard stats
router.get('/admin/stats', authenticate, adminAuth, getBlogStats)

// Admin Posts
router.get('/admin/posts', authenticate, adminAuth, getAllPosts)
router.get('/admin/posts/:id', authenticate, adminAuth, getPostById)
router.post('/admin/posts', authenticate, adminAuth, createPost)
router.put('/admin/posts/:id', authenticate, adminAuth, updatePost)
router.delete('/admin/posts/:id', authenticate, adminAuth, deletePost)

// Admin Post Media
router.get('/admin/posts/:postId/media', authenticate, adminAuth, getPostMedia)
router.post(
  '/admin/posts/:postId/media',
  authenticate,
  adminAuth,
  upload.single('file'),
  uploadPostMedia,
)
router.delete(
  '/admin/posts/:postId/media/:mediaId',
  authenticate,
  adminAuth,
  deletePostMedia,
)

// Admin Categories
router.get('/admin/categories', authenticate, adminAuth, getAllCategories)
router.post('/admin/categories', authenticate, adminAuth, createCategory)
router.put('/admin/categories/:id', authenticate, adminAuth, updateCategory)
router.delete('/admin/categories/:id', authenticate, adminAuth, deleteCategory)

// Admin Tags
router.get('/admin/tags', authenticate, adminAuth, getAllTags)
router.post('/admin/tags', authenticate, adminAuth, createTag)
router.put('/admin/tags/:id', authenticate, adminAuth, updateTag)
router.delete('/admin/tags/:id', authenticate, adminAuth, deleteTag)

// Admin Authors
router.get('/admin/authors', authenticate, adminAuth, getAllAuthors)
router.post('/admin/authors', authenticate, adminAuth, createAuthor)
router.put('/admin/authors/:id', authenticate, adminAuth, updateAuthor)
router.delete('/admin/authors/:id', authenticate, adminAuth, deleteAuthor)

export default router
