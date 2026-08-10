import {
  getOverview,
  getSales,
  getFunnel,
  getProductIntelligence,
  getSearchDemand,
  getAcquisition,
  getOperations,
  getCountryPerformance,
} from './analytics-v2.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
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

const globalReq = (overrides: any = {}) => ({
  user: { userId: 'admin-1', userType: 'admin' },
  query: {},
  ...overrides,
})

const marketManagerReq = (overrides: any = {}) => ({
  user: { userId: 'manager-1', userType: 'customer' },
  staff: {
    memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
    permissions: new Set(['analytics.view_market']),
  },
  query: {},
  ...overrides,
})

// Row shapes each of the 6 parallel queries getOverview issues, in the
// same order computeOverviewMetrics calls them (orders, visitors, funnel,
// refunds tableExists + query, returning-customers, margin).
function mockHappyPathQueries() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('to_regclass')) return { rows: [{ exists: false }] } // no refunds table
    if (sql.includes('FROM orders o') && sql.includes('order_count')) {
      return { rows: [{ order_count: '40', revenue: '18250.00' }] }
    }
    if (sql.includes('FROM user_sessions') && sql.includes('visitor_count')) {
      return { rows: [{ visitor_count: '2000' }] }
    }
    if (sql.includes('FROM events_core e')) {
      return { rows: [{ checkout_starts: '120', payment_successes: '40' }] }
    }
    if (sql.includes('lifetime_counts')) {
      return { rows: [{ sample_size: '30', returning_count: '9' }] }
    }
    if (sql.includes('FROM order_items oi')) {
      return { rows: [{ total_revenue: '18250', covered_revenue: '18250', gross_margin: '7300' }] }
    }
    return { rows: [] }
  })
}

