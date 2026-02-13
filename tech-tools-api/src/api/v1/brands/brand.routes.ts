import { Router } from 'express'
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} from './brand.controller'
import { authenticateToken, requireRole } from '../../../middleware/auth'

const router = Router()

// Public routes
router.get('/', getBrands)
router.get('/:id', getBrandById)

// Admin routes
router.post('/', authenticateToken, requireRole(['admin']), createBrand)
router.put('/:id', authenticateToken, requireRole(['admin']), updateBrand)
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteBrand)

export default router
