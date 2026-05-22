import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import {
  getMyLibrary,
  getSignedAccessUrl,
  resolveSignedAccess,
  updateReadingProgress,
} from './library.controller'

const router = Router()

router.get('/access/:assetId', resolveSignedAccess)
router.get('/me', authenticate, getMyLibrary)
router.get('/me/:productId/access-url', authenticate, getSignedAccessUrl)
router.put('/me/:productId/progress', authenticate, updateReadingProgress)

export default router
