import {
  getAdminOrders,
  getAdminOrderById,
  adminUpdateOrderStatus,
  bulkUpdateOrderStatus,
} from './order.controller'
import { query } from '../../../database/connection'
import { recordStaffAuditEvent } from '../../../services/staff-audit.service'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))

jest.mock('../../../services/staff-audit.service', () => ({
  recordStaffAuditEvent: jest.fn(),
}))

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

// A MARKET_MANAGER scoped to Cameroon -- req.staff as requirePermission
// would have attached it before the controller ever runs.
const marketManagerReq = (overrides: any = {}) => ({
  user: { userId: 'manager-1', userType: 'customer' },
  staff: {
    memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
    permissions: new Set(['orders.view', 'orders.manage']),
  },
  query: {},
  params: {},
  body: {},
  ...overrides,
})

// A legacy admin -- req.staff is never populated for these (see
// requirePermissionOrLegacyRole's short-circuit).
const legacyAdminReq = (overrides: any = {}) => ({
  user: { userId: 'admin-1', userType: 'admin' },
  query: {},
  params: {},
  body: {},
  ...overrides,
})

describe('getAdminOrders -- market scope on the list query', () => {
  beforeEach(() => jest.clearAllMocks())

  it('adds a scope filter to both the list and count queries for a scoped MARKET_MANAGER', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: '0' }] })
    const req: any = marketManagerReq()
    const res = makeRes()

    await getAdminOrders(req, res)

    const [listSql, listParams] = mockQuery.mock.calls[0]
    expect(listSql).toContain("LOWER(o.shipping_address->>'country')")
    expect(listParams[0]).toEqual(expect.arrayContaining(['cm', 'cameroon']))

    const [countSql] = mockQuery.mock.calls[1]
    expect(countSql).toContain("LOWER(o.shipping_address->>'country')")
  })

  it('adds no scope filter at all for a legacy admin', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: '0' }] })
    const req: any = legacyAdminReq()
    const res = makeRes()

    await getAdminOrders(req, res)

    const [listSql] = mockQuery.mock.calls[0]
    expect(listSql).not.toContain('shipping_address')
  })
})

describe('getAdminOrderById -- IDOR guard', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the order when its country is in the caller scope (CM manager, CM order)', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM orders o')) {
        return { rows: [{ id: 'order-1', shipping_address: { country: 'CM' } }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({ params: { id: 'order-1' } })
    const res = makeRes()

    await getAdminOrderById(req, res)

    expect(res.status).not.toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    )
  })

  it('404s when the order is outside the caller scope (CM manager, IT order) and audits it', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM orders o')) {
        return { rows: [{ id: 'order-2', shipping_address: { country: 'IT' } }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({ params: { id: 'order-2' } })
    const res = makeRes()

    await getAdminOrderById(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(recordStaffAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PERMISSION_DENIED',
        metadata: expect.objectContaining({
          check: 'market_scope',
          resourceType: 'order',
          resourceId: 'order-2',
        }),
      }),
    )
  })

  it('404s the same way for a country stored as a full name (Italy) as for a code (IT)', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM orders o')) {
        return { rows: [{ id: 'order-3', shipping_address: { country: 'Italy' } }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({ params: { id: 'order-3' } })
    const res = makeRes()

    await getAdminOrderById(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('a legacy admin can reach any order regardless of country', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM orders o')) {
        return { rows: [{ id: 'order-4', shipping_address: { country: 'US' } }] }
      }
      return { rows: [] }
    })
    const req: any = legacyAdminReq({ params: { id: 'order-4' } })
    const res = makeRes()

    await getAdminOrderById(req, res)

    expect(res.status).not.toHaveBeenCalledWith(404)
  })
})

describe('adminUpdateOrderStatus -- IDOR guard + refund permission', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a status update for an order outside the caller scope before ever running the UPDATE', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, shipping_address FROM orders')) {
        return { rows: [{ id: 'order-1', shipping_address: { country: 'IT' } }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({
      params: { id: 'order-1' },
      body: { status: 'processing' },
    })
    const res = makeRes()

    await adminUpdateOrderStatus(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    const updateCall = mockQuery.mock.calls.find((c: any[]) =>
      c[0].includes('UPDATE orders'),
    )
    expect(updateCall).toBeUndefined()
  })

  it('rejects a MARKET_MANAGER trying to mark an in-scope order as refunded', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, shipping_address FROM orders')) {
        return { rows: [{ id: 'order-1', shipping_address: { country: 'CM' } }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({
      params: { id: 'order-1' },
      body: { status: 'refunded' },
    })
    const res = makeRes()

    await adminUpdateOrderStatus(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    const updateCall = mockQuery.mock.calls.find((c: any[]) =>
      c[0].includes('UPDATE orders'),
    )
    expect(updateCall).toBeUndefined()
  })

  it('allows an in-scope, non-refund status update for a MARKET_MANAGER', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, shipping_address FROM orders')) {
        return { rows: [{ id: 'order-1', shipping_address: { country: 'CM' } }] }
      }
      if (sql.includes('UPDATE orders')) {
        return { rows: [{ id: 'order-1', order_status: 'processing' }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({
      params: { id: 'order-1' },
      body: { status: 'processing' },
    })
    const res = makeRes()

    await adminUpdateOrderStatus(req, res)

    expect(res.status).not.toHaveBeenCalledWith(403)
    expect(res.status).not.toHaveBeenCalledWith(404)
  })

  it('allows a legacy admin to mark an order refunded', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, shipping_address FROM orders')) {
        return { rows: [{ id: 'order-1', shipping_address: { country: 'US' } }] }
      }
      if (sql.includes('UPDATE orders')) {
        return { rows: [{ id: 'order-1', order_status: 'refunded' }] }
      }
      return { rows: [] }
    })
    const req: any = legacyAdminReq({
      params: { id: 'order-1' },
      body: { status: 'refunded' },
    })
    const res = makeRes()

    await adminUpdateOrderStatus(req, res)

    expect(res.status).not.toHaveBeenCalledWith(403)
  })
})

describe('bulkUpdateOrderStatus -- scoped IDs only', () => {
  beforeEach(() => jest.clearAllMocks())

  it('only updates the IDs the UPDATE...WHERE scope actually matched, and audits the skipped ones', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'cm-order-1' }] })
    const req: any = marketManagerReq({
      body: { orderIds: ['cm-order-1', 'it-order-1'], status: 'processing' },
    })
    const res = makeRes()

    await bulkUpdateOrderStatus(req, res)

    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toContain('UPDATE orders o')
    expect(sql).toContain("LOWER(o.shipping_address->>'country')")

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { updatedCount: 1, updatedIds: ['cm-order-1'] },
      }),
    )
    expect(recordStaffAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PERMISSION_DENIED',
        metadata: expect.objectContaining({ bulk: true, skippedIds: ['it-order-1'] }),
      }),
    )
  })

  it('rejects a bulk refund attempt from a MARKET_MANAGER outright', async () => {
    const req: any = marketManagerReq({
      body: { orderIds: ['cm-order-1'], status: 'refunded' },
    })
    const res = makeRes()

    await bulkUpdateOrderStatus(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
