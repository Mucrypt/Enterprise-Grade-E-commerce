import { Router } from 'express'
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  syncSupplierProducts,
  getSupplierProducts,
  upsertSupplierProductOffer,
  getProductEconomics,
  recomputeProductEconomics,
  evaluateProductAutoPause,
  getAutoPausedProducts,
} from './supplier.controller'
import {
  csvUpload,
  previewSupplierImport,
  commitSupplierImport,
} from './supplier-import.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'

const router = Router()

router.use(authenticate)

// Product-cost-economics/auto-pause endpoints have no country dimension --
// products aren't scoped by market anywhere in the current schema, so
// granting these under a market-scoped permission (e.g. suppliers.manage)
// would grant a MARKET_MANAGER *global* product-economics access, not
// market-limited access. Left legacy-admin-only rather than pretending a
// scope that doesn't exist; not part of ADMIN-2A.5's supplier-scoping
// requirement (see docs/ADMIN-2A5-STAFF-ACCESS-INTEGRATION-REPORT.md).
router.get(
  '/products/:productId/economics',
  authorize('admin', 'super_admin'),
  getProductEconomics,
)
router.post(
  '/products/:productId/economics/recompute',
  authorize('admin', 'super_admin'),
  recomputeProductEconomics,
)
router.post(
  '/products/:productId/auto-pause/evaluate',
  authorize('admin', 'super_admin'),
  evaluateProductAutoPause,
)
router.get('/ops/auto-paused', authorize('admin', 'super_admin'), getAutoPausedProducts)

// Supplier CRUD/products/import. Market-scope filtering and the :id-route
// IDOR guard happen inside the controllers themselves (see
// assertSupplierInScope/applyMarketScope in supplier.controller.ts and
// supplier-import.controller.ts), not here -- same pattern as
// order.routes.ts.
router.get(
  '/',
  requirePermissionOrLegacyRole('suppliers.view', 'admin', 'super_admin'),
  getSuppliers,
)
router.post(
  '/:id/products/offers',
  requirePermissionOrLegacyRole('suppliers.manage', 'admin', 'super_admin'),
  upsertSupplierProductOffer,
)
router.post(
  '/:id/import/preview',
  requirePermissionOrLegacyRole('suppliers.import', 'admin', 'super_admin'),
  csvUpload.single('file'),
  previewSupplierImport,
)
router.post(
  '/:id/import/:batchId/commit',
  requirePermissionOrLegacyRole('suppliers.import', 'admin', 'super_admin'),
  commitSupplierImport,
)
router.get(
  '/:id',
  requirePermissionOrLegacyRole('suppliers.view', 'admin', 'super_admin'),
  getSupplierById,
)
router.post(
  '/',
  requirePermissionOrLegacyRole('suppliers.manage', 'admin', 'super_admin'),
  createSupplier,
)
router.put(
  '/:id',
  requirePermissionOrLegacyRole('suppliers.manage', 'admin', 'super_admin'),
  updateSupplier,
)
router.delete(
  '/:id',
  requirePermissionOrLegacyRole('suppliers.manage', 'admin', 'super_admin'),
  deleteSupplier,
)
router.post(
  '/:id/sync',
  requirePermissionOrLegacyRole('suppliers.manage', 'admin', 'super_admin'),
  syncSupplierProducts,
)
router.get(
  '/:id/products',
  requirePermissionOrLegacyRole('suppliers.view', 'admin', 'super_admin'),
  getSupplierProducts,
)

export default router
