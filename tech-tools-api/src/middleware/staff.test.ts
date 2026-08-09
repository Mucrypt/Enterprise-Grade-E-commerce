import {
  requireStaff,
  requirePermission,
  requirePermissionOrLegacyRole,
  applyMarketScope,
  StaffAuthRequest,
} from './staff'
import { query } from '../database/connection'

jest.mock('../database/connection', () => ({
  query: jest.fn(),
}))

jest.mock('../services/staff-audit.service', () => ({
  recordStaffAuditEvent: jest.fn(),
}))

jest.mock('../utils/logger', () => ({
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

const activeMembershipRow = (role: string, marketScope: string[] | null = null) => ({
  id: `membership-${role}`,
  role,
  market_scope: marketScope,
})

describe('requireStaff', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    const req: any = { user: undefined }
    const res = makeRes()
    const next = jest.fn()

    await requireStaff('OWNER')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next for a customer holding an ACTIVE MARKET_MANAGER membership', async () => {
    mockQuery.mockResolvedValue({ rows: [activeMembershipRow('MARKET_MANAGER', ['CM'])] })
    const req: any = { user: { userId: 'u1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireStaff('MARKET_MANAGER', 'OWNER')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.staff.memberships).toHaveLength(1)
  })

  it('rejects a plain customer with no staff_memberships row at all', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { userId: 'u2', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireStaff('MARKET_MANAGER')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects when the DB reports no ACTIVE row (SUSPENDED/REVOKED are filtered by the query itself)', async () => {
    // The query middleware issues always filters `WHERE status = 'ACTIVE'` --
    // simulate that by having the mock return nothing, exactly what a real
    // suspended/revoked-only user would get back.
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { userId: 'u3', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireStaff('MARKET_MANAGER')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('issues the query with WHERE status = ACTIVE', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { userId: 'u4', userType: 'customer' } }
    await requireStaff('OWNER')(req, makeRes(), jest.fn())

    expect(mockQuery.mock.calls[0][0]).toContain("status = 'ACTIVE'")
  })
})

describe('requirePermission', () => {
  beforeEach(() => jest.clearAllMocks())

  it('allows a permission granted by the role matrix', async () => {
    mockQuery.mockResolvedValue({ rows: [activeMembershipRow('MARKET_MANAGER')] })
    const req: any = { user: { userId: 'u1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermission('orders.view')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('denies a permission not granted to any active role, e.g. MARKET_MANAGER + orders.refund', async () => {
    mockQuery.mockResolvedValue({ rows: [activeMembershipRow('MARKET_MANAGER')] })
    const req: any = { user: { userId: 'u1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermission('orders.refund')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('denies a plain customer (no staff role) everything', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { userId: 'customer-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermission('staff.view')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
  })
})

describe('requirePermissionOrLegacyRole', () => {
  beforeEach(() => jest.clearAllMocks())

  it('lets a legacy super_admin through without any staff_memberships row', async () => {
    const req: any = { user: { userId: 'legacy-1', userType: 'super_admin' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('staff.grant', 'super_admin')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(mockQuery).not.toHaveBeenCalled() // never even needed to check staff_memberships
  })

  it('falls back to the permission check for a non-legacy user', async () => {
    mockQuery.mockResolvedValue({ rows: [activeMembershipRow('OWNER')] })
    const req: any = { user: { userId: 'owner-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('staff.grant', 'super_admin')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('rejects a plain legacy admin (not super_admin) with no staff role', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { userId: 'admin-1', userType: 'admin' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('staff.grant', 'super_admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
  })
})

describe('applyMarketScope', () => {
  it('returns no restriction when the caller has no staff context at all', () => {
    const req = {} as StaffAuthRequest
    const result = applyMarketScope(req, 'orders', 1)
    expect(result.clause).toBe('')
    expect(result.params).toEqual([])
  })

  it('returns no restriction if ANY active membership is global (null market_scope)', () => {
    const req = {
      staff: {
        memberships: [
          { id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] },
          { id: 'm2', role: 'SUPPORT_AGENT', marketScope: null },
        ],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    const result = applyMarketScope(req, 'orders', 1)
    expect(result.clause).toBe('')
  })

  it('filters by the union of scoped country codes when every membership is scoped', () => {
    const req = {
      staff: {
        memberships: [
          { id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] },
          { id: 'm2', role: 'ORDER_MANAGER', marketScope: ['GH', 'NG'] },
        ],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    const result = applyMarketScope(req, 'orders', 3)
    expect(result.clause).toBe(`AND shipping_address->>'country' = ANY($3)`)
    expect(result.params).toEqual([['CM', 'GH', 'NG']])
  })

  it('uses the suppliers.country_code expression for the suppliers resource', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    const result = applyMarketScope(req, 'suppliers', 2)
    expect(result.clause).toBe('AND country_code = ANY($2)')
  })

  it('fails closed (matches nothing) if scope resolves to an empty set', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: [] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    const result = applyMarketScope(req, 'orders', 1)
    expect(result.clause).toBe('AND 1 = 0')
  })
})
