import {
  grantStaffMembership,
  updateStaffRole,
  suspendStaffMembership,
  reactivateStaffMembership,
  revokeStaffMembership,
} from './staff.controller'
import { query } from '../../../database/connection'
import { recordStaffAuditEvent } from '../../../services/staff-audit.service'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
}))

jest.mock('../../../services/staff-audit.service', () => ({
  recordStaffAuditEvent: jest.fn(),
}))

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock
const mockAudit = recordStaffAuditEvent as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

// req.staff is what requirePermission/requireStaff would already have
// attached before the controller runs, in the real request pipeline.
const makeReq = (overrides: any = {}) => ({
  user: { userId: 'owner-1', userType: 'customer' },
  staff: {
    memberships: [{ id: 'm-owner', role: 'OWNER', marketScope: null }],
    permissions: new Set(['staff.grant', 'staff.manage', 'staff.revoke']),
  },
  body: {},
  params: {},
  query: {},
  ...overrides,
})

describe('grantStaffMembership', () => {
  beforeEach(() => jest.clearAllMocks())

  it('grants a role to an existing user found by id, and writes an audit entry', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, email FROM users WHERE id')) {
        return { rows: [{ id: 'target-1', email: 'manager@example.com' }] }
      }
      if (sql.includes("status IN ('ACTIVE', 'SUSPENDED')")) {
        return { rows: [] } // no existing grant of this role
      }
      if (sql.includes('INSERT INTO staff_memberships')) {
        return {
          rows: [
            {
              id: 'new-membership-1',
              user_id: 'target-1',
              role: 'MARKET_MANAGER',
              market_scope: ['CM'],
              status: 'ACTIVE',
            },
          ],
        }
      }
      return { rows: [] }
    })

    const req: any = makeReq({
      body: { userId: 'target-1', role: 'MARKET_MANAGER', marketScope: ['CM'] },
    })
    const res = makeRes()

    await grantStaffMembership(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'STAFF_GRANTED', targetUserId: 'target-1' }),
    )
  })

  it('never creates a user -- 404s when no existing active user matches', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    const req: any = makeReq({
      body: { email: 'nobody@example.com', role: 'SUPPORT_AGENT' },
    })
    const res = makeRes()

    await grantStaffMembership(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    const insertCall = mockQuery.mock.calls.find((c: any[]) =>
      c[0].includes('INSERT INTO staff_memberships'),
    )
    expect(insertCall).toBeUndefined()
  })

  it('rejects self-grant even for an OWNER', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, email FROM users WHERE id')) {
        return { rows: [{ id: 'owner-1', email: 'owner@example.com' }] }
      }
      return { rows: [] }
    })

    const req: any = makeReq({
      body: { userId: 'owner-1', role: 'ADMIN' }, // targeting themselves
    })
    const res = makeRes()

    await grantStaffMembership(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('rejects granting a role with more authority than the actor holds', async () => {
    const req: any = makeReq({
      user: { userId: 'market-mgr-1', userType: 'customer' },
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
        permissions: new Set(['staff.grant']), // hypothetically granted, still rank-checked
      },
      body: { userId: 'target-1', role: 'OWNER' },
    })
    const res = makeRes()

    await grantStaffMembership(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockQuery).not.toHaveBeenCalled() // rejected before even looking up the target user
  })
})

describe('updateStaffRole -- privilege escalation guards', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects changing your own role', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'm-self', user_id: 'owner-1', role: 'OWNER', status: 'ACTIVE', email: 'owner@example.com' }],
    })

    const req: any = makeReq({ params: { id: 'm-self' }, body: { role: 'SUPPORT_AGENT' } })
    const res = makeRes()

    await updateStaffRole(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('rejects promoting a target beyond the actor own authority', async () => {
    const req: any = makeReq({
      user: { userId: 'admin-1', userType: 'customer' },
      staff: {
        memberships: [{ id: 'm-admin', role: 'ADMIN', marketScope: null }],
        permissions: new Set(['staff.manage']),
      },
      params: { id: 'target-membership' },
      body: { role: 'SUPER_ADMIN' },
    })
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'target-membership',
          user_id: 'someone-else',
          role: 'MARKET_MANAGER',
          status: 'ACTIVE',
          email: 'mgr@example.com',
        },
      ],
    })
    const res = makeRes()

    await updateStaffRole(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('prevents demoting the last remaining OWNER/SUPER_ADMIN', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN users u ON u.id = sm.user_id')) {
        return {
          rows: [
            {
              id: 'last-owner',
              user_id: 'someone-else',
              role: 'OWNER',
              status: 'ACTIVE',
              email: 'owner2@example.com',
            },
          ],
        }
      }
      if (sql.includes("role IN ('OWNER', 'SUPER_ADMIN')")) {
        return { rows: [{ count: '0' }] } // no other top-authority member remains
      }
      return { rows: [] }
    })

    const req: any = makeReq({ params: { id: 'last-owner' }, body: { role: 'ADMIN' } })
    const res = makeRes()

    await updateStaffRole(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE staff_memberships SET role'))
    expect(updateCall).toBeUndefined()
  })
})

