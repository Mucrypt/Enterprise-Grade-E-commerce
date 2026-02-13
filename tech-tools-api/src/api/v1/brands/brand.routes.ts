import { Router } from 'express'
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  bulkUpdateBrands,
  bulkDeleteBrands,
} from './brand.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// Public routes
router.get('/', getBrands)
router.get('/:id', getBrandById)

// Admin bulk routes (must be before /:id routes)
router.post('/bulk/update', authenticate, authorize('admin'), bulkUpdateBrands)
router.post('/bulk/delete', authenticate, authorize('admin'), bulkDeleteBrands)

// Admin routes
router.post('/', authenticate, authorize('admin'), createBrand)
router.put('/:id', authenticate, authorize('admin'), updateBrand)
router.delete('/:id', authenticate, authorize('admin'), deleteBrand)

export default router
