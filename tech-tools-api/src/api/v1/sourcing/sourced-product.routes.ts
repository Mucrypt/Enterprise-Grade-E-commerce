import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../../middleware/auth'
import { authenticateSourcingToken } from '../../../middleware/sourcing-token-auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'
import {
  captureSourcedProduct,
  verifySourcingToken,
  listSourcedProductsHandler,
  getSourcedProduct,
  getSourcedProductByCommittedProductIdHandler,
  getSourcingAnalyticsHandler,
  reviewSourcedProduct,
  regenerateSourcedProductRewrite,
  commitSourcedProductHandler,
  discardSourcedProductHandler,
} from './sourced-product.controller'

const router = Router()

// The two routes the browser extension calls -- token-authenticated,
// never the normal dashboard JWT flow. /verify backs the extension
// options page's "Test connection" button (a full capture payload isn't
// a reasonable connectivity check). Their chrome-extension:// CORS
// allowance lives in app.ts's single global cors() call, not here --
// the cors package terminates OPTIONS preflight requests itself, so a
// second, route-level cors() layered after the global one would never
// actually be reached. Mirrors ai.routes.ts's aiGenerationLimiter shape
// for the regenerate endpoint below.
router.get('/verify', authenticateSourcingToken, requirePermissionOrLegacyRole('sourcing.import', 'admin', 'super_admin'), verifySourcingToken)
router.post(
  '/captures',
  authenticateSourcingToken,
  requirePermissionOrLegacyRole('sourcing.import', 'admin', 'super_admin'),
  captureSourcedProduct,
)

// Everything else stays on the normal dashboard session -- the founder is
// already logged in there.
router.use(authenticate)

router.get('/products', requirePermissionOrLegacyRole('sourcing.view', 'admin', 'super_admin'), listSourcedProductsHandler)
router.get('/analytics', requirePermissionOrLegacyRole('sourcing.view', 'admin', 'super_admin'), getSourcingAnalyticsHandler)
router.get(
  '/products/by-committed/:productId',
  requirePermissionOrLegacyRole('sourcing.view', 'admin', 'super_admin'),
  getSourcedProductByCommittedProductIdHandler,
)
router.get('/products/:id', requirePermissionOrLegacyRole('sourcing.view', 'admin', 'super_admin'), getSourcedProduct)
router.patch('/products/:id/review', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), reviewSourcedProduct)

const regenerateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many rewrite requests. Please wait a moment.' },
})
router.post(
  '/products/:id/regenerate',
  requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'),
  regenerateLimiter,
  regenerateSourcedProductRewrite,
)

router.post('/products/:id/commit', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), commitSourcedProductHandler)
router.post('/products/:id/discard', requirePermissionOrLegacyRole('sourcing.manage', 'admin', 'super_admin'), discardSourcedProductHandler)

export default router
