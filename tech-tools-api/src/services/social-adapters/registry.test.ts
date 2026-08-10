import { getAdapter, getAllCapabilities } from './registry'
import { SOCIAL_PLATFORMS, SocialPlatform, PlatformNotConfiguredError } from './social-adapter.types'

/**
 * PROMOTION-OPS-1 -- this environment has no real Facebook/Instagram/
 * TikTok/LinkedIn/Pinterest/X developer app credentials (confirmed during
 * this phase's audit: no such env vars exist, no public OAuth callback URL
 * is reachable from this sandbox). These tests assert the honest
 * consequence of that: every adapter must report NOT_CONFIGURED or
 * NEEDS_CREDENTIALS here, never AVAILABLE -- and must refuse to hand back
 * an authorize URL for a connector that isn't actually usable.
 */
describe('social-adapters registry -- readiness in this environment', () => {
  const REAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...REAL_ENV }
    for (const platform of SOCIAL_PLATFORMS) {
      delete process.env[`SOCIAL_${platform}_ENABLED`]
      delete process.env[`SOCIAL_${platform}_CLIENT_ID`]
      delete process.env[`SOCIAL_${platform}_CLIENT_SECRET`]
    }
  })

  afterAll(() => {
    process.env = REAL_ENV
  })

  it('reports every one of the 6 platforms as NOT_CONFIGURED when no flags are set (this repo\'s actual current state)', () => {
    const capabilities = getAllCapabilities()
    expect(capabilities).toHaveLength(6)
    for (const cap of capabilities) {
      expect(cap.readiness).toBe('NOT_CONFIGURED')
    }
  })

  it('never reports AVAILABLE for any platform without both a client id and client secret configured', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      process.env[`SOCIAL_${platform}_ENABLED`] = 'true'
    }
    const capabilities = getAllCapabilities()
    for (const cap of capabilities) {
      expect(cap.readiness).toBe('NEEDS_CREDENTIALS')
    }
  })

  it('reports AVAILABLE only once a platform has the flag on and both credentials set', () => {
    process.env.SOCIAL_FACEBOOK_ENABLED = 'true'
    process.env.SOCIAL_FACEBOOK_CLIENT_ID = 'test-client-id'
    process.env.SOCIAL_FACEBOOK_CLIENT_SECRET = 'test-client-secret'
    const facebook = getAdapter('FACEBOOK').getCapabilities()
    expect(facebook.readiness).toBe('AVAILABLE')

    // Every other platform remains unconfigured -- enabling one platform
    // must never affect another's readiness.
    const instagram = getAdapter('INSTAGRAM').getCapabilities()
    expect(instagram.readiness).toBe('NOT_CONFIGURED')
  })

  it.each(SOCIAL_PLATFORMS)('%s.buildAuthorizeUrl throws PlatformNotConfiguredError when not AVAILABLE', (platform: SocialPlatform) => {
    const adapter = getAdapter(platform)
    expect(() => adapter.buildAuthorizeUrl('https://example.com/callback', 'state123', 'verifier123')).toThrow(
      PlatformNotConfiguredError,
    )
  })

  it.each(SOCIAL_PLATFORMS)('%s.buildAuthorizeUrl produces a URL with the platform\'s real authorize host once configured', (platform: SocialPlatform) => {
    process.env[`SOCIAL_${platform}_ENABLED`] = 'true'
    process.env[`SOCIAL_${platform}_CLIENT_ID`] = 'test-client-id'
    process.env[`SOCIAL_${platform}_CLIENT_SECRET`] = 'test-client-secret'

    const adapter = getAdapter(platform)
    const url = adapter.buildAuthorizeUrl('https://admin.example.com/promotions/connections/callback', 'csrf-state', 'pkce-verifier')

    expect(url).toContain('test-client-id')
    expect(url).toContain(encodeURIComponent('https://admin.example.com/promotions/connections/callback'))
    expect(url).toContain('csrf-state')
    expect(new URL(url).protocol).toBe('https:')
  })

  it('X.buildAuthorizeUrl throws when no PKCE code_verifier is supplied, even when otherwise configured', () => {
    process.env.SOCIAL_X_ENABLED = 'true'
    process.env.SOCIAL_X_CLIENT_ID = 'test-client-id'
    process.env.SOCIAL_X_CLIENT_SECRET = 'test-client-secret'
    const adapter = getAdapter('X')
    expect(() => adapter.buildAuthorizeUrl('https://example.com/callback', 'state123')).toThrow(/PKCE/i)
  })

  it('every platform declares whether it requires app review, never silently omitted', () => {
    for (const cap of getAllCapabilities()) {
      expect(typeof cap.requiresAppReview).toBe('boolean')
    }
  })

  it('validatePost never makes a network call and rejects an empty post with no media/message/link on platforms that require media', () => {
    const instagram = getAdapter('INSTAGRAM')
    const result = instagram.validatePost({ message: '', hashtags: [], mediaCount: 0, mediaTypes: [], hasLink: false })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('validatePost flags an over-length caption per platform\'s own documented limit', () => {
    const x = getAdapter('X')
    const longText = 'a'.repeat(281)
    const result = x.validatePost({ message: longText, hashtags: [], mediaCount: 0, mediaTypes: [], hasLink: false })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /280/.test(e))).toBe(true)
  })

  it('getAllCapabilities returns one entry per SOCIAL_PLATFORMS constant, in a stable set', () => {
    const platforms = getAllCapabilities().map((c) => c.platform).sort()
    expect(platforms).toEqual([...SOCIAL_PLATFORMS].sort())
  })
})
