import { listConnections, startOAuth, completeOAuth, disconnectConnection } from './social-connection.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock

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
  beforeEach(() => jest.clearAllMocks())

  it('returns 409 with readiness info for a platform with no credentials configured in this environment, and issues no DB query', async () => {
    const req: any = makeReq({ params: { platform: 'facebook' }, body: { redirectUri: 'https://admin.example.com/callback' } })
    const res = makeRes()

    await startOAuth(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    const payload = res.json.mock.calls[0][0]
    expect(['NOT_CONFIGURED', 'NEEDS_CREDENTIALS']).toContain(payload.readiness)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects an unknown platform', async () => {
    const req: any = makeReq({ params: { platform: 'friendster' }, body: { redirectUri: 'https://admin.example.com/callback' } })
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
})

describe('completeOAuth -- CSRF state handling', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a completion attempt with an unknown/expired state -- never proceeds to a token exchange for an unrecognized state', async () => {
    const req: any = makeReq({ body: { code: 'auth-code', state: 'never-issued-state', redirectUri: 'https://admin.example.com/callback' } })
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
