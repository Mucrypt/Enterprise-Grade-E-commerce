import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { downloadSourcingExtension } from './sourcing-extension.controller'

const router = Router()

router.use(authenticate)
router.get('/download', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), downloadSourcingExtension)

export default router
