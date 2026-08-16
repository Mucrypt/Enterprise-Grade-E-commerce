import {
  listChannelAccounts,
  startChannelOAuth,
  completeChannelOAuth,
  disconnectChannelAccount,
} from './channel-account.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

// channel-oauth-state.helpers.ts stores OAuth state in Redis, same as
// PROMOTION-OPS-1's promotion-oauth-state.helpers.ts -- faked here as a
// simple in-memory Map with the same get/set/del surface.
const fakeRedisStore = new Map<string, string>()
jest.mock('../../../config/redis', () => ({
  __esModule: true,
  default: () => ({
    get: jest.fn(async (key: string) => fakeRedisStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      fakeRedisStore.set(key, value)
    }),
    del: jest.fn(async (key: string) => {
      fakeRedisStore.delete(key)
    }),
  }),
}))

const mockQuery = query as jest.Mock
const ALLOWED_ORIGIN = 'https://admin.example.com'

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const makeReq = (overrides: any = {}) => ({
  user: { userId: 'owner-1', userType: 'customer' },
  body: {},
  params: {},
  query: {},
  ...overrides,
})

describe('listChannelAccounts -- response DTO never leaks token columns', () => {
  beforeEach(() => jest.clearAllMocks())

  it('never includes access_token_encrypted, refresh_token_encrypted, or shop_cipher in the JSON response, even though the DB row conceptually has them', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'account-1',
          channel_type: 'TIKTOK_SHOP',
          display_name: 'TechTools Italy',
          external_shop_id: 'shop-123',
          market_country: 'IT',
          market_currency: 'EUR',
          status: 'CONNECTED',
          sync_mode: 'READ_ONLY',
          scopes: ['product.read', 'order.read'],
          connected_at: '2026-08-01T00:00:00.000Z',
          last_validated_at: '2026-08-10T00:00:00.000Z',
          last_error: null,
          disabled_by_admin: false,
          access_token_expires_at: '2026-09-01T00:00:00.000Z',
          metadata: {},
          // A real row would also carry these -- the controller's SELECT
          // doesn't even ask for them, but this test asserts the response
          // shape itself is safe regardless of what the row contains.
          access_token_encrypted: 'v1:realiv:realtag:realciphertext',
          refresh_token_encrypted: 'v1:realiv2:realtag2:realciphertext2',
          shop_cipher: 'real-shop-cipher-value',
        },
      ],
    })
    const req: any = makeReq()
    const res = makeRes()

    await listChannelAccounts(req, res)

    const payload = res.json.mock.calls[0][0]
    const responseText = JSON.stringify(payload)
    expect(responseText).not.toContain('access_token_encrypted')
    expect(responseText).not.toContain('refresh_token_encrypted')
    expect(responseText).not.toContain('realciphertext')
    expect(responseText).not.toContain('real-shop-cipher-value')
    expect(payload.accounts[0]).toEqual({
      id: 'account-1',
      channelType: 'TIKTOK_SHOP',
      displayName: 'TechTools Italy',
      externalShopId: 'shop-123',
      marketCountry: 'IT',
      marketCurrency: 'EUR',
      status: 'CONNECTED',
      syncMode: 'READ_ONLY',
      scopes: ['product.read', 'order.read'],
      connectedAt: '2026-08-01T00:00:00.000Z',
      lastValidatedAt: '2026-08-10T00:00:00.000Z',
      lastError: null,
      disabledByAdmin: false,
      accessTokenExpiresAt: '2026-09-01T00:00:00.000Z',
      metadata: {},
    })
  })

  it('includes the live capability matrix alongside accounts, honestly reflecting this environment (no real credentials configured)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq()
    const res = makeRes()

    await listChannelAccounts(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.capabilities).toHaveLength(1)
    expect(['NOT_CONFIGURED', 'NEEDS_CREDENTIALS']).toContain(payload.capabilities[0].readiness)
  })
})

