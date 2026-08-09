/**
 * ADMIN-2A.5 security integration test matrix.
 *
 * Exercises the real route-level middleware (requireStaff/requirePermission/
 * requirePermissionOrLegacyRole from middleware/staff.ts, authorize from
 * middleware/auth.ts) directly against representative requests, rather than
 * going through a full HTTP+DB integration harness this codebase doesn't
 * have. Each test below maps 1:1 to a scenario from
 * docs/ADMIN-2A5-STAFF-ACCESS-INTEGRATION-REPORT.md's security test matrix.
 * Scope/IDOR logic specific to a single resource (order/supplier country
 * matching, market-overview aggregation) has its own dedicated test file
 * next to that controller -- this file is the cross-cutting authorization
 * matrix, not a duplicate of those.
 */
import {
  requireStaff,
  requirePermission,
  requirePermissionOrLegacyRole,
} from '../middleware/staff'
import { authorize } from '../middleware/auth'
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

const activeRow = (role: string, marketScope: string[] | null = null) => ({
  id: `membership-${role}`,
  role,
  market_scope: marketScope,
})

describe('ADMIN-2A.5 security matrix', () => {
  beforeEach(() => jest.clearAllMocks())

  it('MARKET_MANAGER(["CM"]) is denied the global customer directory route gate', async () => {
    // customers.routes.ts was deliberately left on authorize('admin','super_admin')
    // -- customers have no country column of their own, so there is no safe
    // way to market-scope the directory; access stays order-linked only
    // (see the customer fields already embedded in order.controller.ts's
    // scoped order responses).
    const req: any = { user: { userId: 'manager-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    authorize('admin', 'super_admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('MARKET_MANAGER(["CM"]) is denied the settings route gate', async () => {
    // alert-thresholds.routes.ts (the settings surface) is also
    // deliberately left on authorize('admin','super_admin'); settings.view
    // is not in MARKET_MANAGER's permission set either way.
    const req: any = { user: { userId: 'manager-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    authorize('admin', 'super_admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('MARKET_MANAGER(["CM"]) is denied staff.view (no staff.* permission granted to the role)', async () => {
    mockQuery.mockResolvedValue({ rows: [activeRow('MARKET_MANAGER', ['CM'])] })
    const req: any = { user: { userId: 'manager-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('staff.view', 'super_admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('MARKET_MANAGER(["CM"]) is denied orders.refund even though it holds orders.manage', async () => {
    mockQuery.mockResolvedValue({ rows: [activeRow('MARKET_MANAGER', ['CM'])] })
    const req: any = { user: { userId: 'manager-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermission('orders.refund')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('MARKET_MANAGER(["CM"]) is denied global analytics (analytics.view_global not granted)', async () => {
    mockQuery.mockResolvedValue({ rows: [activeRow('MARKET_MANAGER', ['CM'])] })
    const req: any = { user: { userId: 'manager-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermission('analytics.view_global')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('MARKET_MANAGER(["CM"]) is allowed analytics.view_market', async () => {
    mockQuery.mockResolvedValue({ rows: [activeRow('MARKET_MANAGER', ['CM'])] })
    const req: any = { user: { userId: 'manager-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermission('analytics.view_market')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('a SUSPENDED membership (excluded by the ACTIVE-only query) is denied exactly like having no membership at all', async () => {
    // requireStaff/requirePermission's underlying query always filters
    // `WHERE status = 'ACTIVE'` -- a real SUSPENDED row would never appear
    // in the result set, which is indistinguishable at this layer from "no
    // membership." Confirms that codepath denies rather than defaulting open.
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { userId: 'suspended-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireStaff('MARKET_MANAGER')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('a REVOKED membership is denied the same way as SUSPENDED', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { userId: 'revoked-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermission('orders.view')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('a plain customer with no staff row at all is denied every staff-gated route', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { userId: 'customer-1', userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('orders.view', 'admin', 'super_admin')(
      req,
      res,
      next,
    )

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('legacy admin/super_admin behavior is unchanged: bypasses the staff check entirely', async () => {
    const req: any = { user: { userId: 'legacy-1', userType: 'super_admin' } }
    const res = makeRes()
    const next = jest.fn()

    await requirePermissionOrLegacyRole('orders.view', 'admin', 'super_admin')(
      req,
      res,
      next,
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
