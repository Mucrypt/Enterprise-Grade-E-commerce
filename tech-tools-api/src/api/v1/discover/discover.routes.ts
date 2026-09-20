import { Router } from 'express'
import {
  getAdminDiscoverPosts,
  getAdminDiscoverPostById,
  createDiscoverPost,
  updateDiscoverPost,
  deleteDiscoverPost,
  reorderDiscoverPosts,
  reviewDiscoverPost,
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
import { requireAdminOrOnboardedSeller } from '../../../middleware/seller-auth'
import { upload, handleUploadErrors } from '../../../utils/media'

const router = Router()

const uploadPostMedia = handleUploadErrors(
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'poster', maxCount: 1 },
    { name: 'images', maxCount: 10 },
    { name: 'audio', maxCount: 1 },
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
// Admin + approved sellers -- requireAdminOrOnboardedSeller lets both in,
// then every handler scopes by ownership (a seller only ever sees/edits
// their own posts; admin/staff are unrestricted). Global feed pin/order
// (reorder, review/approval) stays strictly admin-only below.
// =====================================================
router.get('/posts', authenticate, requireAdminOrOnboardedSeller, getAdminDiscoverPosts)
router.post('/posts', authenticate, requireAdminOrOnboardedSeller, uploadPostMedia, createDiscoverPost)
router.put('/posts/reorder', authenticate, authorize('admin', 'super_admin'), reorderDiscoverPosts)
router.get('/posts/:id', authenticate, requireAdminOrOnboardedSeller, getAdminDiscoverPostById)
router.put('/posts/:id', authenticate, requireAdminOrOnboardedSeller, uploadPostMedia, updateDiscoverPost)
router.delete('/posts/:id', authenticate, requireAdminOrOnboardedSeller, deleteDiscoverPost)
router.patch('/posts/:id/review', authenticate, authorize('admin', 'super_admin'), reviewDiscoverPost)

router.post('/posts/:id/products', authenticate, requireAdminOrOnboardedSeller, addPostProducts)
router.delete('/posts/:id/products/:productId', authenticate, requireAdminOrOnboardedSeller, removePostProduct)
router.put('/posts/:id/products/reorder', authenticate, requireAdminOrOnboardedSeller, reorderPostProducts)

export default router
