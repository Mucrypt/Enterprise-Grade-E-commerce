import { issueToken, listTokensForUser, revokeToken, resolveToken } from './sourcing-token.service'
import { query } from '../../database/connection'

jest.mock('../../database/connection', () => ({ query: jest.fn() }))

const mockQuery = query as jest.Mock

describe('issueToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('generates a high-entropy raw token, stores only its hash, and returns the raw value exactly once', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'token-1' }] })

    const result = await issueToken('user-1', 'Chrome extension - laptop', 90)

    expect(result.rawToken).toHaveLength(64) // 32 random bytes as hex
    expect(result.tokenPrefix).toBe(result.rawToken.slice(0, 10))

    const insertParams = mockQuery.mock.calls[0][1]
    expect(insertParams).not.toContain(result.rawToken) // the raw value is never itself stored
    expect(insertParams[0]).toBe('user-1')
    expect(insertParams[1]).toBe('Chrome extension - laptop')
  })

  it('stores no expiry when expiresInDays is omitted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'token-1' }] })
    await issueToken('user-1', 'No-expiry token')
    const insertParams = mockQuery.mock.calls[0][1]
    expect(insertParams[4]).toBeNull()
  })
})

describe('listTokensForUser', () => {
  beforeEach(() => jest.clearAllMocks())

  it('never selects token_hash -- only token_prefix and metadata', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listTokensForUser('user-1')
    expect(mockQuery.mock.calls[0][0]).not.toContain('token_hash')
    expect(mockQuery.mock.calls[0][0]).toContain('token_prefix')
  })
})

describe('revokeToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('only revokes a token owned by the requesting user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'token-1' }], rowCount: 1 })
    const result = await revokeToken('token-1', 'user-1')
    expect(result).toBe(true)
    expect(mockQuery.mock.calls[0][1]).toEqual(['token-1', 'user-1'])
  })

  it('returns false for a token that does not exist or is not owned by this user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const result = await revokeToken('token-1', 'user-2')
    expect(result).toBe(false)
  })
})

describe('resolveToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns null for an unknown token hash', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await resolveToken('some-raw-token')
    expect(result).toBeNull()
  })

  it('excludes revoked and expired tokens at the SQL level', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await resolveToken('some-raw-token')
    expect(mockQuery.mock.calls[0][0]).toContain('revoked_at IS NULL')
    expect(mockQuery.mock.calls[0][0]).toContain('expires_at IS NULL OR expires_at > now()')
  })

  it('returns the resolved id/userId and fires a fire-and-forget last_used_at update', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'token-1', user_id: 'user-1' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await resolveToken('some-raw-token')

    expect(result).toEqual({ id: 'token-1', userId: 'user-1' })
  })
})
