import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import {
  listStaff,
  getStaffById,
  getMyStaffContext,
  grantStaffMembership,
  updateStaffRole,
  updateMarketScope,
  suspendStaffMembership,
  reactivateStaffMembership,
  revokeStaffMembership,
  getStaffAuditLog,
} from './staff.controller'
import { getGlobalActivityFeed } from '../admin/admin.controller'

const router = Router()

router.use(authenticate)

// Self-service -- any authenticated user (customer or staff) can check
// their own staff status. No permission gate: this is how the
// admin-dashboard frontend decides what nav/pages to even attempt to show.
router.get('/me', getMyStaffContext)

// Must be registered before the /:id routes below -- a bare :id param
// would otherwise swallow the literal 'activity-feed' segment first.
// Reuses staff.view, the same permission that already gates the
// per-staff audit log just below.
router.get(
  '/activity-feed',
  requirePermissionOrLegacyRole('staff.view', 'super_admin'),
  getGlobalActivityFeed,
)

// Everything below requires either the legacy 'super_admin' user_type
// (bootstrap + ongoing, see requirePermissionOrLegacyRole's doc comment)
// or the matching staff permission. Mutation-specific rules (no self-
// escalation, role-authority-rank checks, last-OWNER/SUPER_ADMIN guard)
// are enforced inside the controllers, not here.
router.get('/', requirePermissionOrLegacyRole('staff.view', 'super_admin'), listStaff)
router.get('/:id', requirePermissionOrLegacyRole('staff.view', 'super_admin'), getStaffById)
router.get(
  '/:id/audit-log',
  requirePermissionOrLegacyRole('staff.view', 'super_admin'),
  getStaffAuditLog,
)

router.post('/', requirePermissionOrLegacyRole('staff.grant', 'super_admin'), grantStaffMembership)
router.patch(
  '/:id/role',
  requirePermissionOrLegacyRole('staff.manage', 'super_admin'),
  updateStaffRole,
)
router.patch(
  '/:id/market-scope',
  requirePermissionOrLegacyRole('staff.manage', 'super_admin'),
  updateMarketScope,
)
router.post(
  '/:id/suspend',
  requirePermissionOrLegacyRole('staff.manage', 'super_admin'),
  suspendStaffMembership,
)
router.post(
  '/:id/reactivate',
  requirePermissionOrLegacyRole('staff.manage', 'super_admin'),
  reactivateStaffMembership,
)
router.post(
  '/:id/revoke',
  requirePermissionOrLegacyRole('staff.revoke', 'super_admin'),
  revokeStaffMembership,
)

export default router
