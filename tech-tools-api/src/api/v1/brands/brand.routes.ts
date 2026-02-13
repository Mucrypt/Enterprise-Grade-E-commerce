import { Router } from 'express'
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} from './brand.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// Public routes
router.get('/', getBrands)
router.get('/:id', getBrandById)

// Admin routes
router.post('/', authenticate, authorize('admin'), createBrand)
router.put('/:id', authenticate, authorize('admin'), updateBrand)
router.delete('/:id', authenticate, authorize('admin'), deleteBrand)

export default router
