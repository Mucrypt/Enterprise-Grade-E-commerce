import crypto from 'crypto'
import { verifyTikTokShopWebhookSignature } from './tiktok-shop.webhook-verify'

const APP_KEY = 'test-app-key'
const APP_SECRET = 'test-app-secret'

function realSignature(rawBody: string): string {
  return crypto.createHmac('sha256', APP_SECRET).update(`${APP_KEY}${rawBody}`).digest('hex')
}

describe('verifyTikTokShopWebhookSignature', () => {
  it('accepts a correctly-signed payload', () => {
    const rawBody = JSON.stringify({ tts_notification_id: '123', type: 'ORDER_STATUS_CHANGE' })
    const authorizationHeader = realSignature(rawBody)

    expect(
      verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody, authorizationHeader }),
    ).toBe(true)
  })

  it('rejects a tampered body against a signature computed for the original body', () => {
    const originalBody = JSON.stringify({ tts_notification_id: '123', type: 'ORDER_STATUS_CHANGE' })
    const tamperedBody = JSON.stringify({ tts_notification_id: '123', type: 'SELLER_DEAUTHORIZATION' })
    const authorizationHeader = realSignature(originalBody)

    expect(
      verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody: tamperedBody, authorizationHeader }),
    ).toBe(false)
  })

  it('rejects a signature computed with the wrong app secret', () => {
    const rawBody = JSON.stringify({ tts_notification_id: '123' })
    const wrongSecretSignature = crypto.createHmac('sha256', 'a-different-secret').update(`${APP_KEY}${rawBody}`).digest('hex')

    expect(
      verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody, authorizationHeader: wrongSecretSignature }),
    ).toBe(false)
  })

  it('rejects a signature computed with the wrong app key (message prefix)', () => {
    const rawBody = JSON.stringify({ tts_notification_id: '123' })
    const wrongKeySignature = crypto.createHmac('sha256', APP_SECRET).update(`a-different-app-key${rawBody}`).digest('hex')

    expect(
      verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody, authorizationHeader: wrongKeySignature }),
    ).toBe(false)
  })

  it('rejects a missing Authorization header without throwing', () => {
    const rawBody = JSON.stringify({ tts_notification_id: '123' })
    expect(
      verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody, authorizationHeader: undefined }),
    ).toBe(false)
  })

  it('rejects a malformed (non-hex) Authorization header without throwing', () => {
    const rawBody = JSON.stringify({ tts_notification_id: '123' })
    expect(
      verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody, authorizationHeader: 'not-valid-hex!!' }),
    ).toBe(false)
  })

  it('rejects an empty-string Authorization header without throwing', () => {
    const rawBody = JSON.stringify({ tts_notification_id: '123' })
    expect(
      verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody, authorizationHeader: '' }),
    ).toBe(false)
  })

  it('documents the known protocol limitation: an identical, previously-valid signature verifies again on replay -- no timestamp is folded in, so replay defense is NOT this function\'s job (it lives in the webhook controller\'s tts_notification_id uniqueness gate)', () => {
    const rawBody = JSON.stringify({ tts_notification_id: 'replay-me', type: 'ORDER_STATUS_CHANGE' })
    const authorizationHeader = realSignature(rawBody)

    const firstCheck = verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody, authorizationHeader })
    const secondCheck = verifyTikTokShopWebhookSignature({ appKey: APP_KEY, appSecret: APP_SECRET, rawBody, authorizationHeader })
    expect(firstCheck).toBe(true)
    expect(secondCheck).toBe(true)
  })
})
