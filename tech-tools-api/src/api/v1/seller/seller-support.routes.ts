import { Router } from 'express'
import { requireSellerProfile } from '../../../middleware/seller-auth'
import { sellerSupportSchemas, validate } from '../../../middleware/validation'
import {
  createMyTicket,
  getMyTicket,
  getMyTickets,
  replyToMyTicket,
} from './seller-support.controller'

const router = Router()

router.use(requireSellerProfile)

router.get('/', getMyTickets)
router.post('/', validate(sellerSupportSchemas.createTicket), createMyTicket)
router.get('/:id', getMyTicket)
router.post('/:id/messages', validate(sellerSupportSchemas.reply), replyToMyTicket)

export default router
