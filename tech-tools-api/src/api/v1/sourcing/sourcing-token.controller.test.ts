import { issueSourcingToken, listSourcingTokens, revokeSourcingToken } from './sourcing-token.controller'
import * as tokenService from '../../../services/sourcing/sourcing-token.service'

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('../../../services/sourcing/sourcing-token.service', () => ({
  issueToken: jest.fn(),
  listTokensForUser: jest.fn(),
  revokeToken: jest.fn(),
}))

const mockIssueToken = tokenService.issueToken as jest.Mock
const mockListTokensForUser = tokenService.listTokensForUser as jest.Mock
const mockRevokeToken = tokenService.revokeToken as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
const makeReq = (overrides: any = {}) => ({ user: { userId: 'user-1', userType: 'admin' }, body: {}, params: {}, ...overrides })

describe('issueSourcingToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('requires a name', async () => {
    const req: any = makeReq({ body: {} })
    const res = makeRes()
    await issueSourcingToken(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockIssueToken).not.toHaveBeenCalled()
  })

  it('returns the raw token exactly once at issuance', async () => {
    mockIssueToken.mockResolvedValue({ id: 'token-1', rawToken: 'raw-secret-value', tokenPrefix: 'raw-secre' })
    const req: any = makeReq({ body: { name: 'Chrome extension' } })
    const res = makeRes()
    await issueSourcingToken(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { id: 'token-1', token: 'raw-secret-value', tokenPrefix: 'raw-secre' },
    })
  })
})

describe('listSourcingTokens', () => {
  beforeEach(() => jest.clearAllMocks())

  it('never returns a raw token value from the list -- only what the service itself returns (token_prefix, not token_hash)', async () => {
    mockListTokensForUser.mockResolvedValue([{ id: 'token-1', name: 'x', token_prefix: 'abc1234567' }])
    const req: any = makeReq()
    const res = makeRes()
    await listSourcingTokens(req, res)
    const body = res.json.mock.calls[0][0]
    expect(JSON.stringify(body)).not.toContain('token_hash')
  })
})

describe('revokeSourcingToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('404s if the token does not exist or is not owned by this user', async () => {
    mockRevokeToken.mockResolvedValue(false)
    const req: any = makeReq({ params: { id: 'token-1' } })
    const res = makeRes()
    await revokeSourcingToken(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('revokes successfully', async () => {
    mockRevokeToken.mockResolvedValue(true)
    const req: any = makeReq({ params: { id: 'token-1' } })
    const res = makeRes()
    await revokeSourcingToken(req, res)
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })
})
