import { Router } from 'express'
import {
  createCategoryAttribute,
  updateCategoryAttribute,
  deleteCategoryAttribute,
} from './category-attribute.controller'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { authenticate } from '../../../middleware/auth'

const router = Router()

// The public read (GET /categories/:id/attributes) lives on
// category.routes.ts, next to the other /:id/* category reads. This
// router only holds the admin write surface.
router.use(authenticate)

router.post('/', requirePermissionOrLegacyRole('catalog.manage', 'admin', 'super_admin'), createCategoryAttribute)
router.patch('/:id', requirePermissionOrLegacyRole('catalog.manage', 'admin', 'super_admin'), updateCategoryAttribute)
router.delete('/:id', requirePermissionOrLegacyRole('catalog.manage', 'admin', 'super_admin'), deleteCategoryAttribute)

export default router
