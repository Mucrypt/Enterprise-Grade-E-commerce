import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import {
  createMyBook,
  getCreatorDashboardActivity,
  getCreatorDashboardMetrics,
  getCreatorProfileByHandle,
  getMyCreatorProfile,
  submitMyBookForReview,
  upsertMyCreatorProfile,
  uploadMyBookAssets,
} from './creator.controller'
import { uploadBookAssets } from '../../../utils/media'

const router = Router()

router.get('/profiles/:handle', getCreatorProfileByHandle)

router.get('/profile/me', authenticate, getMyCreatorProfile)
router.put('/profile/me', authenticate, upsertMyCreatorProfile)

router.post('/books', authenticate, createMyBook)
router.post(
  '/books/:bookId/assets',
  authenticate,
  uploadBookAssets.array('files', 10),
  uploadMyBookAssets,
)
router.post('/books/:bookId/submit', authenticate, submitMyBookForReview)
router.get('/dashboard/metrics', authenticate, getCreatorDashboardMetrics)
router.get('/dashboard/activity', authenticate, getCreatorDashboardActivity)

export default router
