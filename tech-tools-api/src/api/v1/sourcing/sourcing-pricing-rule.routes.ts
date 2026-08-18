import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { listPricingRules, createPricingRule, updatePricingRule } from './sourcing-pricing-rule.controller'

const router = Router()

router.use(authenticate)
router.get('/', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), listPricingRules)
router.post('/', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), createPricingRule)
router.patch('/:id', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), updatePricingRule)

export default router