describe('getOverview', () => {
  beforeEach(() => jest.clearAllMocks())

  it('computes every metric from real query results with no NaN/Infinity/null', async () => {
    mockHappyPathQueries()
    const req: any = globalReq({ query: { from: '2026-01-01', to: '2026-01-31', comparisonMode: 'none' } })
    const res = makeRes()

    await getOverview(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    expect(payload.success).toBe(true)
    expect(payload.metrics.revenue.value).toBe(18250)
    expect(payload.metrics.orders.value).toBe(40)
    expect(payload.metrics.aov.value).toBeCloseTo(456.25, 2)
    expect(payload.metrics.conversionRate.value).toBe(2) // 40/2000*100
    expect(payload.metrics.checkoutAbandonmentRate.value).toBeCloseTo(66.67, 1) // (120-40)/120
    expect(payload.metrics.returningCustomerRate.value).toBe(30) // 9/30*100
    expect(payload.metrics.grossMargin.value).toBe(7300)
    expect(payload.dataQuality.refundRateAvailable).toBe(false)
    expect(payload.dataQuality.marginCoveragePercent).toBe(100)

    // Every numeric leaf must be finite -- the explicit "never NaN/Infinity" requirement.
    const flatten = (obj: any): number[] =>
      Object.values(obj).flatMap((v) =>
        typeof v === 'number' ? [v] : v && typeof v === 'object' ? flatten(v) : [],
      )
    for (const num of flatten(payload.metrics)) {
      expect(Number.isFinite(num)).toBe(true)
    }
  })

  it('never crashes and reports null percentChange when there are zero visitors/orders (all-zero period)', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('to_regclass')) return { rows: [{ exists: false }] }
      if (sql.includes('order_count')) return { rows: [{ order_count: '0', revenue: '0' }] }
      if (sql.includes('visitor_count')) return { rows: [{ visitor_count: '0' }] }
      if (sql.includes('FROM events_core e')) return { rows: [{ checkout_starts: '0', payment_successes: '0' }] }
      if (sql.includes('lifetime_counts')) return { rows: [{ sample_size: '0', returning_count: '0' }] }
      if (sql.includes('FROM order_items oi')) return { rows: [{ total_revenue: '0', covered_revenue: '0', gross_margin: '0' }] }
      return { rows: [] }
    })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getOverview(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.metrics.conversionRate.value).toBe(0)
    expect(payload.metrics.checkoutAbandonmentRate.value).toBe(0)
    expect(payload.metrics.aov.value).toBe(0)
    expect(payload.metrics.revenue.percentChange).toBeNull()
  })

  it('handles a null/missing row gracefully (pg returns undefined fields) without throwing', async () => {
    mockQuery.mockResolvedValue({ rows: [{}] })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await expect(getOverview(req, res)).resolves.not.toThrow()
    expect(res.status).not.toHaveBeenCalledWith(500)
  })

  it('rejects an invalid date range with 400 and issues no queries', async () => {
    const req: any = globalReq({ query: { from: '2026-06-01', to: '2026-01-01' } })
    const res = makeRes()

    await getOverview(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('computes a real comparison period by default (previous_period) with two full rounds of queries', async () => {
    mockHappyPathQueries()
    const req: any = globalReq({ query: { from: '2026-01-01', to: '2026-01-31' } })
    const res = makeRes()

    await getOverview(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.compare).not.toBeNull()
    expect(payload.metrics.revenue.previousValue).toBe(18250)
    expect(payload.metrics.revenue.absoluteChange).toBe(0)
    expect(payload.metrics.revenue.percentChange).toBe(0)
  })

  it('scopes every query to the MARKET_MANAGER caller\'s country and marks the response as scoped', async () => {
    mockHappyPathQueries()
    const req: any = marketManagerReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getOverview(req, res)

    const ordersCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('FROM orders o'))
    expect(ordersCall![0]).toContain("LOWER(o.shipping_address->>'country')")
    const sessionsCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('FROM user_sessions'))
    expect(sessionsCall![0]).toContain('AND country_code = ANY(')

    const payload = res.json.mock.calls[0][0]
    expect(payload.scoped).toBe(true)
    expect(payload.markets).toEqual(['CM'])
  })

  it('a MARKET_MANAGER cannot widen scope past their own market via ?country=', async () => {
    mockHappyPathQueries()
    const req: any = marketManagerReq({ query: { comparisonMode: 'none', country: 'IT' } })
    const res = makeRes()

    await getOverview(req, res)

    const sessionsCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('FROM user_sessions'))
    // Requesting a country outside their own scope collapses to the
    // fails-closed empty-country clause, not an expanded/different scope.
    expect(sessionsCall![0]).toContain('AND 1 = 0')
  })

  it('a global caller can narrow via ?country= without it granting anything extra', async () => {
    mockHappyPathQueries()
    const req: any = globalReq({ query: { comparisonMode: 'none', country: 'de' } })
    const res = makeRes()

    await getOverview(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.scoped).toBe(true)
    expect(payload.markets).toEqual(['DE'])
  })

  it('reports refund rate as available once the refunds table exists', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('to_regclass')) return { rows: [{ exists: true }] }
      if (sql.includes('FROM refunds')) return { rows: [{ refund_count: '3' }] }
      if (sql.includes('order_count')) return { rows: [{ order_count: '40', revenue: '18250' }] }
      if (sql.includes('visitor_count')) return { rows: [{ visitor_count: '2000' }] }
      if (sql.includes('FROM events_core e')) return { rows: [{ checkout_starts: '0', payment_successes: '0' }] }
      if (sql.includes('lifetime_counts')) return { rows: [{ sample_size: '0', returning_count: '0' }] }
      if (sql.includes('FROM order_items oi')) return { rows: [{ total_revenue: '0', covered_revenue: '0', gross_margin: '0' }] }
      return { rows: [] }
    })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getOverview(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.dataQuality.refundRateAvailable).toBe(true)
    expect(payload.metrics.refundRate.value).toBeCloseTo(7.5, 1) // 3/40*100
  })
})

