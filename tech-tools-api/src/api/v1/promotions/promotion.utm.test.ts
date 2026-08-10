import { buildUtmUrl } from './promotion.utm'

describe('promotion.utm -- buildUtmUrl', () => {
  it('produces the exact documented shape: utm_source=<platform lowercase>&utm_medium=social&utm_campaign=<key>&utm_content=<postId>', () => {
    const url = buildUtmUrl('https://techtoolstore.com/p/cordless-drill', {
      platform: 'FACEBOOK',
      campaignKey: 'cordless-tools-weekend',
      channelPostId: 'post-abc-123',
    })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://techtoolstore.com/p/cordless-drill')
    expect(parsed.searchParams.get('utm_source')).toBe('facebook')
    expect(parsed.searchParams.get('utm_medium')).toBe('social')
    expect(parsed.searchParams.get('utm_campaign')).toBe('cordless-tools-weekend')
    expect(parsed.searchParams.get('utm_content')).toBe('post-abc-123')
  })

  it('lowercases utm_source per platform', () => {
    for (const platform of ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'PINTEREST', 'X'] as const) {
      const url = buildUtmUrl('https://techtoolstore.com/deals', { platform, campaignKey: 'k', channelPostId: 'p' })
      expect(new URL(url).searchParams.get('utm_source')).toBe(platform.toLowerCase())
    }
  })

  it('preserves existing query parameters on the base URL instead of overwriting them', () => {
    const url = buildUtmUrl('https://techtoolstore.com/p/drill?color=red&ref=email', {
      platform: 'X',
      campaignKey: 'k',
      channelPostId: 'p',
    })
    const parsed = new URL(url)
    expect(parsed.searchParams.get('color')).toBe('red')
    expect(parsed.searchParams.get('ref')).toBe('email')
    expect(parsed.searchParams.get('utm_source')).toBe('x')
  })

  it('always sets utm_medium to exactly "social", never varying by platform', () => {
    const url = buildUtmUrl('https://techtoolstore.com/', { platform: 'PINTEREST', campaignKey: 'k', channelPostId: 'p' })
    expect(new URL(url).searchParams.get('utm_medium')).toBe('social')
  })

  it('throws on an invalid base URL rather than silently producing a broken link', () => {
    expect(() => buildUtmUrl('not-a-url', { platform: 'X', campaignKey: 'k', channelPostId: 'p' })).toThrow()
  })
})
