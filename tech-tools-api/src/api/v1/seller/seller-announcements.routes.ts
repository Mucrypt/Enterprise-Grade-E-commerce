import { Router } from 'express'
import { requireSellerProfile } from '../../../middleware/seller-auth'
import { getMyAnnouncements, markMyAnnouncementRead } from './seller-announcements.controller'

const router = Router()

router.use(requireSellerProfile)

router.get('/', getMyAnnouncements)
router.post('/:id/read', markMyAnnouncementRead)

export default router
