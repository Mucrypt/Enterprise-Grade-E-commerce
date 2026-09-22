import { Router } from 'express'
import { getCurrencyRates } from './currency.controller'

const router = Router()

// Public -- no authenticate() in front, matches product.routes.ts's
// public GET pattern.
router.get('/rates', getCurrencyRates)

export default router
