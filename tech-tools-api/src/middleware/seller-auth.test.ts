jest.mock('../database/connection', () => ({ query: jest.fn() }))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import { query } from '../database/connection'
import { requireAdminOrOnboardedSeller, requireSellerProfile } from './seller-auth'

const mockQuery = query as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

// Real Postgres semantics, applied by hand against the exact SQL text
// the middleware sends -- this is what actually decides whether a given
// account_status would come back as a row or not, so a regression that
// silently re-tightens the WHERE clause (e.g. back to `= 'ACTIVE'`, or
// dropping 'CLOSED' from the exclusion list) is caught here even though
// the mock database itself has no real filtering logic.
function evaluateWhereClauseForStatus(sql: string, status: string): boolean {
  const notInMatch = sql.match(/account_status\s+NOT\s+IN\s*\(([^)]+)\)/i)
  if (notInMatch) {
    const excluded = notInMatch[1].split(',').map((s) => s.trim().replace(/'/g, ''))
    return !excluded.includes(status)
  }
  const equalsMatch = sql.match(/account_status\s*=\s*'([A-Z_]+)'/i)
  if (equalsMatch) {
    return equalsMatch[1] === status
  }
  // No account_status filter in the query at all -- every status matches.
  return true
}

function mockAccountStatus(status: string) {
  mockQuery.mockImplementation(async (sql: string) => {
    return { rows: evaluateWhereClauseForStatus(sql, status) ? [{ id: 'sp-1' }] : [] }
  })
}

describe('requireAdminOrOnboardedSeller -- business-strategy gate: onboarded and not suspended/closed, not full approval', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each(['DRAFT', 'PENDING_REVIEW', 'RESTRICTED', 'REJECTED', 'ACTIVE'])(
    'allows a seller whose account_status is %s',
    async (status) => {
      mockAccountStatus(status)
      const req: any = { user: { id: 'user-1', userType: 'customer' } }
      const res = makeRes()
      const next = jest.fn()

      await requireAdminOrOnboardedSeller(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(req.sellerProfileId).toBe('sp-1')
    },
  )

  it.each(['SUSPENDED', 'CLOSED'])('denies (403) a seller whose account_status is %s', async (status) => {
    mockAccountStatus(status)
    const req: any = { user: { id: 'user-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireAdminOrOnboardedSeller(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('the query sent to the database excludes SUSPENDED and CLOSED specifically, not a narrower allowlist like just ACTIVE', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'sp-1' }] })
    const req: any = { user: { id: 'user-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireAdminOrOnboardedSeller(req, res, next)

    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/account_status\s+NOT\s+IN\s*\(\s*'SUSPENDED'\s*,\s*'CLOSED'\s*\)/i)
  })

  it('denies a customer with no seller_profiles row at all', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { id: 'user-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireAdminOrOnboardedSeller(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('lets admin and super_admin through without querying the database', async () => {
    for (const userType of ['admin', 'super_admin']) {
      jest.clearAllMocks()
      const req: any = { user: { id: 'admin-1', userType } }
      const res = makeRes()
      const next = jest.fn()

      await requireAdminOrOnboardedSeller(req, res, next)

      expect(mockQuery).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    }
  })

  it('rejects with 401 when there is no authenticated user', async () => {
    const req: any = {}
    const res = makeRes()
    const next = jest.fn()

    await requireAdminOrOnboardedSeller(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('requireSellerProfile -- looser still: any seller_profiles row, including SUSPENDED', () => {
  beforeEach(() => jest.clearAllMocks())

  it('allows a suspended seller through -- support must stay reachable', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'sp-1' }] })
    const req: any = { user: { id: 'user-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireSellerProfile(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.sellerProfileId).toBe('sp-1')
  })

  it('denies a customer with no seller_profiles row at all', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { id: 'user-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireSellerProfile(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
