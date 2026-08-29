// Referral-link attribution cookie -- the FIRST real `document.cookie`
// usage in this frontend. Everything else (cart, consent itself) is
// Zustand `persist` -> localStorage. A real cookie is used here on
// purpose: the confirmation-rule/worker on the backend keys off a value
// that must survive across a checkout redirect and Stripe's own page,
// and a 30-day expiry is native to cookies (`Max-Age`) in a way
// localStorage has no built-in equivalent for.
//
// Treated as "necessary" and NOT gated behind cookie-consent (functional/
// analytics/marketing toggles in useConsentStore). This matches how the
// cart and auth token are already handled today: nothing in this codebase
// actually checks consent before letting the cart or login work, despite
// the consent banner's own copy calling those "strictly necessary." A
// commission/referral feature is the same category of "core to how the
// store transacts," not marketing/analytics tracking -- so it gets the
// same (informal, but consistent) exemption.

const REFERRAL_CODE_COOKIE = 'ttref'
const VISITOR_ID_COOKIE = 'ttvid'
const REFERRAL_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days, matches the program's attribution window
const VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60 // 1 year -- long-lived, but never account-linked

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`
}

export function getReferralCode(): string | null {
  return readCookie(REFERRAL_CODE_COOKIE)
}

/** Last-click wins: a new ?ref= visit overwrites any existing code and
 * restarts the 30-day window. Plain navigation (no ?ref= present) never
 * calls this, so browsing the site doesn't silently refresh the expiry. */
export function setReferralCode(code: string): void {
  writeCookie(REFERRAL_CODE_COOKIE, code.trim().toUpperCase(), REFERRAL_MAX_AGE_SECONDS)
}

export function getOrCreateVisitorId(): string {
  const existing = readCookie(VISITOR_ID_COOKIE)
  if (existing) return existing
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`
  writeCookie(VISITOR_ID_COOKIE, id, VISITOR_MAX_AGE_SECONDS)
  return id
}