function mockSalesQueries() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('to_regclass')) return { rows: [{ exists: false }] }
    if (sql.includes("GROUP BY DATE(o.created_at)")) {
      return { rows: [{ date: '2026-01-05', order_count: '4', revenue: '900.00' }] }
    }
    if (sql.includes('GROUP BY p.id, p.name, p.sku')) {
      return { rows: [{ product_id: 'p1', product_name: 'Drill', sku: 'DRL-1', units_sold: '10', revenue: '500' }] }
    }
    if (sql.includes('GROUP BY c.id, c.name')) {
      return { rows: [{ category_id: 'c1', category_name: 'Tools', revenue: '500' }] }
    }
    if (sql.includes("GROUP BY o.shipping_address->>'country'")) {
      return { rows: [{ country: 'CM', order_count: '4', revenue: '900' }] }
    }
    if (sql.includes('GROUP BY o.order_status')) {
      return { rows: [{ status: 'delivered', count: '4' }] }
    }
    if (sql.includes('GROUP BY o.payment_status')) {
      return { rows: [{ status: 'paid', count: '4' }] }
    }
    if (sql.includes('as units_sold') && !sql.includes('GROUP BY')) {
      return { rows: [{ units_sold: '10' }] }
    }
    if (sql.includes("FILTER (WHERE o.order_status = 'cancelled')")) {
      return { rows: [{ total: '5', cancelled: '1' }] }
    }
    return { rows: [] }
  })
}

describe('getSales', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns a fully-populated, safe response on the happy path', async () => {
    mockSalesQueries()
    const req: any = globalReq({ query: { from: '2026-01-01', to: '2026-01-31' } })
    const res = makeRes()

    await getSales(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    expect(payload.success).toBe(true)
    expect(payload.trend).toHaveLength(1)
    expect(payload.trend[0].aov).toBeCloseTo(225, 1) // 900/4
    expect(payload.revenueByProduct[0].productName).toBe('Drill')
    expect(payload.revenueByCategory[0].categoryName).toBe('Tools')
    expect(payload.revenueByCountry[0].country).toBe('CM')
    expect(payload.orderStatusDistribution[0].status).toBe('delivered')
    expect(payload.cancellationRate).toBeCloseTo(20, 1) // 1/5*100
    expect(payload.refundRate).toBeNull()
  })

  it('never crashes on an entirely empty period (no rows anywhere)', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await expect(getSales(req, res)).resolves.not.toThrow()
    const payload = res.json.mock.calls[0][0]
    expect(payload.trend).toEqual([])
    expect(payload.cancellationRate).toBe(0)
    expect(payload.unitsSold).toBe(0)
  })

  it('scopes every order-derived query to a MARKET_MANAGER caller\'s country', async () => {
    mockSalesQueries()
    const req: any = marketManagerReq({ query: {} })
    const res = makeRes()

    await getSales(req, res)

    const trendCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('GROUP BY DATE(o.created_at)'))
    expect(trendCall![0]).toContain("LOWER(o.shipping_address->>'country')")
    const payload = res.json.mock.calls[0][0]
    expect(payload.scoped).toBe(true)
  })

  it('silently ignores a malformed productId instead of erroring', async () => {
    mockSalesQueries()
    const req: any = globalReq({ query: { productId: 'not-a-uuid' } })
    const res = makeRes()

    await getSales(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.filters.productId).toBeNull()
    expect(res.status).not.toHaveBeenCalledWith(500)
  })

  it('applies a valid productId as an EXISTS filter on every sub-query', async () => {
    mockSalesQueries()
    const productId = '11111111-1111-1111-1111-111111111111'
    const req: any = globalReq({ query: { productId } })
    const res = makeRes()

    await getSales(req, res)

    const trendCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('GROUP BY DATE(o.created_at)'))
    expect(trendCall![0]).toContain('EXISTS (')
    expect(trendCall![1]).toContain(productId)
  })

  it('rejects an invalid date range with 400 and issues no queries', async () => {
    const req: any = globalReq({ query: { from: 'garbage' } })
    const res = makeRes()

    await getSales(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

function mockFunnelQueries(counts: {
  sessions: number
  productViews: number
  addToCarts: number
  checkoutStarts: number
  paymentSuccesses: number
}) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('as session_count')) return { rows: [{ session_count: String(counts.sessions) }] }
    if (sql.includes('product_views')) {
      return { rows: [{ product_views: String(counts.productViews), add_to_carts: String(counts.addToCarts) }] }
    }
    if (sql.includes('checkout_starts')) {
      return {
        rows: [{ checkout_starts: String(counts.checkoutStarts), payment_successes: String(counts.paymentSuccesses) }],
      }
    }
    return { rows: [] }
  })
}

