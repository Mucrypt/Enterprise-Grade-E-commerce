import { BaseChannelAdapter, StaticChannelCapabilities, computeBackoffDelayMs } from './base-channel-adapter'
import { ChannelSyncError } from './channel-account.types'

/**
 * Direct structural clone of social-adapters/base-social-adapter.test.ts,
 * adapted to the channel domain's ChannelSyncError/classification --
 * these test the classification logic ITSELF (fetchOrThrow/
 * classifyHttpFailure), not just a worker's consumption of a pre-built
 * error.
 */
class TestChannelAdapter extends BaseChannelAdapter {
  channelType = 'TIKTOK_SHOP' as const
  protected envPrefix = 'TIKTOK_SHOP'
  protected staticCapabilities: StaticChannelCapabilities = {
    requiresAppReview: true,
    supportsProductRead: true,
    supportsProductWrite: false,
    supportsInventoryRead: true,
    supportsInventoryWrite: false,
    supportsOrderImport: true,
    supportsFulfillmentWrite: false,
    supportsFinanceSync: true,
    supportsAffiliateSync: true,
    rateLimitNotes: 'n/a (test adapter)',
    tokenExpiryNotes: 'n/a (test adapter)',
    notes: 'n/a (test adapter)',
  }

  async callViaFetch(url: string, init?: RequestInit) {
    return this.fetchOrThrow(url, init, 'TestChannelAdapter call')
  }

  async callViaFetchWithRetry(url: string, init?: RequestInit, maxAttempts = 3) {
    return this.fetchOrThrowWithRetry(url, init, 'TestChannelAdapter call', maxAttempts)
  }

  classify(status: number, body: unknown) {
    return this.classifyHttpFailure(status, body, 'TestChannelAdapter call')
  }

  // Overridden so retry tests never actually wait for a real backoff delay.
  sleepCalls: number[] = []
  protected sleepMs(ms: number): Promise<void> {
    this.sleepCalls.push(ms)
    return Promise.resolve()
  }
}

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

describe('BaseChannelAdapter.fetchOrThrow -- network-level failures', () => {
  it('classifies a fetch()-level exception (network never returned a response) as REMOTE_STATE_UNKNOWN -- outcome cannot be known, never safe to blindly retry', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://open-api.tiktokglobalshop.com/x')).rejects.toMatchObject({
      classification: 'REMOTE_STATE_UNKNOWN',
      errorCode: 'TRANSPORT_ERROR',
    })
  })

  it('a network exception is a real ChannelSyncError instance, not a generic Error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://open-api.tiktokglobalshop.com/x')).rejects.toBeInstanceOf(ChannelSyncError)
  })

  it('a successful (ok) response is returned as-is, with no classification applied', async () => {
    const fakeResponse = { ok: true, status: 200, json: async () => ({ code: 0 }) } as unknown as Response
    global.fetch = jest.fn().mockResolvedValue(fakeResponse)
    const adapter = new TestChannelAdapter()

    const res = await adapter.callViaFetch('https://open-api.tiktokglobalshop.com/x')
    expect(res).toBe(fakeResponse)
  })
})

