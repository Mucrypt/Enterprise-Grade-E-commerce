import { Router } from 'express'
import {
  getAdminHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  reorderHeroSlides,
  addHeroSlideItems,
  removeHeroSlideItem,
  reorderHeroSlideItems,
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

export default router
