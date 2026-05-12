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
import rateLimit from 'express-rate-limit'

const router = Router()

// ─── Public: service health (used by dashboard status check) ──
router.get('/status', getAiStatus)

// ─── All other AI routes: admin/super_admin only ─────────────
router.use(authenticate)
router.use(authorize('admin', 'super_admin'))

// Extra rate-limit on draft generation: 30 per 5 minutes per IP
// (the per-admin Redis limit in the service is the inner guard)
const aiGenerationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.' },
})

// ─── Drafts ───────────────────────────────────────────────────
router.get('/drafts', listDrafts)
router.post('/drafts', aiGenerationLimiter, generateDraft)
router.post('/campaigns/generate', aiGenerationLimiter, generateCampaignDraft)
router.post('/drafts/:id/approve', approveDraft)
router.post('/drafts/:id/reject', rejectDraft)

// ─── Customer intelligence ────────────────────────────────────
router.get('/context/:customerId', getCustomerContext)
router.get('/timeline/:customerId', getTimeline)

// ─── Dashboard analytics ──────────────────────────────────────
router.get('/stats', getStats)

export default router
