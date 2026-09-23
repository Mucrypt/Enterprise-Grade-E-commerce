import { Router, raw } from 'express'
import {
  createLiveSession,
  getMyCurrentLiveSession,
  getStreamKey,
  startLiveSession,
  endLiveSession,
  forceEndLiveSession,
  pinLiveSessionProduct,
  unpinLiveSessionProduct,
  getLiveSessionForViewer,
  listLiveSessions,
} from './live.controller'
import { authenticate } from '../../../middleware/auth'
import { requireAdminOrOnboardedSeller } from '../../../middleware/seller-auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import { handleIvsSnsEvent } from './live-webhook.controller'

const router = Router()

// AWS SNS delivery -- cryptographically verified inside the handler
// itself (sns-validator), not by any auth middleware here; this must
// stay reachable without a JWT since AWS is the caller, not a user.
//
// SNS POSTs with Content-Type: text/plain (a well-known SNS quirk, even
// though the body is JSON) -- app.ts's global express.json() only reads
// the request stream for Content-Type: application/json, so it never
// populates req.rawBody for this route at all. A route-scoped
// express.raw({ type: () => true }) here captures the raw body for
// EVERY content-type not already consumed by the global parser (only
// applies its own req.body/rawBody when the stream is still unread --
// on the rare chance SNS is ever configured to send
// application/json instead, the global parser already did this
// correctly and this middleware must not clobber it with an
// already-drained, empty stream).
router.post(
  '/webhooks/ivs-event',
  raw({ type: () => true }),
  (req, _res, next) => {
    const typedReq = req as typeof req & { rawBody?: Buffer }
    if (!typedReq.rawBody && Buffer.isBuffer(req.body) && req.body.length > 0) {
      typedReq.rawBody = req.body
    }
    next()
  },
  handleIvsSnsEvent,
)

// Public -- the "who's live now" rail, no auth required (matches
// discover.routes.ts's public GET /feed).
router.get('/sessions', listLiveSessions)

// Viewer-facing -- any authenticated user, not seller-only.
router.get('/sessions/:id', authenticate, getLiveSessionForViewer)

// Seller (or admin) -- ownership is checked per-session inside the
// controller (canActOnSession), same pattern as discover's seller-scoped
// routes.
router.post('/sessions', authenticate, requireAdminOrOnboardedSeller, createLiveSession)
router.get('/sessions/mine/current', authenticate, requireAdminOrOnboardedSeller, getMyCurrentLiveSession)
router.get('/sessions/:id/stream-key', authenticate, requireAdminOrOnboardedSeller, getStreamKey)
router.post('/sessions/:id/start', authenticate, requireAdminOrOnboardedSeller, startLiveSession)
router.post('/sessions/:id/end', authenticate, requireAdminOrOnboardedSeller, endLiveSession)
router.post('/sessions/:id/products', authenticate, requireAdminOrOnboardedSeller, pinLiveSessionProduct)
router.delete(
  '/sessions/:id/products/:productId',
  authenticate,
  requireAdminOrOnboardedSeller,
  unpinLiveSessionProduct,
)

export default router

// Admin-only kill switch -- a separate router mounted at top-level
// /admin/live in api/v1/index.ts, matching the existing convention
// (/admin/sellers is its own top-level mount, not nested under
// /sellers/admin) rather than this file's own /live prefix.
//
// sellers.manage (not just legacy admin/super_admin) -- matches
// admin/sellers.routes.ts's own `manage` gate exactly, so a staff
// member (e.g. MARKET_MANAGER) holding that granular permission isn't
// shown an enabled "Force end" button in admin-dashboard only to get a
// 403 from the API.
export const adminLiveRouter = Router()
adminLiveRouter.post(
  '/sessions/:id/force-end',
  authenticate,
  requirePermissionOrLegacyRole('sellers.manage', 'admin', 'super_admin'),
  forceEndLiveSession,
)
