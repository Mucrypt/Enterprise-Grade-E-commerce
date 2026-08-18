import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { issueSourcingToken, listSourcingTokens, revokeSourcingToken } from './sourcing-token.controller'

const router = Router()

router.use(authenticate)
router.post('/', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), issueSourcingToken)
router.get('/', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), listSourcingTokens)
router.delete('/:id', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), revokeSourcingToken)

export default router
