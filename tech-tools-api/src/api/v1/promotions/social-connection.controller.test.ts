import { listConnections, startOAuth, completeOAuth, disconnectConnection } from './social-connection.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

// promotion-oauth-state.helpers.ts stores OAuth state in Redis (Production
// Review Round 1 §11) -- faked here as a simple in-memory Map with the
// same get/set/del surface node-redis's client exposes, so these tests
// exercise the real controller logic without a live Redis instance.
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

describe('listConnections -- response DTO never leaks token columns', () => {
  beforeEach(() => jest.clearAllMocks())

  it('never includes access_token_encrypted or refresh_token_encrypted in the JSON response, even though the DB row conceptually has them', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'conn-1',
          platform: 'FACEBOOK',
          display_name: 'TechTools Store',
          external_account_id: 'page-123',
          status: 'CONNECTED',
          scopes: ['pages_manage_posts'],
          connected_at: '2026-08-01T00:00:00.000Z',
          last_validated_at: '2026-08-10T00:00:00.000Z',
          last_error: null,
          disabled_by_admin: false,
          token_expires_at: '2026-10-01T00:00:00.000Z',
          metadata: { pageCategory: 'Retail' },
          // A real row would also carry these -- the controller's SELECT
          // doesn't even ask for them, but this test asserts the response
          // shape itself is safe regardless of what the row contains.
          access_token_encrypted: 'v1:realiv:realtag:realciphertext',
          refresh_token_encrypted: 'v1:realiv2:realtag2:realciphertext2',
        },
      ],
    })
    const req: any = makeReq()
    const res = makeRes()

    await listConnections(req, res)

    const payload = res.json.mock.calls[0][0]
    const responseText = JSON.stringify(payload)
    expect(responseText).not.toContain('access_token_encrypted')
    expect(responseText).not.toContain('refresh_token_encrypted')
    expect(responseText).not.toContain('realciphertext')
    expect(payload.connections[0]).toEqual({
      id: 'conn-1',
      platform: 'FACEBOOK',
      displayName: 'TechTools Store',
      externalAccountId: 'page-123',
      status: 'CONNECTED',
      scopes: ['pages_manage_posts'],
      connectedAt: '2026-08-01T00:00:00.000Z',
      lastValidatedAt: '2026-08-10T00:00:00.000Z',
      lastError: null,
      disabledByAdmin: false,
      tokenExpiresAt: '2026-10-01T00:00:00.000Z',
      metadata: { pageCategory: 'Retail' },
    })
  })

  it('includes the live capability matrix alongside connections, honestly reflecting this environment (no real credentials configured)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq()
    const res = makeRes()

    await listConnections(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.capabilities).toHaveLength(6)
    for (const cap of payload.capabilities) {
      expect(['NOT_CONFIGURED', 'NEEDS_CREDENTIALS']).toContain(cap.readiness)
    }
  })
})