describe('startChannelOAuth', () => {
  const REAL_ENV = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    fakeRedisStore.clear()
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: ALLOWED_ORIGIN }
  })
  afterAll(() => {
    process.env = REAL_ENV
  })

  it('returns 409 with readiness info for TIKTOK_SHOP with no credentials configured in this environment, and issues no DB query', async () => {
    const req: any = makeReq({ params: { channelType: 'tiktok_shop' }, body: { redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    const res = makeRes()

    await startChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    const payload = res.json.mock.calls[0][0]
    expect(['NOT_CONFIGURED', 'NEEDS_CREDENTIALS']).toContain(payload.readiness)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects an unknown channel type', async () => {
    const req: any = makeReq({ params: { channelType: 'amazon' }, body: { redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    const res = makeRes()

    await startChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a request with no redirectUri', async () => {
    const req: any = makeReq({ params: { channelType: 'tiktok_shop' }, body: {} })
    const res = makeRes()

    await startChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a redirectUri whose origin is not on the allowlist -- fails BEFORE checking channel readiness', async () => {
    const req: any = makeReq({ params: { channelType: 'tiktok_shop' }, body: { redirectUri: 'https://attacker.example.com/callback' } })
    const res = makeRes()

    await startChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = res.json.mock.calls[0][0]
    expect(payload.error).toMatch(/not an allowed origin/i)
  })

  it('fails closed -- rejects every redirectUri when CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS is unset', async () => {
    delete process.env.CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS
    const req: any = makeReq({ params: { channelType: 'tiktok_shop' }, body: { redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    const res = makeRes()

    await startChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})

describe('completeChannelOAuth -- CSRF state, redirectUri, actor binding, and marketCurrency validation', () => {
  const REAL_ENV = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    fakeRedisStore.clear()
    process.env = { ...REAL_ENV, CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS: ALLOWED_ORIGIN }
  })
  afterAll(() => {
    process.env = REAL_ENV
  })

  it('rejects a completion attempt with an unknown/expired state -- never proceeds to a token exchange', async () => {
    const req: any = makeReq({
      body: { code: 'auth-code', state: 'never-issued-state', redirectUri: `${ALLOWED_ORIGIN}/callback`, marketCurrency: 'EUR' },
    })
    const res = makeRes()

    await completeChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a request missing code/state/redirectUri', async () => {
    const req: any = makeReq({ body: { code: 'auth-code', marketCurrency: 'EUR' } })
    const res = makeRes()

    await completeChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a request with a missing or malformed marketCurrency, before consuming the OAuth state', async () => {
    fakeRedisStore.set(
      'commerce_channel_oauth_state:state-currency',
      JSON.stringify({ channelType: 'TIKTOK_SHOP', userId: 'owner-1', redirectUri: `${ALLOWED_ORIGIN}/callback` }),
    )
    const req: any = makeReq({
      body: { code: 'auth-code', state: 'state-currency', redirectUri: `${ALLOWED_ORIGIN}/callback`, marketCurrency: 'euros' },
    })
    const res = makeRes()

    await completeChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = res.json.mock.calls[0][0]
    expect(payload.error).toMatch(/marketCurrency/)
    // The state must still be present (never consumed) since validation
    // failed before the state lookup.
    expect(fakeRedisStore.has('commerce_channel_oauth_state:state-currency')).toBe(true)
  })

  it('rejects completion by a different user than the one who initiated the OAuth flow (actor binding)', async () => {
    fakeRedisStore.set(
      'commerce_channel_oauth_state:state-abc',
      JSON.stringify({ channelType: 'TIKTOK_SHOP', userId: 'owner-1', redirectUri: `${ALLOWED_ORIGIN}/callback` }),
    )
    const req: any = makeReq({
      user: { userId: 'a-different-user', userType: 'customer' },
      body: { code: 'auth-code', state: 'state-abc', redirectUri: `${ALLOWED_ORIGIN}/callback`, marketCurrency: 'EUR' },
    })
    const res = makeRes()

    await completeChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockQuery).not.toHaveBeenCalled()
    expect(fakeRedisStore.has('commerce_channel_oauth_state:state-abc')).toBe(false)
  })

  it('rejects completion with a redirectUri that does not match the one the flow was started with', async () => {
    fakeRedisStore.set(
      'commerce_channel_oauth_state:state-abc',
      JSON.stringify({ channelType: 'TIKTOK_SHOP', userId: 'owner-1', redirectUri: `${ALLOWED_ORIGIN}/callback` }),
    )
    const req: any = makeReq({
      body: { code: 'auth-code', state: 'state-abc', redirectUri: `${ALLOWED_ORIGIN}/different-callback`, marketCurrency: 'EUR' },
    })
    const res = makeRes()

    await completeChannelOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = res.json.mock.calls[0][0]
    expect(payload.error).toMatch(/redirectUri does not match/i)
  })

  it('a state is single-use -- completing it once consumes it, a second attempt with the same state fails', async () => {
    fakeRedisStore.set(
      'commerce_channel_oauth_state:state-xyz',
      JSON.stringify({ channelType: 'TIKTOK_SHOP', userId: 'owner-1', redirectUri: `${ALLOWED_ORIGIN}/callback` }),
    )
    // First completion will fail downstream (TikTok Shop adapter not
    // configured -> exchangeCodeForToken throws), but the state must
    // still be consumed on that first read, before the exchange attempt.
    const req1: any = makeReq({
      body: { code: 'auth-code', state: 'state-xyz', redirectUri: `${ALLOWED_ORIGIN}/callback`, marketCurrency: 'EUR' },
    })
    await completeChannelOAuth(req1, makeRes())
    expect(fakeRedisStore.has('commerce_channel_oauth_state:state-xyz')).toBe(false)

    const req2: any = makeReq({
      body: { code: 'auth-code', state: 'state-xyz', redirectUri: `${ALLOWED_ORIGIN}/callback`, marketCurrency: 'EUR' },
    })
    const res2 = makeRes()
    await completeChannelOAuth(req2, res2)
    expect(res2.status).toHaveBeenCalledWith(400)
  })
})

describe('disconnectChannelAccount', () => {
  beforeEach(() => jest.clearAllMocks())

  it('clears both token columns to NULL on disconnect, not just flipping status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] }) // channel_activity_log insert
    const req: any = makeReq({ params: { id: 'account-1' } })
    const res = makeRes()

    await disconnectChannelAccount(req, res)

    expect(mockQuery.mock.calls[0][0]).toContain('access_token_encrypted = NULL')
    expect(mockQuery.mock.calls[0][0]).toContain('refresh_token_encrypted = NULL')
  })

  it('404s for a nonexistent channel account', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ params: { id: 'missing' } })
    const res = makeRes()

    await disconnectChannelAccount(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})