describe('getFunnel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('computes the canonical 5-stage funnel with correct conversion/drop-off math', async () => {
    mockFunnelQueries({ sessions: 1000, productViews: 400, addToCarts: 100, checkoutStarts: 60, paymentSuccesses: 40 })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getFunnel(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    expect(payload.stages.map((s: any) => s.key)).toEqual([
      'sessions',
      'product_view',
      'add_to_cart',
      'checkout_start',
      'payment_success',
    ])
    expect(payload.stages[1].stageConversionPercent).toBe(40) // 400/1000
    expect(payload.stages[1].dropOffCount).toBe(600)
    expect(payload.stages[4].dropOffCount).toBe(20) // 60 - 40
    expect(payload.overallConversionPercent).toBe(4) // 40/1000*100
  })

  it('always includes the mobile-instrumentation data-quality note, marking checkout_start/payment_success as partial', async () => {
    mockFunnelQueries({ sessions: 100, productViews: 50, addToCarts: 20, checkoutStarts: 10, paymentSuccesses: 5 })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getFunnel(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.dataQuality.partialStages).toEqual(['checkout_start', 'payment_success'])
    expect(payload.dataQuality.note).toMatch(/mobile/i)
    const sessionsStage = payload.stages.find((s: any) => s.key === 'sessions')
    const checkoutStage = payload.stages.find((s: any) => s.key === 'checkout_start')
    expect(sessionsStage.dataQuality).toBe('complete')
    expect(checkoutStage.dataQuality).toBe('partial')
  })

  it('never crashes and produces 0%, not NaN/Infinity, on a completely empty funnel', async () => {
    mockFunnelQueries({ sessions: 0, productViews: 0, addToCarts: 0, checkoutStarts: 0, paymentSuccesses: 0 })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getFunnel(req, res)

    const payload = res.json.mock.calls[0][0]
    for (const stage of payload.stages) {
      expect(Number.isFinite(stage.stageConversionPercent)).toBe(true)
      expect(Number.isFinite(stage.dropOffPercent)).toBe(true)
    }
    expect(payload.overallConversionPercent).toBe(0)
  })

  it('applies a device filter to the sessions-stage query', async () => {
    mockFunnelQueries({ sessions: 10, productViews: 5, addToCarts: 2, checkoutStarts: 1, paymentSuccesses: 1 })
    const req: any = globalReq({ query: { device: 'mobile', comparisonMode: 'none' } })
    const res = makeRes()

    await getFunnel(req, res)

    const sessionsCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('as session_count'))
    expect(sessionsCall![0]).toContain('device_type = $3')
    expect(sessionsCall![1]).toContain('mobile')
  })

  it('scopes sessions to a MARKET_MANAGER caller\'s country', async () => {
    mockFunnelQueries({ sessions: 10, productViews: 5, addToCarts: 2, checkoutStarts: 1, paymentSuccesses: 1 })
    const req: any = marketManagerReq({ query: {} })
    const res = makeRes()

    await getFunnel(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.scoped).toBe(true)
    const sessionsCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('as session_count'))
    expect(sessionsCall![0]).toContain('country_code = ANY(')
  })
})

function mockProductRows(rows: any[]) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM products p')) return { rows }
    return { rows: [] }
  })
}

