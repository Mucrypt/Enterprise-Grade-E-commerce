import { isAllowedChannelRedirectOrigin } from './channel-oauth-state.helpers'

/**
 * Direct clone of promotions/promotion-oauth-state.helpers.test.ts's
 * isAllowedRedirectOrigin tests, applied to the channel domain's separate
 * CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS env var -- same origin-only
 * (never path, never substring) comparison must hold here too.
 */
describe('isAllowedChannelRedirectOrigin -- origin-only comparison (never a path, never a substring match)', () => {
  const REAL_ENV = process.env

  afterEach(() => {
    process.env = REAL_ENV
  })

  it('allows a redirectUri whose ORIGIN matches the allowlist, regardless of the path the admin dashboard actually serves it at', () => {
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedChannelRedirectOrigin('https://techtoolstore.com/admin/dashboard/channels/tiktok/connection/callback')).toBe(true)
  })

  it('allows the bare origin itself with no path', () => {
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedChannelRedirectOrigin('https://techtoolstore.com')).toBe(true)
  })

  it('rejects a redirectUri on a completely different domain', () => {
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedChannelRedirectOrigin('https://evil.example/callback')).toBe(false)
  })

  it('rejects a lookalike domain that merely CONTAINS the allowed origin as a substring/subdomain suffix', () => {
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedChannelRedirectOrigin('https://techtoolstore.com.evil.example/callback')).toBe(false)
  })

  it('rejects a scheme mismatch (http vs https) even for an otherwise-allowed host', () => {
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedChannelRedirectOrigin('http://techtoolstore.com/callback')).toBe(false)
  })

  it('fails closed when the allowlist env var is unset -- never "allow anything"', () => {
    process.env = { ...REAL_ENV }
    delete process.env.CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS
    expect(isAllowedChannelRedirectOrigin('https://techtoolstore.com/callback')).toBe(false)
  })

  it('fails closed when the allowlist env var is set but empty', () => {
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: '' }
    expect(isAllowedChannelRedirectOrigin('https://techtoolstore.com/callback')).toBe(false)
  })

  it('supports a comma-separated multi-origin allowlist (e.g. production + local dev)', () => {
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com,http://localhost:3000' }
    expect(isAllowedChannelRedirectOrigin('https://techtoolstore.com/callback')).toBe(true)
    expect(isAllowedChannelRedirectOrigin('http://localhost:3000/callback')).toBe(true)
    expect(isAllowedChannelRedirectOrigin('https://evil.example/callback')).toBe(false)
  })

  it('is independent of SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS -- the two domains never share an allowlist', () => {
    process.env = {
      ...REAL_ENV,
      SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com',
    }
    delete process.env.CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS
    expect(isAllowedChannelRedirectOrigin('https://techtoolstore.com/callback')).toBe(false)
  })

  it('rejects a malformed redirectUri instead of throwing', () => {
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: 'https://techtoolstore.com' }
    expect(isAllowedChannelRedirectOrigin('not-a-url')).toBe(false)
  })
})
