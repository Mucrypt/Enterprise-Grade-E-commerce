import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import {
  createMyBook,
  getCreatorProfileByHandle,
  getMyCreatorProfile,
  upsertMyCreatorProfile,
} from './creator.controller'

const router = Router()

router.get('/profiles/:handle', getCreatorProfileByHandle)

router.get('/profile/me', authenticate, getMyCreatorProfile)
router.put('/profile/me', authenticate, upsertMyCreatorProfile)

router.post('/books', authenticate, createMyBook)

export default router