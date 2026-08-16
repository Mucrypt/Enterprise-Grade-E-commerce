import crypto from 'crypto'
import { buildSortedSignatureBase, signTikTokShopRequest } from './tiktok-shop.signing'

describe('buildSortedSignatureBase', () => {
  it('sorts params alphabetically by key and concatenates key+value with no separators', () => {
    const base = buildSortedSignatureBase({ timestamp: '456', app_key: '123', shop_cipher: 'abc' })
    expect(base).toBe('app_key123shop_cipherabctimestamp456')
  })

  it('excludes sign and access_token from the signature base', () => {
    const base = buildSortedSignatureBase({ app_key: '123', sign: 'should-not-appear', access_token: 'should-not-appear-either' })
    expect(base).toBe('app_key123')
  })

  it('returns an empty string when there are no signable params', () => {
    expect(buildSortedSignatureBase({ sign: 'x', access_token: 'y' })).toBe('')
  })
})

describe('signTikTokShopRequest', () => {
  it('produces a deterministic hex HMAC-SHA256 matching a manually-computed reference value', () => {
    const appSecret = 'test-app-secret'
    const queryParams = { app_key: 'abc', timestamp: '1000' }
    const expected = crypto
      .createHmac('sha256', appSecret)
      .update(`${appSecret}${buildSortedSignatureBase(queryParams)}${appSecret}`)
      .digest('hex')

    expect(signTikTokShopRequest({ appSecret, queryParams })).toBe(expected)
  })

  it('includes the JSON body in the signed message when provided', () => {
    const appSecret = 'test-app-secret'
    const queryParams = { app_key: 'abc' }
    const jsonBody = '{"sku":"DRILL-1"}'

    const withoutBody = signTikTokShopRequest({ appSecret, queryParams })
    const withBody = signTikTokShopRequest({ appSecret, queryParams, jsonBody })
    expect(withBody).not.toBe(withoutBody)
  })

  it('two different app secrets produce two different signatures for the identical params', () => {
    const queryParams = { app_key: 'abc', timestamp: '1000' }
    const sigA = signTikTokShopRequest({ appSecret: 'secret-a', queryParams })
    const sigB = signTikTokShopRequest({ appSecret: 'secret-b', queryParams })
    expect(sigA).not.toBe(sigB)
  })

  it('is a 64-character lowercase hex string (SHA-256 digest length)', () => {
    const sig = signTikTokShopRequest({ appSecret: 'secret', queryParams: { app_key: 'abc' } })
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })
})
