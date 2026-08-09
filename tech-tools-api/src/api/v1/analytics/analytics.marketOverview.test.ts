import { getMarketOverview } from './analytics.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
}))

jest.mock('../../../config/database', () => ({}))

jest.mock('../../../services/event.service', () => ({
  createEventService: jest.fn(() => ({})),
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

const marketManagerReq = (overrides: any = {}) => ({
  user: { userId: 'manager-1', userType: 'customer' },
  staff: {
    memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
    permissions: new Set(['analytics.view_market']),
  },
  query: {},
  ...overrides,
})

describe('getMarketOverview', () => {
  beforeEach(() => jest.clearAllMocks())

  it('filters visitors by uppercased ISO country_code and orders/suppliers via applyMarketScope', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ session_count: '4', unique_visitors: '3' }] }) // visitors
      .mockResolvedValueOnce({ rows: [{ order_count: '2', revenue: '150.00' }] }) // orders
      .mockResolvedValueOnce({ rows: [{ supplier_count: '1' }] }) // suppliers

    const req: any = marketManagerReq()
    const res = makeRes()

    await getMarketOverview(req, res)

    const [visitorsSql, visitorsParams] = mockQuery.mock.calls[0]
    expect(visitorsSql).toContain('country_code = ANY($1)')
    expect(visitorsParams).toEqual([['CM']])

    const [ordersSql] = mockQuery.mock.calls[1]
    expect(ordersSql).toContain("LOWER(o.shipping_address->>'country')")

    const [suppliersSql] = mockQuery.mock.calls[2]
    expect(suppliersSql).toContain('LOWER(country_code)')

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        scoped: true,
        markets: ['CM'],
        visitors: { activeSessionCount: 4, uniqueVisitors: 3 },
        orders: { orderCount: 2, revenue: 150 },
        suppliers: { supplierCount: 1 },
      }),
    )
  })

  it('fails closed and never queries the DB when market_scope is an explicitly empty array', async () => {
    const req: any = marketManagerReq({
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: [] }],
        permissions: new Set(['analytics.view_market']),
      },
    })
    const res = makeRes()

    await getMarketOverview(req, res)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        scoped: true,
        markets: [],
        visitors: { activeSessionCount: 0, uniqueVisitors: 0 },
        orders: { orderCount: 0, revenue: 0 },
      }),
    )
  })

  it('returns unfiltered global figures for a caller with a global (null-scope) membership', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ session_count: '40', unique_visitors: '30' }] })
      .mockResolvedValueOnce({ rows: [{ order_count: '20', revenue: '900.00' }] })
      .mockResolvedValueOnce({ rows: [{ supplier_count: '9' }] })

    const req: any = marketManagerReq({
      staff: {
        memberships: [{ id: 'm1', role: 'OWNER', marketScope: null }],
        permissions: new Set(['analytics.view_market']),
      },
    })
    const res = makeRes()

    await getMarketOverview(req, res)

    const [visitorsSql, visitorsParams] = mockQuery.mock.calls[0]
    expect(visitorsSql).not.toContain('country_code = ANY')
    expect(visitorsParams).toEqual([])

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ scoped: false, markets: [] }),
    )
  })
})
