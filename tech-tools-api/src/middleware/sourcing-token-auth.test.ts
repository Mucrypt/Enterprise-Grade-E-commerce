import { authenticateSourcingToken } from './sourcing-token-auth'
import { query } from '../database/connection'
import { resolveToken } from '../services/sourcing/sourcing-token.service'

jest.mock('../database/connection', () => ({ query: jest.fn() }))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('../services/sourcing/sourcing-token.service', () => ({ resolveToken: jest.fn() }))

const mockQuery = query as jest.Mock
const mockResolveToken = resolveToken as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
const makeReq = (headers: Record<string, string> = {}) => ({ headers } as any)

describe('authenticateSourcingToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401s with a generic message when the Authorization header is missing', async () => {
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn()
    await authenticateSourcingToken(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid or expired sourcing API token' })
    expect(next).not.toHaveBeenCalled()
    expect(mockResolveToken).not.toHaveBeenCalled()
  })

  it('401s with the same generic message for a malformed (non-Bearer) header', async () => {
    const req = makeReq({ authorization: 'Basic abc123' })
    const res = makeRes()
    const next = jest.fn()
    await authenticateSourcingToken(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid or expired sourcing API token' })
  })

  it('401s with the same generic message for an empty Bearer token', async () => {
    const req = makeReq({ authorization: 'Bearer  ' })
    const res = makeRes()
    const next = jest.fn()
    await authenticateSourcingToken(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('401s with the same generic message for an unknown/revoked/expired token -- resolveToken returning null covers all three, indistinguishably', async () => {
    mockResolveToken.mockResolvedValue(null)
    const req = makeReq({ authorization: 'Bearer some-unknown-token' })
    const res = makeRes()
    const next = jest.fn()
    await authenticateSourcingToken(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid or expired sourcing API token' })
  })

  it('401s if the resolved token points at a user that no longer exists', async () => {
    mockResolveToken.mockResolvedValue({ id: 'token-1', userId: 'user-1' })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req = makeReq({ authorization: 'Bearer valid-token' })
    const res = makeRes()
    const next = jest.fn()
    await authenticateSourcingToken(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('sets req.user identically to authenticate() and calls next() on a valid token', async () => {
    mockResolveToken.mockResolvedValue({ id: 'token-1', userId: 'user-1' })
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'founder@example.com', user_type: 'admin' }] })
    const req = makeReq({ authorization: 'Bearer valid-token' })
    const res = makeRes()
    const next = jest.fn()

    await authenticateSourcingToken(req, res, next)

    expect(req.user).toEqual({ id: 'user-1', userId: 'user-1', email: 'founder@example.com', userType: 'admin' })
    expect((req as any).sourcingTokenId).toBe('token-1')
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 500 (not a silent pass-through) on an unexpected internal error', async () => {
    mockResolveToken.mockRejectedValue(new Error('db down'))
    const req = makeReq({ authorization: 'Bearer valid-token' })
    const res = makeRes()
    const next = jest.fn()
    await authenticateSourcingToken(req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(next).not.toHaveBeenCalled()
  })
})
