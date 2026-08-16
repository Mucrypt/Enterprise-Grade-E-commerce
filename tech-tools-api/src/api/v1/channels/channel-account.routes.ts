import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import {
  listChannelAccounts,
  getCapabilities,
  startChannelOAuth,
  completeChannelOAuth,
  disconnectChannelAccount,
  disableChannelAccount,
} from './channel-account.controller'

const router = Router()

router.use(authenticate)

// Capabilities are non-secret, informational -- gated by the lighter
// channels.tiktok.view, not channels.tiktok.connections.
router.get('/capabilities', requirePermissionOrLegacyRole('channels.tiktok.view', 'admin', 'super_admin'), getCapabilities)

// Connecting/disconnecting/disabling a channel account is a materially
// more sensitive action than viewing orders/products -- gated by the
// separate channels.tiktok.connections permission (OWNER/SUPER_ADMIN only
// this phase, see staff-permissions.config.ts), never
// channels.tiktok.manage/orders/products.
router.get('/', requirePermissionOrLegacyRole('channels.tiktok.connections', 'admin', 'super_admin'), listChannelAccounts)
router.post('/:channelType/oauth/start', requirePermissionOrLegacyRole('channels.tiktok.connections', 'admin', 'super_admin'), startChannelOAuth)
router.post('/oauth/callback', requirePermissionOrLegacyRole('channels.tiktok.connections', 'admin', 'super_admin'), completeChannelOAuth)
router.delete('/:id', requirePermissionOrLegacyRole('channels.tiktok.connections', 'admin', 'super_admin'), disconnectChannelAccount)
router.post('/:id/disable', requirePermissionOrLegacyRole('channels.tiktok.connections', 'admin', 'super_admin'), disableChannelAccount)

export default router