describe('getProductIntelligence', () => {
  beforeEach(() => jest.clearAllMocks())

  it('computes conversion/cart-to-purchase rates and margin only for products with a known cost price', async () => {
    mockProductRows([
      {
        product_id: 'p1',
        product_name: 'Drill',
        sku: 'DRL-1',
        cost_price: '20.00',
        base_price: '50.00',
        sale_price: null,
        views: '400',
        unique_visitors: '300',
        add_to_carts: '80',
        units_purchased: '20',
        revenue: '1000.00',
        current_stock: '15',
      },
      {
        product_id: 'p2',
        product_name: 'Sander',
        sku: 'SND-1',
        cost_price: null,
        base_price: '30.00',
        sale_price: null,
        views: '100',
        unique_visitors: '90',
        add_to_carts: '10',
        units_purchased: '2',
        revenue: '60.00',
        current_stock: '0',
      },
    ])
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getProductIntelligence(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    const drill = payload.products.find((p: any) => p.productId === 'p1')
    const sander = payload.products.find((p: any) => p.productId === 'p2')

    expect(drill.conversionRate).toBeCloseTo((20 / 300) * 100, 1)
    expect(drill.cartToPurchaseRate).toBeCloseTo((20 / 80) * 100, 1)
    expect(drill.margin).toEqual({ perUnit: 30, available: true })

    expect(sander.margin).toBeNull()
    expect(sander.currentStock).toBe(0)
  })

  it('never crashes and returns 0-rates (not NaN) for a product with zero visitors/carts', async () => {
    mockProductRows([
      {
        product_id: 'p3',
        product_name: 'New Item',
        sku: 'NEW-1',
        cost_price: null,
        base_price: '10',
        sale_price: null,
        views: '0',
        unique_visitors: '0',
        add_to_carts: '0',
        units_purchased: '0',
        revenue: '0',
        current_stock: null,
      },
    ])
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getProductIntelligence(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.products[0].conversionRate).toBe(0)
    expect(payload.products[0].cartToPurchaseRate).toBe(0)
    expect(payload.products[0].currentStock).toBeNull()
  })

  it('defaults to sorting by revenue and accepts a valid alternate sort key', async () => {
    mockProductRows([])
    const req: any = globalReq({ query: { sort: 'low_stock' } })
    const res = makeRes()

    await getProductIntelligence(req, res)

    const call = mockQuery.mock.calls.find((c: any[]) => c[0].includes('FROM products p'))
    expect(call![0]).toContain('ORDER BY current_stock ASC NULLS LAST')
  })

  it('falls back to the default sort for an unrecognized sort key instead of erroring', async () => {
    mockProductRows([])
    const req: any = globalReq({ query: { sort: 'literally-anything' } })
    const res = makeRes()

    await getProductIntelligence(req, res)

    expect(res.status).not.toHaveBeenCalledWith(500)
    const call = mockQuery.mock.calls.find((c: any[]) => c[0].includes('FROM products p'))
    expect(call![0]).toContain('ORDER BY revenue DESC')
  })

  it('scopes product demand to a MARKET_MANAGER caller\'s market via the viewing session\'s country', async () => {
    mockProductRows([])
    const req: any = marketManagerReq({ query: {} })
    const res = makeRes()

    await getProductIntelligence(req, res)

    const call = mockQuery.mock.calls.find((c: any[]) => c[0].includes('FROM products p'))
    expect(call![0]).toContain('s.country_code = ANY(')
    const payload = res.json.mock.calls[0][0]
    expect(payload.scoped).toBe(true)
  })
})

function mockSearchDemandQueries() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("GROUP BY e.payload->>'searchQuery'") && sql.includes("resultsCount', '0') = '0'")) {
      return { rows: [{ search_query: 'drone', search_count: '12' }] }
    }
    if (sql.includes("GROUP BY e.payload->>'searchQuery'")) {
      return { rows: [{ search_query: 'drill', search_count: '50' }] }
    }
    if (sql.includes("GROUP BY COALESCE(s.country_code, 'XX')")) {
      return { rows: [{ country: 'CM', search_count: '30' }] }
    }
    if (sql.includes('zero_result_count')) {
      return { rows: [{ date: '2026-01-05', search_count: '20', zero_result_count: '5' }] }
    }
    if (sql.includes('HAVING COUNT(*) >= 3')) {
      return { rows: [{ product_id: 'p9', product_name: 'Old Sander', sku: 'OLD-1', view_count: '7', current_stock: '0', is_active: false }] }
    }
    if (sql.includes('view_stats AS')) {
      return {
        rows: [
          { product_id: 'p1', product_name: 'Drill', sku: 'DRL-1', views: '100', add_to_carts: '2', units_purchased: '2' },
          { product_id: 'p2', product_name: 'Hammer', sku: 'HAM-1', views: '20', add_to_carts: '15', units_purchased: '1' },
        ],
      }
    }
    if (sql.includes('DISTINCT ON (country)')) {
      return { rows: [{ country: 'CM', product_id: 'p1', product_name: 'Drill', view_count: '80' }] }
    }
    return { rows: [] }
  })
}