describe('BaseChannelAdapter.fetchOrThrow -- definitive HTTP error responses', () => {
  const respond = (status: number, body: unknown = {}, retryAfter: string | null = null) =>
    ({ ok: false, status, json: async () => body, headers: { get: (name: string) => (name === 'retry-after' ? retryAfter : null) } } as unknown as Response)

  it('a definitive HTTP response is never REMOTE_STATE_UNKNOWN for well-known statuses -- the channel DID answer', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(401, { message: 'Access token expired' }))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'DO_NOT_RETRY',
      errorCode: 'AUTH_EXPIRED',
    })
  })

  it('403 is classified DO_NOT_RETRY / MISSING_SCOPE', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(403, { message: 'Missing scope' }))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'DO_NOT_RETRY',
      errorCode: 'MISSING_SCOPE',
    })
  })

  it('429 is classified SAFE_TO_RETRY / RATE_LIMITED', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(429, {}))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'SAFE_TO_RETRY',
      errorCode: 'RATE_LIMITED',
    })
  })

  it('400 and 422 are classified DO_NOT_RETRY / INVALID_PRODUCT -- retrying an unfixed bad request wastes attempts and never succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(400, { message: 'Invalid SKU' }))
    const adapter = new TestChannelAdapter()
    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'DO_NOT_RETRY',
      errorCode: 'INVALID_PRODUCT',
    })

    global.fetch = jest.fn().mockResolvedValue(respond(422, {}))
    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'DO_NOT_RETRY',
      errorCode: 'INVALID_PRODUCT',
    })
  })

  it('5xx is classified SAFE_TO_RETRY / TEMPORARY_PROVIDER_ERROR', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(503, {}))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'SAFE_TO_RETRY',
      errorCode: 'TEMPORARY_PROVIDER_ERROR',
    })
  })

  it('an unrecognized status code defaults to REMOTE_STATE_UNKNOWN rather than guessing safe-to-retry', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(418, {}))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'REMOTE_STATE_UNKNOWN',
      errorCode: 'UNKNOWN_REMOTE_STATE',
    })
  })

  it('extracts a human-readable message from common TikTok Shop error body shapes', async () => {
    const adapter = new TestChannelAdapter()
    expect(adapter.classify(401, { message: 'top-level message' }).message).toContain('top-level message')
    expect(adapter.classify(401, { error: 'string error' }).message).toContain('string error')
    expect(adapter.classify(401, { error: { message: 'nested message' } }).message).toContain('nested message')
    expect(adapter.classify(401, { error_description: 'oauth style' }).message).toContain('oauth style')
    expect(adapter.classify(401, { detail: 'drf style' }).message).toContain('drf style')
  })

  it('falls back to a generic HTTP-status message when the body has no recognizable error field', async () => {
    const adapter = new TestChannelAdapter()
    expect(adapter.classify(500, { unrelated: 'field' }).message).toContain('HTTP 500')
    expect(adapter.classify(500, null).message).toContain('HTTP 500')
  })

  it('a malformed (non-JSON) error response body does not crash classification', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json')
      },
      headers: { get: () => null },
    } as unknown as Response)
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'SAFE_TO_RETRY',
      errorCode: 'TEMPORARY_PROVIDER_ERROR',
    })
  })

  it('captures a real Retry-After header value onto the thrown ChannelSyncError', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(429, {}, '30'))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      classification: 'SAFE_TO_RETRY',
      errorCode: 'RATE_LIMITED',
      retryAfterSeconds: 30,
    })
  })

  it('ignores a malformed Retry-After header rather than computing a nonsensical delay', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(429, {}, 'not-a-number'))
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({
      retryAfterSeconds: undefined,
    })
  })
})