describe('suspend / reactivate / revoke', () => {
  beforeEach(() => jest.clearAllMocks())

  it('suspend writes STAFF_SUSPENDED with before/after state', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN users u ON u.id = sm.user_id')) {
        return {
          rows: [{ id: 'm2', user_id: 'target-2', role: 'SUPPORT_AGENT', status: 'ACTIVE', email: 'a@b.com' }],
        }
      }
      if (sql.includes('UPDATE staff_memberships') && sql.includes('SUSPENDED')) {
        return { rows: [{ id: 'm2', user_id: 'target-2', role: 'SUPPORT_AGENT', status: 'SUSPENDED' }] }
      }
      return { rows: [] }
    })

    const req: any = makeReq({ params: { id: 'm2' }, body: { reason: 'left the team' } })
    const res = makeRes()

    await suspendStaffMembership(req, res)

    expect(res.status).not.toHaveBeenCalledWith(403)
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STAFF_SUSPENDED',
        beforeState: { status: 'ACTIVE' },
        afterState: { status: 'SUSPENDED' },
      }),
    )
  })

  it('rejects suspending your own access', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'm-self', user_id: 'owner-1', role: 'OWNER', status: 'ACTIVE', email: 'owner@example.com' }],
    })
    const req: any = makeReq({ params: { id: 'm-self' } })
    const res = makeRes()

    await suspendStaffMembership(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('rejects suspending the last remaining OWNER/SUPER_ADMIN', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN users u ON u.id = sm.user_id')) {
        return {
          rows: [{ id: 'last-owner', user_id: 'someone-else', role: 'SUPER_ADMIN', status: 'ACTIVE', email: 'x@y.com' }],
        }
      }
      if (sql.includes("role IN ('OWNER', 'SUPER_ADMIN')")) {
        return { rows: [{ count: '0' }] }
      }
      return { rows: [] }
    })

    const req: any = makeReq({ params: { id: 'last-owner' } })
    const res = makeRes()

    await suspendStaffMembership(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('reactivate only accepts a currently-SUSPENDED membership', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'm3', user_id: 'target-3', role: 'SUPPORT_AGENT', status: 'ACTIVE', email: 'a@b.com' }],
    })
    const req: any = makeReq({ params: { id: 'm3' } })
    const res = makeRes()

    await reactivateStaffMembership(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('revoke rejects an already-revoked membership', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'm4', user_id: 'target-4', role: 'SUPPORT_AGENT', status: 'REVOKED', email: 'a@b.com' }],
    })
    const req: any = makeReq({ params: { id: 'm4' } })
    const res = makeRes()

    await revokeStaffMembership(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('revoke writes STAFF_REVOKED for a normal (non-last-owner) case', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN users u ON u.id = sm.user_id')) {
        return {
          rows: [{ id: 'm5', user_id: 'target-5', role: 'SUPPORT_AGENT', status: 'ACTIVE', email: 'a@b.com' }],
        }
      }
      if (sql.includes('UPDATE staff_memberships') && sql.includes('REVOKED')) {
        return { rows: [{ id: 'm5', user_id: 'target-5', role: 'SUPPORT_AGENT', status: 'REVOKED' }] }
      }
      return { rows: [] }
    })

    const req: any = makeReq({ params: { id: 'm5' } })
    const res = makeRes()

    await revokeStaffMembership(req, res)

    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'STAFF_REVOKED' }))
  })
})