describe('getSearchDemand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns every section with safe, finite numbers on the happy path', async () => {
    mockSearchDemandQueries()
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getSearchDemand(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    expect(payload.topSearches[0]).toEqual({ query: 'drill', count: 50 })
    expect(payload.zeroResultSearches[0]).toEqual({ query: 'drone', count: 12 })
    expect(payload.searchesByCountry[0]).toEqual({ country: 'CM', count: 30 })
    expect(payload.searchTrend[0].zeroResultRate).toBe(25) // 5/20*100
    expect(payload.productsViewedButUnavailable[0].productName).toBe('Old Sander')
    expect(payload.topProductByCountry[0]).toEqual({ country: 'CM', productId: 'p1', productName: 'Drill', viewCount: 80 })
  })

  it('ranks high-view/low-cart and high-cart/low-purchase products correctly from the shared funnel data', async () => {
    mockSearchDemandQueries()
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getSearchDemand(req, res)

    const payload = res.json.mock.calls[0][0]
    // Drill: 100 views, 2 carts -> 2% view-to-cart (low) -- should rank first for high-view-low-cart.
    expect(payload.highViewLowCart[0].productId).toBe('p1')
    expect(payload.highViewLowCart[0].viewToCartRate).toBe(2)
    // Hammer: 15 carts, 1 purchase -> ~6.7% cart-to-purchase (low) -- should rank first for high-cart-low-purchase.
    expect(payload.highCartLowPurchase[0].productId).toBe('p2')
  })

  it('never crashes on a completely empty result set', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await expect(getSearchDemand(req, res)).resolves.not.toThrow()
    const payload = res.json.mock.calls[0][0]
    expect(payload.topSearches).toEqual([])
    expect(payload.highViewLowCart).toEqual([])
  })

  it('scopes every search/session query to a MARKET_MANAGER caller\'s country', async () => {
    mockSearchDemandQueries()
    const req: any = marketManagerReq({ query: {} })
    const res = makeRes()

    await getSearchDemand(req, res)

    const topSearchCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes("GROUP BY e.payload->>'searchQuery'") && !c[0].includes("= '0'"))
    expect(topSearchCall![0]).toContain('s.country_code = ANY(')
    const payload = res.json.mock.calls[0][0]
    expect(payload.scoped).toBe(true)
  })

  it('rejects an invalid date range with 400 and issues no queries', async () => {
    const req: any = globalReq({ query: { to: 'garbage' } })
    const res = makeRes()

    await getSearchDemand(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

function mockAcquisitionQueries() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('product_views')) {
      return {
        rows: [
          { source: 'google', medium: 'cpc', campaign: 'spring-sale', sessions: '500', product_views: '300', add_to_carts: '80', checkout_starts: '40' },
          { source: 'direct', medium: 'none', campaign: '', sessions: '200', product_views: '100', add_to_carts: '10', checkout_starts: '5' },
        ],
      }
    }
    if (sql.includes('as orders')) {
      return {
        rows: [{ source: 'google', medium: 'cpc', campaign: 'spring-sale', orders: '20', revenue: '4000.00' }],
      }
    }
    return { rows: [] }
  })
}

