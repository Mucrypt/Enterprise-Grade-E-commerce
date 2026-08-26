import { Router } from 'express'
import { getDeliveryEstimate } from './delivery-estimate.controller'

const router = Router()

// Public, no auth -- must work for anonymous storefront visitors.
router.get('/', getDeliveryEstimate)

export default router
