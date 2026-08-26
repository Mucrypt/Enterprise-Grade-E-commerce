import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { listDeliveryTemplates, createDeliveryTemplate, updateDeliveryTemplate, deleteDeliveryTemplate } from './delivery-template.controller'

const router = Router()

router.use(authenticate)
router.get('/', requirePermissionOrLegacyRole('shipping.view', 'admin', 'super_admin'), listDeliveryTemplates)
router.post('/', requirePermissionOrLegacyRole('shipping.manage', 'admin', 'super_admin'), createDeliveryTemplate)
router.patch('/:id', requirePermissionOrLegacyRole('shipping.manage', 'admin', 'super_admin'), updateDeliveryTemplate)
router.delete('/:id', requirePermissionOrLegacyRole('shipping.manage', 'admin', 'super_admin'), deleteDeliveryTemplate)

export default router