describe('getAcquisition', () => {
  beforeEach(() => jest.clearAllMocks())

  it('merges funnel-stage counts with orders/revenue by source+medium+campaign', async () => {
    mockAcquisitionQueries()
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getAcquisition(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    const google = payload.channels.find((c: any) => c.source === 'google')
    expect(google.sessions).toBe(500)
    expect(google.orders).toBe(20)
    expect(google.revenue).toBe(4000)
    expect(google.conversionRate).toBe(4) // 20/500*100

    // direct/none has no matching revenue row -- must default safely, not crash.
    const direct = payload.channels.find((c: any) => c.source === 'direct')
    expect(direct.orders).toBe(0)
    expect(direct.revenue).toBe(0)
    expect(direct.conversionRate).toBe(0)

    expect(payload.totals.revenue).toBe(4000)
  })

  it('never crashes on a completely empty result set', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await expect(getAcquisition(req, res)).resolves.not.toThrow()
    const payload = res.json.mock.calls[0][0]
    expect(payload.channels).toEqual([])
    expect(payload.totals).toEqual({ sessions: 0, orders: 0, revenue: 0 })
  })

  it('never fabricates spend/ROAS -- only a structural dataQuality note', async () => {
    mockAcquisitionQueries()
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getAcquisition(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.channels.every((c: any) => !('roas' in c) && !('spend' in c) && !('cpa' in c))).toBe(true)
    expect(payload.dataQuality.note).toMatch(/no ad-spend/i)
  })

  it('scopes session attribution to a MARKET_MANAGER caller\'s country', async () => {
    mockAcquisitionQueries()
    const req: any = marketManagerReq({ query: {} })
    const res = makeRes()

    await getAcquisition(req, res)

    const funnelCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('product_views'))
    expect(funnelCall![0]).toContain('country_code = ANY(')
    const payload = res.json.mock.calls[0][0]
    expect(payload.scoped).toBe(true)
  })
})

function mockOperationsQueries(opts: { alertsTableExists?: boolean } = {}) {
  mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
    if (sql.includes('to_regclass')) {
      const tableName = params?.[0]
      if (tableName === 'public.refunds') return { rows: [{ exists: false }] }
      if (tableName === 'public.alerts') return { rows: [{ exists: Boolean(opts.alertsTableExists) }] }
      return { rows: [{ exists: false }] }
    }
    if (sql.includes('FROM payments pay')) return { rows: [{ count: '3', amount: '450.00' }] }
    if (sql.includes("o.order_status = 'cancelled'")) return { rows: [{ count: '2' }] }
    if (sql.includes('o.estimated_delivery_date')) return { rows: [{ count: '1' }] }
    if (sql.includes("'pending', 'confirmed', 'processing'")) return { rows: [{ count: '4' }] }
    if (sql.includes('FROM supplier_import_batches')) return { rows: [{ count: '1' }] }
    if (sql.includes('WITH demand AS')) {
      return { rows: [{ product_id: 'p1', product_name: 'Drill', sku: 'DRL-1', add_to_cart_count: '8', current_stock: '0' }] }
    }
    if (sql.includes("FILTER (WHERE severity = 'critical')")) {
      return { rows: [{ critical: '1', high: '2', medium: '0', low: '3' }] }
    }
    if (sql.includes('ORDER BY triggered_at DESC')) {
      return { rows: [{ id: 'a1', alert_type: 'revenue_drop', severity: 'high', title: 'Revenue dropped', triggered_at: '2026-01-01' }] }
    }
    return { rows: [] }
  })
}

describe('getOperations', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns every operational signal with safe numbers for a global caller, including alerts', async () => {
    mockOperationsQueries({ alertsTableExists: true })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getOperations(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    expect(payload.paymentFailures).toEqual({ count: 3, amount: 450 })
    expect(payload.cancellations).toBe(2)
    expect(payload.overdueShipments).toBe(1)
    expect(payload.stuckOrders).toEqual({ count: 4, thresholdDays: 3 })
    expect(payload.supplierImportFailures).toBe(1)
    expect(payload.lowStockHighDemand[0].productName).toBe('Drill')
    expect(payload.activeAlerts).toEqual({ critical: 1, high: 2, medium: 0, low: 3 })
    expect(payload.recentAlerts[0].title).toBe('Revenue dropped')
    expect(payload.refunds).toBeNull() // refunds table doesn't exist
  })

  it('omits alerts entirely for a market-scoped caller, with an explanatory note -- never a mislabeled global count', async () => {
    mockOperationsQueries({ alertsTableExists: true })
    const req: any = marketManagerReq({ query: {} })
    const res = makeRes()

    await getOperations(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.activeAlerts).toBeNull()
    expect(payload.recentAlerts).toEqual([])
    expect(payload.dataQuality.alertsNote).toMatch(/not shown/i)
    // The alerts table must never even be queried for a scoped caller.
    expect(mockQuery.mock.calls.some((c: any[]) => c[0].includes('FROM alerts'))).toBe(false)
  })

  it('degrades gracefully when the alerts table does not exist', async () => {
    mockOperationsQueries({ alertsTableExists: false })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getOperations(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.activeAlerts).toBeNull()
    expect(payload.recentAlerts).toEqual([])
  })

  it('never crashes on a completely empty result set', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await expect(getOperations(req, res)).resolves.not.toThrow()
    const payload = res.json.mock.calls[0][0]
    expect(payload.paymentFailures).toEqual({ count: 0, amount: 0 })
    expect(payload.lowStockHighDemand).toEqual([])
  })

  it('scopes order-derived operational queries to a MARKET_MANAGER caller\'s country', async () => {
    mockOperationsQueries({ alertsTableExists: false })
    const req: any = marketManagerReq({ query: {} })
    const res = makeRes()

    await getOperations(req, res)

    const paymentFailuresCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('FROM payments pay'))
    expect(paymentFailuresCall![0]).toContain("LOWER(o.shipping_address->>'country')")
    const stuckOrdersCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes("'pending', 'confirmed', 'processing'"))
    expect(stuckOrdersCall![0]).toContain('$1')
  })
})

