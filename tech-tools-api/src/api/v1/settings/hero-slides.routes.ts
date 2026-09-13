import { Router } from 'express'
import {
  getAdminHeroSlides,
  getAdminHeroSlideById,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  reorderHeroSlides,
  addHeroSlideItems,
  removeHeroSlideItem,
  reorderHeroSlideItems,
  addHeroSlideCollections,
  removeHeroSlideCollection,
  reorderHeroSlideCollections,
  getPublicHeroSlides,
} from './hero-slides.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { upload, handleUploadErrors } from '../../../utils/media'

const router = Router()

// =====================================================
// HERO SLIDES ROUTES
// Public: GET /public
// Admin (authenticate + authorize): everything else
// =====================================================

// Public -- the one endpoint both storefronts call
router.get('/public', getPublicHeroSlides)

// Admin list (all slides, any active/schedule state)
router.get('/', authenticate, authorize('admin', 'super_admin'), getAdminHeroSlides)

// Create -- multer runs before the controller so req.files.image (if
// provided) is ready for processHeroSlideImage; a plain JSON body (no
// files) still works exactly as before.
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  handleUploadErrors(upload.fields([{ name: 'image', maxCount: 1 }])),
  createHeroSlide,
)

// Reorder -- must be registered before '/:id' so 'reorder' isn't parsed as an id
router.put('/reorder', authenticate, authorize('admin', 'super_admin'), reorderHeroSlides)

// Get one slide, with its grid items/collections if any (used by the
// items/collections manager panels)
router.get('/:id', authenticate, authorize('admin', 'super_admin'), getAdminHeroSlideById)

// Update
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  handleUploadErrors(upload.fields([{ name: 'image', maxCount: 1 }])),
  updateHeroSlide,
)

// Delete
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), deleteHeroSlide)

// product_grid items
router.post('/:id/items', authenticate, authorize('admin', 'super_admin'), addHeroSlideItems)
router.delete('/:id/items/:productId', authenticate, authorize('admin', 'super_admin'), removeHeroSlideItem)
router.put('/:id/items/reorder', authenticate, authorize('admin', 'super_admin'), reorderHeroSlideItems)

// collection_grid collections
router.post('/:id/collections', authenticate, authorize('admin', 'super_admin'), addHeroSlideCollections)
router.delete('/:id/collections/:collectionId', authenticate, authorize('admin', 'super_admin'), removeHeroSlideCollection)
router.put('/:id/collections/reorder', authenticate, authorize('admin', 'super_admin'), reorderHeroSlideCollections)

export default router
