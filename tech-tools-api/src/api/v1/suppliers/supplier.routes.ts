import { Router } from 'express'
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  syncSupplierProducts,
  getSupplierProducts,
  upsertSupplierProductOffer,
  getProductEconomics,
  recomputeProductEconomics,
  evaluateProductAutoPause,
  getAutoPausedProducts,
} from './supplier.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// All supplier routes require admin authentication
router.use(authenticate, authorize('admin', 'super_admin'))

router.get('/products/:productId/economics', getProductEconomics)
router.post('/products/:productId/economics/recompute', recomputeProductEconomics)
router.post('/products/:productId/auto-pause/evaluate', evaluateProductAutoPause)
router.get('/ops/auto-paused', getAutoPausedProducts)

router.get('/', getSuppliers)
router.post('/:id/products/offers', upsertSupplierProductOffer)
router.get('/:id', getSupplierById)
router.post('/', createSupplier)
router.put('/:id', updateSupplier)
router.delete('/:id', deleteSupplier)
router.post('/:id/sync', syncSupplierProducts)
router.get('/:id/products', getSupplierProducts)

export default router
