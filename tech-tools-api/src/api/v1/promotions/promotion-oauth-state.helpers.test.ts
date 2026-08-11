import { isAllowedRedirectOrigin } from './promotion-oauth-state.helpers'

/**
 * Final pre-commit correction #1 -- isAllowedRedirectOrigin() compares
 * `new URL(redirectUri).origin` (scheme + host + port only, never a
 * path) against SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS. These tests pin
 * that behavior down explicitly against the real production domain, so a
 * future edit that accidentally turns this into a path/prefix comparison
 * (or a substring match, which would admit a lookalike domain) fails
 * loudly here.
 */
describe('isAllowedRedirectOrigin -- origin-only comparison (never a path, never a substring match)', () => {
  const REAL_ENV = process.env

  afterEach(() => {
    process.env = REAL_ENV
  })

  it('allows a redirectUri whose ORIGIN matches the allowlist, regardless of the path the admin dashboard actually serves it at', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedRedirectOrigin('https://techtoolstore.com/admin/dashboard/promotions/connections/callback')).toBe(true)
  })

  it('allows the bare origin itself with no path', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedRedirectOrigin('https://techtoolstore.com')).toBe(true)
  })

  it('rejects a redirectUri on a completely different domain', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedRedirectOrigin('https://evil.example/admin/dashboard/promotions/connections/callback')).toBe(false)
  })

  it('rejects a lookalike domain that merely CONTAINS the allowed origin as a substring/subdomain suffix -- proves this is a real origin match, not string.includes()', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedRedirectOrigin('https://techtoolstore.com.evil.example/callback')).toBe(false)
  })

  it('rejects a redirectUri that is exactly the allowed origin PLUS a configured value containing a path -- a misconfigured allowlist entry with a path can never match, since a real redirectUri origin never has one', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com/admin' }
    expect(isAllowedRedirectOrigin('https://techtoolstore.com/admin/dashboard/promotions/connections/callback')).toBe(false)
  })

  it('rejects a scheme mismatch (http vs https) even for an otherwise-allowed host', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedRedirectOrigin('http://techtoolstore.com/callback')).toBe(false)
  })

  it('fails closed when the allowlist env var is unset -- never "allow anything"', () => {
    process.env = { ...REAL_ENV }
    delete process.env.SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS
    expect(isAllowedRedirectOrigin('https://techtoolstore.com/admin/dashboard/promotions/connections/callback')).toBe(false)
  })

  it('fails closed when the allowlist env var is set but empty', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: '' }
    expect(isAllowedRedirectOrigin('https://techtoolstore.com/callback')).toBe(false)
  })

  it('supports a comma-separated multi-origin allowlist (e.g. production + local dev)', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com,http://localhost:3000' }
    expect(isAllowedRedirectOrigin('https://techtoolstore.com/admin/dashboard/promotions/connections/callback')).toBe(true)
    expect(isAllowedRedirectOrigin('http://localhost:3000/dashboard/promotions/connections/callback')).toBe(true)
    expect(isAllowedRedirectOrigin('https://evil.example/callback')).toBe(false)
  })

  it('rejects a malformed redirectUri instead of throwing', () => {
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedRedirectOrigin('not-a-url')).toBe(false)
  })
})
