import { Router } from 'express'
import {
  getAdminDiscoverPosts,
  getAdminDiscoverPostById,
  createDiscoverPost,
  updateDiscoverPost,
  deleteDiscoverPost,
  reorderDiscoverPosts,
  addPostProducts,
  removePostProduct,
  reorderPostProducts,
  getDiscoverFeed,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  trackShare,
  trackAddToCart,
} from './discover.controller'
import { authenticate, authenticateIfPresent, authorize } from '../../../middleware/auth'
import { upload, handleUploadErrors } from '../../../utils/media'

const router = Router()

const uploadPostMedia = handleUploadErrors(
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'poster', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
)

// =====================================================
// Public -- authenticateIfPresent so a signed-in viewer's isLiked/isSaved
// state resolves, while a guest still gets the feed (no fabricated state).
// =====================================================
router.get('/feed', authenticateIfPresent, getDiscoverFeed)

// Interactions require a real account (per-user like/save rows).
router.post('/posts/:id/like', authenticate, likePost)
router.delete('/posts/:id/like', authenticate, unlikePost)
router.post('/posts/:id/save', authenticate, savePost)
router.delete('/posts/:id/save', authenticate, unsavePost)
router.post('/posts/:id/share', trackShare)
router.post('/posts/:id/add-to-cart', trackAddToCart)

// =====================================================
// Admin
// =====================================================
router.get('/posts', authenticate, authorize('admin', 'super_admin'), getAdminDiscoverPosts)
router.post('/posts', authenticate, authorize('admin', 'super_admin'), uploadPostMedia, createDiscoverPost)
router.put('/posts/reorder', authenticate, authorize('admin', 'super_admin'), reorderDiscoverPosts)
router.get('/posts/:id', authenticate, authorize('admin', 'super_admin'), getAdminDiscoverPostById)
router.put('/posts/:id', authenticate, authorize('admin', 'super_admin'), uploadPostMedia, updateDiscoverPost)
router.delete('/posts/:id', authenticate, authorize('admin', 'super_admin'), deleteDiscoverPost)

router.post('/posts/:id/products', authenticate, authorize('admin', 'super_admin'), addPostProducts)
router.delete('/posts/:id/products/:productId', authenticate, authorize('admin', 'super_admin'), removePostProduct)
router.put('/posts/:id/products/reorder', authenticate, authorize('admin', 'super_admin'), reorderPostProducts)

export default router
