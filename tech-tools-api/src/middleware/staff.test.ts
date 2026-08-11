import {
  requireStaff,
  requirePermission,
  requirePermissionOrLegacyRole,
  applyMarketScope,
  isCountryInScope,
  StaffAuthRequest,
} from './staff'
import { query } from '../database/connection'
import { STAFF_ROLE_PERMISSIONS } from '../config/staff-permissions.config'

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
    expect(result.clause).toBe(`AND LOWER(o.shipping_address->>'country') = ANY($3)`)
    // Expanded to include both the ISO code and its known full name, since
    // production's actual stored format isn't confirmed -- see
    // config/country-reference.config.ts.
    expect(result.params).toEqual([
      expect.arrayContaining(['cm', 'cameroon', 'gh', 'ghana', 'ng', 'nigeria']),
    ])
    expect((result.params[0] as string[]).sort()).toEqual(
      ['cm', 'cameroon', 'gh', 'ghana', 'ng', 'nigeria'].sort(),
    )
  })

  it('uses the suppliers.country_code expression for the suppliers resource', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    const result = applyMarketScope(req, 'suppliers', 2)
    expect(result.clause).toBe('AND LOWER(country_code) = ANY($2)')
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

describe('isCountryInScope (IDOR guard for :id routes)', () => {
  it('allows any country when the caller has global (null) scope', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'ADMIN', marketScope: null }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    expect(isCountryInScope(req, 'IT')).toBe(true)
    expect(isCountryInScope(req, 'Some Unknown Country')).toBe(true)
  })

  it('allows a row whose country matches the ISO code in scope', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    expect(isCountryInScope(req, 'CM')).toBe(true)
    expect(isCountryInScope(req, 'cm')).toBe(true)
  })

  it('allows a row whose country matches the full name of a scoped ISO code', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    expect(isCountryInScope(req, 'Cameroon')).toBe(true)
    expect(isCountryInScope(req, 'cameroon')).toBe(true)
  })

  it('denies a row outside the caller scope -- the actual IDOR case', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    expect(isCountryInScope(req, 'IT')).toBe(false)
    expect(isCountryInScope(req, 'Italy')).toBe(false)
    expect(isCountryInScope(req, 'US')).toBe(false)
  })

  it('denies when the row has no country value at all', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    expect(isCountryInScope(req, null)).toBe(false)
    expect(isCountryInScope(req, undefined)).toBe(false)
    expect(isCountryInScope(req, '')).toBe(false)
  })

  it('denies everything when scope is an explicitly empty array (fails closed)', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: [] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest

    expect(isCountryInScope(req, 'CM')).toBe(false)
  })
})

/**
 * Production Review Round 1 §16 -- "test direct API access, not only page
 * hiding." social-connection.routes.ts gates connect/disconnect/disable/
 * list-with-tokens behind social.accounts.manage / social.accounts.view,
 * strictly separate from social.publish/social.schedule (which
 * MARKETING_MANAGER does hold). These exercise the exact middleware
 * factory + exact permission strings those routes use, with req.staff
 * pre-populated from the real permission matrix (never DB-loaded) --
 * i.e. what actually runs on every request, not a UI visibility check.
 */
describe('requirePermissionOrLegacyRole -- social.accounts.* separation from social.publish/schedule', () => {
  beforeEach(() => jest.clearAllMocks())

  const staffReq = (role: keyof typeof STAFF_ROLE_PERMISSIONS, userType = 'customer') =>
    ({
      user: { userId: 'u1', userType },
      staff: {
        memberships: [{ id: 'm1', role, marketScope: null }],
        permissions: STAFF_ROLE_PERMISSIONS[role],
      },
    } as any as StaffAuthRequest)

  it('a MARKETING_MANAGER is denied direct API access to connect/disconnect/disable a social account (social.accounts.manage)', async () => {
    const req = staffReq('MARKETING_MANAGER')
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('social.accounts.manage', 'admin', 'super_admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('a MARKETING_MANAGER is denied direct API access to list connections with tokens (social.accounts.view)', async () => {
    const req = staffReq('MARKETING_MANAGER')
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('social.accounts.view', 'admin', 'super_admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('the same MARKETING_MANAGER IS allowed through the publish/schedule gates -- the denial above is specific to account management, not social.* as a whole', async () => {
    for (const permission of ['social.publish', 'social.schedule', 'social.view', 'social.analytics'] as const) {
      const req = staffReq('MARKETING_MANAGER')
      const res = makeRes()
      const next = jest.fn()

      await requirePermissionOrLegacyRole(permission, 'admin', 'super_admin')(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    }
  })

  it('ADMIN is likewise denied social.accounts.manage, matching its existing exclusion from settings/security/staff.manage', async () => {
    const req = staffReq('ADMIN')
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('social.accounts.manage', 'super_admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('OWNER and SUPER_ADMIN are allowed through social.accounts.manage', async () => {
    for (const role of ['OWNER', 'SUPER_ADMIN'] as const) {
      const req = staffReq(role)
      const res = makeRes()
      const next = jest.fn()

      await requirePermissionOrLegacyRole('social.accounts.manage', 'admin', 'super_admin')(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    }
  })

  it('a legacy bootstrap admin userType bypasses the permission check entirely, by documented design, regardless of their staff permission set', async () => {
    const req = staffReq('MARKET_MANAGER', 'admin')
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('social.accounts.manage', 'admin', 'super_admin')(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('a MARKET_MANAGER (no social.* permissions at all) is denied both account management and publish/schedule', async () => {
    for (const permission of ['social.accounts.manage', 'social.publish', 'social.schedule'] as const) {
      const req = staffReq('MARKET_MANAGER')
      const res = makeRes()
      const next = jest.fn()

      await requirePermissionOrLegacyRole(permission, 'admin', 'super_admin')(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    }
  })
})
