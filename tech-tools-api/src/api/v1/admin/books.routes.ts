import { Router } from 'express'
import { authenticate, authorize } from '../../../middleware/auth'
import rateLimit from 'express-rate-limit'
import { adminBookSchemas, validate } from '../../../middleware/validation'
import {
  approveBook,
  createAdminBook,
  getBooksReviewQueue,
  publishAdminBook,
  rejectBook,
  submitAdminBookForReview,
  uploadAdminBookAssets,
} from './books.controller'
import { uploadBookAssets } from '../../../utils/media'

const router = Router()

const adminBookWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many admin book write requests. Please try again shortly.',
  },
})

router.use(authenticate, authorize('admin', 'super_admin'))

router.get('/review-queue', getBooksReviewQueue)
router.post(
  '/',
  adminBookWriteLimiter,
  validate(adminBookSchemas.createBook),
  createAdminBook,
)
router.post(
  '/:bookId/assets',
  adminBookWriteLimiter,
  uploadBookAssets.array('files', 10),
  uploadAdminBookAssets,
)
router.post(
  '/:bookId/submit',
  adminBookWriteLimiter,
  validate(adminBookSchemas.submitBook),
  submitAdminBookForReview,
)
router.post(
  '/:bookId/publish',
  adminBookWriteLimiter,
  validate(adminBookSchemas.publishBook),
  publishAdminBook,
)
router.post('/:bookId/approve', approveBook)
router.post('/:bookId/reject', rejectBook)

export default router
