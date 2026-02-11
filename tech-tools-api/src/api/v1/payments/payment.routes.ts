import { Router } from 'express'
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  getPaymentHistory,
} from './payment.controller'
import { authenticate } from '../../../middleware/auth'

const router = Router()

// All payment routes require authentication
router.use(authenticate)

router.post('/intent', createPaymentIntent)
router.post('/confirm', confirmPayment)
router.get('/methods', getPaymentMethods)
router.post('/methods', addPaymentMethod)
router.delete('/methods/:methodId', removePaymentMethod)
router.get('/history', getPaymentHistory)

export default router
