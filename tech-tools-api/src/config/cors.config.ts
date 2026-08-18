/**
 * CORS policy, as a standalone module so its decision logic can be unit-
 * tested without importing the full Express app (app.ts pulls in the
 * entire router tree transitively). Two policies:
 *
 * 1. Every normal route: origin must be in CORS_ORIGIN (the admin
 *    dashboard/storefront's own origin(s)), credentials: true -- this is
 *    the strict, cookie/JWT-session-safe default.
 * 2. SOURCING-1's two extension-facing routes (/api/v1/sourcing/verify,
 *    /api/v1/sourcing/captures): also allow any chrome-extension:// or
 *    moz-extension:// origin, credentials: false. Safe specifically
 *    because these two routes authenticate via a Bearer
 *    sourcing_api_token, never a cookie -- there's no session to forge,
 *    so allowing an arbitrary extension origin here doesn't reopen the
 *    cross-site-cookie risk CORS_ORIGIN's strict allowlist exists to
 *    prevent for every other route.
 */
import { Request } from 'express'
import { CorsOptions } from 'cors'

export const DASHBOARD_ORIGINS = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173']

export const EXTENSION_CORS_PATHS = ['/api/v1/sourcing/verify', '/api/v1/sourcing/captures']

export function isExtensionOrigin(origin: string | undefined): boolean {
  return !!origin && (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'))
}

/**
 * A cors() "options delegate" function -- receives the real request, so
 * (unlike a static CorsOptions object) it can branch on req.path. Must be
 * the single global cors() call (app.ts) rather than layered with a
 * second, route-level cors() -- the cors package terminates OPTIONS
 * preflight requests itself, so a later cors() call would never be
 * reached for preflight once an earlier one has already responded.
 */
export function corsOptionsDelegate(req: Request, callback: (err: Error | null, options: CorsOptions) => void): void {
  const origin = req.headers.origin
  if (EXTENSION_CORS_PATHS.includes(req.path) && isExtensionOrigin(origin)) {
    callback(null, { origin: true, credentials: false, optionsSuccessStatus: 200 })
    return
  }
  callback(null, { origin: DASHBOARD_ORIGINS, credentials: true, optionsSuccessStatus: 200 })
}
