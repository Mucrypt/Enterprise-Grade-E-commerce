import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { listChannelOrders, getChannelOrder, runOrderImport, listOrderImportIssues, resolveOrderImportIssue } from './channel-order.controller'

const router = Router()

router.use(authenticate)

// Literal paths (/import, /issues, /issues/:issueId/resolve) must be
// registered before the /:orderId wildcard below, or Express would try to
// match them as an orderId value instead.
router.get('/', requirePermissionOrLegacyRole('channels.tiktok.orders', 'admin', 'super_admin'), listChannelOrders)
router.post('/import', requirePermissionOrLegacyRole('channels.tiktok.orders', 'admin', 'super_admin'), runOrderImport)
router.get('/issues', requirePermissionOrLegacyRole('channels.tiktok.orders', 'admin', 'super_admin'), listOrderImportIssues)
router.post('/issues/:issueId/resolve', requirePermissionOrLegacyRole('channels.tiktok.orders', 'admin', 'super_admin'), resolveOrderImportIssue)
router.get('/:orderId', requirePermissionOrLegacyRole('channels.tiktok.orders', 'admin', 'super_admin'), getChannelOrder)

export default router
