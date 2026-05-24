import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../../middleware/auth'
import { creatorSchemas, validate } from '../../../middleware/validation'
import {
  createMyBook,
  getCreatorAuditLogs,
  getCreatorDashboardActivity,
  getCreatorDashboardMetrics,
  getCreatorProducts,
  getCreatorProfileByHandle,
  getMyCreatorProfile,
  submitMyBookForReview,
  updateCreatorProduct,
  upsertMyCreatorProfile,
  uploadMyBookAssets,
} from './creator.controller'
import { uploadBookAssets } from '../../../utils/media'

const router = Router()

// Rate limit for creator write operations (product updates, price changes)
const creatorWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many creator requests. Please slow down.',
  },
})

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

// Creator product catalog management
router.get('/products', authenticate, getCreatorProducts)
router.patch(
  '/products/:productId',
  authenticate,
  creatorWriteLimiter,
  validate(creatorSchemas.updateProduct),
  updateCreatorProduct,
)

// Creator audit trail (read-only self-service)
router.get('/audit-logs', authenticate, getCreatorAuditLogs)

export default router