function mockCountryPerformanceQueries() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('as visitors')) return { rows: [{ country: 'CM', visitors: '500' }, { country: 'IT', visitors: '200' }] }
    if (sql.includes('as orders')) return { rows: [{ country: 'CM', orders: '25', revenue: '5000.00' }] }
    if (sql.includes('product_country_views')) return { rows: [{ country: 'CM', product_id: 'p1', product_name: 'Drill', view_count: '80' }] }
    if (sql.includes('search_by_country')) return { rows: [{ country: 'CM', search_query: 'drill', search_count: '30' }] }
    if (sql.includes('channel_by_country')) return { rows: [{ country: 'CM', source: 'google', session_count: '100' }] }
    return { rows: [] }
  })
}

describe('getCountryPerformance', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns a per-country breakdown labeled "Country Performance", never "Markets"', async () => {
    mockCountryPerformanceQueries()
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getCountryPerformance(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    expect(payload.label).toBe('Country Performance')
    const cm = payload.countries.find((c: any) => c.country === 'CM')
    expect(cm.visitors).toBe(500)
    expect(cm.orders).toBe(25)
    expect(cm.revenue).toBe(5000)
    expect(cm.conversionRate).toBe(5) // 25/500*100
    expect(cm.topProduct).toEqual({ productId: 'p1', productName: 'Drill' })
    expect(cm.topSearch).toEqual({ query: 'drill', count: 30 })
    expect(cm.topChannel).toBe('google')
  })

  it('never hardcodes Cameroon -- a country with visitors but no orders still appears, with zeros not a crash', async () => {
    mockCountryPerformanceQueries()
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await getCountryPerformance(req, res)

    const payload = res.json.mock.calls[0][0]
    const it = payload.countries.find((c: any) => c.country === 'IT')
    expect(it.orders).toBe(0)
    expect(it.revenue).toBe(0)
    expect(it.conversionRate).toBe(0)
    expect(it.topProduct).toBeNull()
  })

  it('never crashes on a completely empty result set', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = globalReq({ query: { comparisonMode: 'none' } })
    const res = makeRes()

    await expect(getCountryPerformance(req, res)).resolves.not.toThrow()
    const payload = res.json.mock.calls[0][0]
    expect(payload.countries).toEqual([])
  })

  it('scopes every dimension to a MARKET_MANAGER caller\'s country', async () => {
    mockCountryPerformanceQueries()
    const req: any = marketManagerReq({ query: {} })
    const res = makeRes()

    await getCountryPerformance(req, res)

    const visitorsCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('as visitors'))
    expect(visitorsCall![0]).toContain('country_code = ANY(')
    const payload = res.json.mock.calls[0][0]
    expect(payload.scoped).toBe(true)
  })

  it('rejects an invalid date range with 400 and issues no queries', async () => {
    const req: any = globalReq({ query: { from: 'garbage' } })
    const res = makeRes()

    await getCountryPerformance(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
