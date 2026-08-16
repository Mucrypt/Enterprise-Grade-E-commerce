import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { listProductMappings, previewSync, commitSync, listInventoryDiffs, runDiff } from './channel-product.controller'

const router = Router()

router.use(authenticate)

// channels.tiktok.products is CATALOG_MANAGER's in-remit grant for this
// exact work (product/SKU mapping and inventory diffing) -- preview,
// commit, AND the inventory diff all live here, not behind the broader
// channels.tiktok.manage (reserved for cross-cutting/administrative sync
// operations, not routine catalog work).
router.get('/', requirePermissionOrLegacyRole('channels.tiktok.products', 'admin', 'super_admin'), listProductMappings)
router.post('/preview-sync', requirePermissionOrLegacyRole('channels.tiktok.products', 'admin', 'super_admin'), previewSync)
router.post('/commit-sync', requirePermissionOrLegacyRole('channels.tiktok.products', 'admin', 'super_admin'), commitSync)
router.get('/inventory-diffs', requirePermissionOrLegacyRole('channels.tiktok.products', 'admin', 'super_admin'), listInventoryDiffs)
router.post('/inventory-diff', requirePermissionOrLegacyRole('channels.tiktok.products', 'admin', 'super_admin'), runDiff)

export default router