describe('startOAuth', () => {
  const REAL_ENV = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    fakeRedisStore.clear()
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: ALLOWED_ORIGIN }
  })
  afterAll(() => {
    process.env = REAL_ENV
  })

  it('returns 409 with readiness info for a platform with no credentials configured in this environment, and issues no DB query', async () => {
    const req: any = makeReq({ params: { platform: 'facebook' }, body: { redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    const res = makeRes()

    await startOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    const payload = res.json.mock.calls[0][0]
    expect(['NOT_CONFIGURED', 'NEEDS_CREDENTIALS']).toContain(payload.readiness)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects an unknown platform', async () => {
    const req: any = makeReq({ params: { platform: 'friendster' }, body: { redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    const res = makeRes()

    await startOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a request with no redirectUri', async () => {
    const req: any = makeReq({ params: { platform: 'facebook' }, body: {} })
    const res = makeRes()

    await startOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a redirectUri whose origin is not on the allowlist -- fails BEFORE checking platform readiness', async () => {
    const req: any = makeReq({ params: { platform: 'facebook' }, body: { redirectUri: 'https://attacker.example.com/callback' } })
    const res = makeRes()

    await startOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = res.json.mock.calls[0][0]
    expect(payload.error).toMatch(/not an allowed origin/i)
  })

  it('fails closed -- rejects every redirectUri when SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS is unset, never treating "unconfigured" as "allow anything"', async () => {
    delete process.env.SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS
    const req: any = makeReq({ params: { platform: 'facebook' }, body: { redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    const res = makeRes()

    await startOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})

describe('completeOAuth -- CSRF state, redirectUri, and actor binding', () => {
  const REAL_ENV = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    fakeRedisStore.clear()
    process.env = { ...REAL_ENV, SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS: ALLOWED_ORIGIN }
  })
  afterAll(() => {
    process.env = REAL_ENV
  })

  it('rejects a completion attempt with an unknown/expired state -- never proceeds to a token exchange for an unrecognized state', async () => {
    const req: any = makeReq({ body: { code: 'auth-code', state: 'never-issued-state', redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    const res = makeRes()

    await completeOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a request missing code/state/redirectUri', async () => {
    const req: any = makeReq({ body: { code: 'auth-code' } })
    const res = makeRes()

    await completeOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects completion by a different user than the one who initiated the OAuth flow (actor binding)', async () => {
    fakeRedisStore.set(
      'promotion_oauth_state:state-abc',
      JSON.stringify({ platform: 'FACEBOOK', codeVerifier: 'verifier', userId: 'owner-1', redirectUri: `${ALLOWED_ORIGIN}/callback` }),
    )
    const req: any = makeReq({
      user: { userId: 'a-different-user', userType: 'customer' },
      body: { code: 'auth-code', state: 'state-abc', redirectUri: `${ALLOWED_ORIGIN}/callback` },
    })
    const res = makeRes()

    await completeOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockQuery).not.toHaveBeenCalled()
    // One-time use regardless of outcome -- a retry with the same state must also fail.
    expect(fakeRedisStore.has('promotion_oauth_state:state-abc')).toBe(false)
  })

  it('rejects completion with a redirectUri that does not match the one the flow was started with', async () => {
    fakeRedisStore.set(
      'promotion_oauth_state:state-abc',
      JSON.stringify({ platform: 'FACEBOOK', codeVerifier: 'verifier', userId: 'owner-1', redirectUri: `${ALLOWED_ORIGIN}/callback` }),
    )
    const req: any = makeReq({
      body: { code: 'auth-code', state: 'state-abc', redirectUri: `${ALLOWED_ORIGIN}/different-callback` },
    })
    const res = makeRes()

    await completeOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = res.json.mock.calls[0][0]
    expect(payload.error).toMatch(/redirectUri does not match/i)
  })

  it('a state is single-use -- completing it once consumes it, a second attempt with the same state fails', async () => {
    fakeRedisStore.set(
      'promotion_oauth_state:state-xyz',
      JSON.stringify({ platform: 'FACEBOOK', codeVerifier: 'verifier', userId: 'owner-1', redirectUri: `${ALLOWED_ORIGIN}/callback` }),
    )
    // First completion will fail downstream (Facebook adapter not
    // configured -> exchangeCodeForToken throws), but the state must still
    // be consumed on that first read, before the exchange is attempted.
    const req1: any = makeReq({ body: { code: 'auth-code', state: 'state-xyz', redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    await completeOAuth(req1, makeRes())
    expect(fakeRedisStore.has('promotion_oauth_state:state-xyz')).toBe(false)

    const req2: any = makeReq({ body: { code: 'auth-code', state: 'state-xyz', redirectUri: `${ALLOWED_ORIGIN}/callback` } })
    const res2 = makeRes()
    await completeOAuth(req2, res2)
    expect(res2.status).toHaveBeenCalledWith(400)
  })
})

describe('disconnectConnection', () => {
  beforeEach(() => jest.clearAllMocks())

  it('clears both token columns to NULL on disconnect, not just flipping status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'conn-1' }] })
    const req: any = makeReq({ params: { id: 'conn-1' } })
    const res = makeRes()

    await disconnectConnection(req, res)

    expect(mockQuery.mock.calls[0][0]).toContain('access_token_encrypted = NULL')
    expect(mockQuery.mock.calls[0][0]).toContain('refresh_token_encrypted = NULL')
  })

  it('404s for a nonexistent connection', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ params: { id: 'missing' } })
    const res = makeRes()

    await disconnectConnection(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})