describe('BaseChannelAdapter.fetchOrThrowWithRetry -- bounded retry for read-only failures', () => {
  const okResponse = { ok: true, status: 200, json: async () => ({ code: 0 }) } as unknown as Response
  const rateLimited = (retryAfter: string | null = null) =>
    ({ ok: false, status: 429, json: async () => ({}), headers: { get: (name: string) => (name === 'retry-after' ? retryAfter : null) } } as unknown as Response)
  const authExpired = { ok: false, status: 401, json: async () => ({}), headers: { get: () => null } } as unknown as Response

  it('retries a SAFE_TO_RETRY failure and succeeds once the channel recovers', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(rateLimited()).mockResolvedValueOnce(okResponse)
    const adapter = new TestChannelAdapter()

    const res = await adapter.callViaFetchWithRetry('https://x')
    expect(res).toBe(okResponse)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('never retries a DO_NOT_RETRY failure -- fails on the first attempt', async () => {
    global.fetch = jest.fn().mockResolvedValue(authExpired)
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetchWithRetry('https://x')).rejects.toMatchObject({ classification: 'DO_NOT_RETRY' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('gives up after maxAttempts and throws the last classified error', async () => {
    global.fetch = jest.fn().mockResolvedValue(rateLimited())
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetchWithRetry('https://x', undefined, 3)).rejects.toMatchObject({ classification: 'SAFE_TO_RETRY' })
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('honors a real Retry-After header as the delay before the next attempt', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(rateLimited('7')).mockResolvedValueOnce(okResponse)
    const adapter = new TestChannelAdapter()

    await adapter.callViaFetchWithRetry('https://x')
    expect(adapter.sleepCalls).toEqual([7000])
  })

  it('never retries in-process for a plain fetchOrThrow call -- only the *WithRetry variant does', async () => {
    global.fetch = jest.fn().mockResolvedValue(rateLimited())
    const adapter = new TestChannelAdapter()

    await expect(adapter.callViaFetch('https://x')).rejects.toMatchObject({ classification: 'SAFE_TO_RETRY' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('computeBackoffDelayMs', () => {
  it('uses the Retry-After value directly (in ms) when the channel supplies one, ignoring the attempt number', () => {
    expect(computeBackoffDelayMs(1, 5)).toBe(5000)
    expect(computeBackoffDelayMs(3, 0)).toBe(0)
  })

  it('falls back to exponential backoff with jitter when no Retry-After is present', () => {
    const delay1 = computeBackoffDelayMs(1)
    const delay2 = computeBackoffDelayMs(2)
    expect(delay1).toBeGreaterThanOrEqual(1000)
    expect(delay1).toBeLessThan(1250)
    expect(delay2).toBeGreaterThanOrEqual(2000)
    expect(delay2).toBeLessThan(2250)
  })

  it('caps the exponential backoff rather than growing unbounded', () => {
    const delay = computeBackoffDelayMs(10)
    expect(delay).toBeLessThan(8250)
  })

  it('ignores a negative or non-finite Retry-After value', () => {
    expect(computeBackoffDelayMs(1, -5)).toBeGreaterThanOrEqual(1000)
    expect(computeBackoffDelayMs(1, NaN)).toBeGreaterThanOrEqual(1000)
  })
})

describe('BaseChannelAdapter.getReadiness / getCapabilities', () => {
  const REAL_ENV = process.env
  afterEach(() => {
    process.env = REAL_ENV
  })

  it('reports NOT_CONFIGURED when CHANNEL_TIKTOK_SHOP_ENABLED is unset', () => {
    process.env = { ...REAL_ENV }
    delete process.env.CHANNEL_TIKTOK_SHOP_ENABLED
    const adapter = new TestChannelAdapter()
    expect(adapter.getReadiness()).toBe('NOT_CONFIGURED')
  })

  it('reports NEEDS_CREDENTIALS when enabled but app key/secret are missing', () => {
    process.env = { ...REAL_ENV, CHANNEL_TIKTOK_SHOP_ENABLED: 'true' }
    delete process.env.CHANNEL_TIKTOK_SHOP_APP_KEY
    delete process.env.CHANNEL_TIKTOK_SHOP_APP_SECRET
    const adapter = new TestChannelAdapter()
    expect(adapter.getReadiness()).toBe('NEEDS_CREDENTIALS')
  })

  it('reports AVAILABLE only when enabled AND both app key/secret are present', () => {
    process.env = {
      ...REAL_ENV,
      CHANNEL_TIKTOK_SHOP_ENABLED: 'true',
      CHANNEL_TIKTOK_SHOP_APP_KEY: 'key',
      CHANNEL_TIKTOK_SHOP_APP_SECRET: 'secret',
    }
    const adapter = new TestChannelAdapter()
    expect(adapter.getReadiness()).toBe('AVAILABLE')
  })
})
