import { Router } from 'express'
import {
  generateDraft,
  generateCampaignDraft,
  listDrafts,
  approveDraft,
  rejectDraft,
  getCustomerContext,
  getTimeline,
  getStats,
  getAiStatus,
} from './ai.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import rateLimit from 'express-rate-limit'

const router = Router()

// ─── Public: service health (used by dashboard status check) ──
router.get('/status', getAiStatus)

// Extra rate-limit on draft generation: 30 per 5 minutes per IP
// (the per-admin Redis limit in the service is the inner guard)
const aiGenerationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.' },
})

// PROMOTION-OPS-1: this route used to fall under the router-wide
// `authorize('admin','super_admin')` gate below like every other AI
// route -- legacy-only, with no path for a new-model staff role (e.g.
// MARKETING_MANAGER) to ever reach it, even though campaign-draft
// generation is squarely inside what campaigns.manage is for. Reassessed
// and moved ahead of the blanket gate onto the same
// requirePermissionOrLegacyRole('campaigns.manage', ...) pattern the rest
// of the promotions feature uses -- everything else in this file (plain
// drafts, customer intelligence, dashboard stats) is intentionally left
// legacy-only; broadening those was not asked for and is out of scope
// here.
router.post(
  '/campaigns/generate',
  authenticate,
  requirePermissionOrLegacyRole('campaigns.manage', 'admin', 'super_admin'),
  aiGenerationLimiter,
  generateCampaignDraft,
)

// ─── All other AI routes: admin/super_admin only ─────────────
router.use(authenticate)
router.use(authorize('admin', 'super_admin'))

// ─── Drafts ───────────────────────────────────────────────────
router.get('/drafts', listDrafts)
router.post('/drafts', aiGenerationLimiter, generateDraft)
router.post('/drafts/:id/approve', approveDraft)
router.post('/drafts/:id/reject', rejectDraft)

// ─── Customer intelligence ────────────────────────────────────
router.get('/context/:customerId', getCustomerContext)
router.get('/timeline/:customerId', getTimeline)

// ─── Dashboard analytics ──────────────────────────────────────
router.get('/stats', getStats)

export default router
