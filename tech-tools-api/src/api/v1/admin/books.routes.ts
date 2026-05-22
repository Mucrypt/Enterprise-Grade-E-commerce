import { Router } from 'express'
import { authenticate, authorize } from '../../../middleware/auth'
import {
  approveBook,
  getBooksReviewQueue,
  rejectBook,
} from './books.controller'

const router = Router()

router.use(authenticate, authorize('admin', 'super_admin'))

router.get('/review-queue', getBooksReviewQueue)
router.post('/:bookId/approve', approveBook)
router.post('/:bookId/reject', rejectBook)

export default router
