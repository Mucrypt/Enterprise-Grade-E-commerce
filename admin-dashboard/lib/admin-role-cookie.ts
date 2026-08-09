// Lightweight, non-HttpOnly cookie mirroring the logged-in user's role, so
// middleware.ts (which runs on the server and cannot read localStorage) can
// decide whether to render the dashboard shell at all.
//
// This is NOT a security boundary -- it is client-set and readable/writable
// by any script running on this origin, exactly like localStorage. Real
// authorization still happens entirely server-side, in the API's
// authenticate/authorize middleware on every request. What this closes is
// a narrower, real gap: today, any authenticated (even non-admin) session
// gets the dashboard shell rendered client-side before a single API call
// has had the chance to reject it. The full server-verified fix (an
// HttpOnly session cookie backend-issued at login, checked and signature-
// verified in middleware) is a larger auth migration -- see
// docs/LAUNCH-FOUNDATION-1-REPORT.md for why it's deferred to a follow-up
// phase rather than rushed in here.

const COOKIE_NAME = 'tt_admin_role'
const ADMIN_ROLES = ['admin', 'super_admin']
// 'staff' is a distinct marker (never a real users.user_type value) for a
// session whose dashboard access comes from an ACTIVE staff_memberships
// row rather than a legacy admin/super_admin user_type -- e.g. a
// MARKET_MANAGER whose user_type is still 'customer'. See
// AuthContext.tsx's login()/loadUser() for where this is set.
const DASHBOARD_ACCESS_MARKERS = [...ADMIN_ROLES, 'staff']

export function setAdminRoleCookie(role: string | undefined | null): void {
  if (typeof document === 'undefined') return
  if (!role || !DASHBOARD_ACCESS_MARKERS.includes(role)) return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  // Matches the refresh token's lifetime (7d), not the short-lived access
  // token -- this is a coarse role gate re-set on every login/session
  // check, not a precise expiry mirror. Using the access token's ~15min
  // lifetime here would log an admin out of the dashboard shell mid-session
  // (via a false-negative middleware redirect) well before their refresh
  // token, and therefore their real session, actually expires.
  document.cookie = `${COOKIE_NAME}=${role}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`
}

export function clearAdminRoleCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
}

export {
  COOKIE_NAME as ADMIN_ROLE_COOKIE_NAME,
  ADMIN_ROLES,
  DASHBOARD_ACCESS_MARKERS,
}
