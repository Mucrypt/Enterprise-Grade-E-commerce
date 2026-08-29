import { Router } from 'express'
import {
  trackClick,
  getPublicSettings,
  getOrCreateMyProfile,
  getMyStats,
  getMyStoreCredit,
  listAffiliates,
  getAffiliateConversions,
  updateAffiliateStatus,
  getSettings,
  updateSettings,
  getStoreCreditLedger,
} from './affiliate.controller'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'

const router = Router()

// Public -- no auth. Fire-and-forget click tracking + the honest public
// rate shown on the storefront and the /affiliates marketing page.
router.post('/click', trackClick)
router.get('/settings/public', getPublicSettings)

// Customer self-serve (any signed-in user -- enrollment is automatic,
// no approval step, per the program's design).
router.get('/me', authenticate, getOrCreateMyProfile)
router.get('/me/stats', authenticate, getMyStats)
router.get('/me/store-credit', authenticate, getMyStoreCredit)

// Admin
router.get(
  '/admin/list',
  authenticate,
  requirePermissionOrLegacyRole('affiliates.view', 'admin', 'super_admin'),
  listAffiliates,
)
router.get(
  '/admin/:id/conversions',
  authenticate,
  requirePermissionOrLegacyRole('affiliates.view', 'admin', 'super_admin'),
  getAffiliateConversions,
)
router.patch(
  '/admin/:id/status',
  authenticate,
  requirePermissionOrLegacyRole('affiliates.manage', 'admin', 'super_admin'),
  updateAffiliateStatus,
)
router.get(
  '/admin/settings',
  authenticate,
  requirePermissionOrLegacyRole('affiliates.view', 'admin', 'super_admin'),
  getSettings,
)
router.put(
  '/admin/settings',
  authenticate,
  requirePermissionOrLegacyRole('affiliates.manage', 'admin', 'super_admin'),
  updateSettings,
)
router.get(
  '/admin/ledger',
  authenticate,
  requirePermissionOrLegacyRole('affiliates.payouts', 'admin', 'super_admin'),
  getStoreCreditLedger,
)

export default router
