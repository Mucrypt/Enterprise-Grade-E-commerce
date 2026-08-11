import { Router } from 'express'
import { authenticate } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  validateCampaign,
  scheduleCampaign,
  publishCampaignNow,
  cancelCampaign,
  getCampaignMetrics,
  getCampaignActivity,
  resolveChannelPost,
} from './promotion-campaign.controller'
import { campaignCreativeUpload, uploadCampaignCreative } from './promotion-creative.controller'

const router = Router()

router.use(authenticate)

router.get('/', requirePermissionOrLegacyRole('campaigns.view', 'admin', 'super_admin'), listCampaigns)
router.get('/:id', requirePermissionOrLegacyRole('campaigns.view', 'admin', 'super_admin'), getCampaign)
router.get('/:id/metrics', requirePermissionOrLegacyRole('social.analytics', 'admin', 'super_admin'), getCampaignMetrics)
router.get('/:id/activity', requirePermissionOrLegacyRole('campaigns.view', 'admin', 'super_admin'), getCampaignActivity)

router.post('/', requirePermissionOrLegacyRole('campaigns.manage', 'admin', 'super_admin'), createCampaign)
// Must be registered before the generic '/:id' PATCH route below only
// matters for path-shape collisions; this is a distinct static segment
// ('creative-upload') so ordering relative to '/:id' routes is not
// actually significant here -- kept alongside the other campaign.manage
// mutations for readability.
router.post(
  '/creative-upload',
  requirePermissionOrLegacyRole('campaigns.manage', 'admin', 'super_admin'),
  campaignCreativeUpload.single('file'),
  uploadCampaignCreative,
)
router.patch('/:id', requirePermissionOrLegacyRole('campaigns.manage', 'admin', 'super_admin'), updateCampaign)
router.post('/:id/validate', requirePermissionOrLegacyRole('campaigns.manage', 'admin', 'super_admin'), validateCampaign)
router.post('/:id/cancel', requirePermissionOrLegacyRole('campaigns.manage', 'admin', 'super_admin'), cancelCampaign)
router.post(
  '/:id/channels/:channelPostId/resolve',
  requirePermissionOrLegacyRole('campaigns.manage', 'admin', 'super_admin'),
  resolveChannelPost,
)

router.post('/:id/schedule', requirePermissionOrLegacyRole('social.schedule', 'admin', 'super_admin'), scheduleCampaign)
router.post('/:id/publish-now', requirePermissionOrLegacyRole('social.publish', 'admin', 'super_admin'), publishCampaignNow)

export default router
