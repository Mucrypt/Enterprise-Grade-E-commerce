import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import {
  listConnections,
  getCapabilities,
  startOAuth,
  completeOAuth,
  disconnectConnection,
  disableConnection,
} from './social-connection.controller'

const router = Router()

router.use(authenticate)

// Capabilities are non-secret, informational, and useful to anyone who can
// see the Promotions area at all (drives the composer's channel picker) --
// gated by the lighter social.view, not social.accounts.view.
router.get('/capabilities', requirePermissionOrLegacyRole('social.view', 'admin', 'super_admin'), getCapabilities)

// Connecting/disconnecting/disabling a platform account is a materially
// more sensitive action than viewing campaign performance -- gated by the
// separate social.accounts.* permissions (OWNER/SUPER_ADMIN only this
// phase, see staff-permissions.config.ts), never social.publish/manage.
router.get('/', requirePermissionOrLegacyRole('social.accounts.view', 'admin', 'super_admin'), listConnections)
router.post('/:platform/oauth/start', requirePermissionOrLegacyRole('social.accounts.manage', 'admin', 'super_admin'), startOAuth)
router.post('/oauth/callback', requirePermissionOrLegacyRole('social.accounts.manage', 'admin', 'super_admin'), completeOAuth)
router.delete('/:id', requirePermissionOrLegacyRole('social.accounts.manage', 'admin', 'super_admin'), disconnectConnection)
router.post('/:id/disable', requirePermissionOrLegacyRole('social.accounts.manage', 'admin', 'super_admin'), disableConnection)

export default router
