import { BaseSocialAdapter, StaticCapabilities } from './base-social-adapter'
import { PublishError } from './social-adapter.types'

/**
 * Production Review Round 1 §5/§27 -- these test the classification logic
 * ITSELF (fetchOrThrow / classifyHttpFailure), not just the queue's
 * consumption of a pre-built PublishError. A concrete no-op subclass is
 * used since BaseSocialAdapter is abstract and has no OAuth/publish
 * surface of its own worth exercising here.
 */
class TestAdapter extends BaseSocialAdapter {
  platform = 'FACEBOOK' as const
  protected envPrefix = 'FACEBOOK'
  protected staticCapabilities: StaticCapabilities = {
    requiresAppReview: true,
    supportsText: true,
    supportsImage: true,
    supportsMultiImage: false,
    supportsVideo: false,
    supportsReelOrShort: false,
    supportsLink: true,
    supportsScheduling: true,
    supportsPostMetrics: true,
    supportsComments: false,
    supportsDelete: false,
    supportsEdit: false,
    rateLimitNotes: 'n/a (test adapter)',
    tokenExpiryNotes: 'n/a (test adapter)',
    notes: 'n/a (test adapter)',
  }

  async publishViaFetch(url: string, init?: RequestInit) {
    return this.fetchOrThrow(url, init, 'TestAdapter publish')
  }

  classify(status: number, body: unknown) {
    return this.classifyHttpFailure(status, body, 'TestAdapter publish')
  }
}

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

describe('BaseSocialAdapter.fetchOrThrow -- network-level failures', () => {
  it('classifies a fetch()-level exception (network never returned a response) as REMOTE_STATE_UNKNOWN -- outcome cannot be known, never safe to blindly retry', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'))
    const adapter = new TestAdapter()

    await expect(adapter.publishViaFetch('https://graph.facebook.com/v25.0/x')).rejects.toMatchObject({
      classification: 'REMOTE_STATE_UNKNOWN',
      errorCode: 'TRANSPORT_ERROR',
    })
  })

  it('a network exception is a real PublishError instance, not a generic Error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'))
    const adapter = new TestAdapter()

    await expect(adapter.publishViaFetch('https://graph.facebook.com/v25.0/x')).rejects.toBeInstanceOf(PublishError)
  })

  it('a successful (ok) response is returned as-is, with no classification applied', async () => {
    const fakeResponse = { ok: true, status: 200, json: async () => ({ id: 'post-123' }) } as unknown as Response
    global.fetch = jest.fn().mockResolvedValue(fakeResponse)
    const adapter = new TestAdapter()

    const res = await adapter.publishViaFetch('https://graph.facebook.com/v25.0/x')
    expect(res).toBe(fakeResponse)
  })
})

describe('BaseSocialAdapter.fetchOrThrow -- definitive HTTP error responses', () => {
  const respond = (status: number, body: unknown = {}) =>
    ({ ok: false, status, json: async () => body } as unknown as Response)

  it('a definitive HTTP response (even an error one) is never REMOTE_STATE_UNKNOWN for well-known statuses -- the provider DID answer', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(401, { error: { message: 'Token expired' } }))
    const adapter = new TestAdapter()

    await expect(adapter.publishViaFetch('https://x')).rejects.toMatchObject({
      classification: 'DO_NOT_RETRY',
      errorCode: 'AUTH_EXPIRED',
    })
  })

  it('403 is classified DO_NOT_RETRY / MISSING_SCOPE', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(403, { error: 'Missing permission' }))
    const adapter = new TestAdapter()

    await expect(adapter.publishViaFetch('https://x')).rejects.toMatchObject({
      classification: 'DO_NOT_RETRY',
      errorCode: 'MISSING_SCOPE',
    })
  })

  it('429 is classified SAFE_TO_RETRY / RATE_LIMITED', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(429, {}))
    const adapter = new TestAdapter()

    await expect(adapter.publishViaFetch('https://x')).rejects.toMatchObject({
      classification: 'SAFE_TO_RETRY',
      errorCode: 'RATE_LIMITED',
    })
  })

  it('400 and 422 are classified DO_NOT_RETRY / INVALID_MEDIA_OR_CAPTION -- retrying an unfixed bad request wastes attempts and never succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(400, { message: 'Unsupported image format' }))
    const adapter = new TestAdapter()
    await expect(adapter.publishViaFetch('https://x')).rejects.toMatchObject({
      classification: 'DO_NOT_RETRY',
      errorCode: 'INVALID_MEDIA_OR_CAPTION',
    })

    global.fetch = jest.fn().mockResolvedValue(respond(422, {}))
    await expect(adapter.publishViaFetch('https://x')).rejects.toMatchObject({
      classification: 'DO_NOT_RETRY',
      errorCode: 'INVALID_MEDIA_OR_CAPTION',
    })
  })

  it('5xx is classified SAFE_TO_RETRY / TEMPORARY_PROVIDER_ERROR', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(503, {}))
    const adapter = new TestAdapter()

    await expect(adapter.publishViaFetch('https://x')).rejects.toMatchObject({
      classification: 'SAFE_TO_RETRY',
      errorCode: 'TEMPORARY_PROVIDER_ERROR',
    })
  })

  it('an unrecognized status code defaults to REMOTE_STATE_UNKNOWN rather than guessing safe-to-retry -- an unclassifiable definitive response must not be auto-retried', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(418, {}))
    const adapter = new TestAdapter()

    await expect(adapter.publishViaFetch('https://x')).rejects.toMatchObject({
      classification: 'REMOTE_STATE_UNKNOWN',
      errorCode: 'UNKNOWN_PROVIDER_ERROR',
    })
  })

  it('extracts a human-readable message from common provider error body shapes', async () => {
    const adapter = new TestAdapter()
    expect(adapter.classify(401, { error: { message: 'nested message' } }).message).toContain('nested message')
    expect(adapter.classify(401, { error: 'string error' }).message).toContain('string error')
    expect(adapter.classify(401, { message: 'top-level message' }).message).toContain('top-level message')
    expect(adapter.classify(401, { error_description: 'oauth style' }).message).toContain('oauth style')
    expect(adapter.classify(401, { detail: 'drf style' }).message).toContain('drf style')
  })

  it('falls back to a generic HTTP-status message when the body has no recognizable error field', async () => {
    const adapter = new TestAdapter()
    expect(adapter.classify(500, { unrelated: 'field' }).message).toContain('HTTP 500')
    expect(adapter.classify(500, null).message).toContain('HTTP 500')
  })

  it('a malformed (non-JSON) error response body does not crash classification -- json() rejection is swallowed to null', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('not json') } } as unknown as Response)
    const adapter = new TestAdapter()

    await expect(adapter.publishViaFetch('https://x')).rejects.toMatchObject({
      classification: 'SAFE_TO_RETRY',
      errorCode: 'TEMPORARY_PROVIDER_ERROR',
    })
  })
})
