/**
 * ANALYTICS 2.0 (ADMIN-2B) — aggregated, business-intelligence endpoints.
 *
 * Deliberately a SEPARATE file from analytics.controller.ts, not a
 * replacement or rewrite of it -- every endpoint in analytics.controller.ts
 * (revenue-trend, conversion-funnel, top-products, visitors/*, channels,
 * market-overview, ...) is untouched and keeps working exactly as before.
 * This file adds the new consolidated, filterable, scope-aware endpoints
 * documented in docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md.
 *
 * Every endpoint here follows the same shape:
 *   1. parse + validate the date range (parseDateRangeParams)
 *   2. resolve the caller's market scope (resolveStaffScope) -- OWNER/
 *      SUPER_ADMIN/legacy admin get isGlobal=true; MARKET_MANAGER (or any
 *      other market-scoped role) gets isGlobal=false + their country list.
 *      This is a per-request decision made from the ALREADY-authenticated
 *      staff context, never a client-supplied flag.
 *   3. run scoped SQL aggregation (never fetch-all-then-filter)
 *   4. return numbers built exclusively through the safe* helpers, so nulls/
 *      zero-denominators/empty periods can never produce NaN/Infinity/a
 *      null.toFixed() crash on the frontend.
 */
import { Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { StaffAuthRequest } from '../../../middleware/staff'
import { tableExists } from './analytics.controller'
import {
  parseDateRangeParams,
  sendDateRangeError,
  safeNumber,
  safeDivide,
  safeRound,
  compareToPreviousPeriod,
  resolveStaffScope,
  sessionCountryScopeFilter,
  orderCountryScopeFilter,
  DateRange,
  StaffScope,
} from './analytics-query.helpers'

const COMPLETED_ORDER_STATUSES = "('confirmed','processing','ready_to_ship','shipped','delivered')"

/**
 * If the caller passes ?country=XX, narrow the effective scope to that one
 * country -- but only ever narrower than what the caller already has.
 * A global caller can filter down to any country. A scoped caller
 * requesting a country outside their own list gets the same empty/fails-
 * closed scope as if they'd been granted no market at all -- this is a
 * filter, not a privilege escalation path.
 */
function applyCountryFilterOverride(scope: StaffScope, requestedCountry: unknown): StaffScope {
  if (typeof requestedCountry !== 'string' || !requestedCountry) return scope
  const requested = requestedCountry.toUpperCase()
  if (scope.isGlobal) return { isGlobal: false, countries: [requested] }
  return scope.countries.includes(requested)
    ? { isGlobal: false, countries: [requested] }
    : { isGlobal: false, countries: [] }
}

// ============================================================
// Overview
// ============================================================

async function getOrdersSummary(range: DateRange, scope: StaffScope) {
  const scopeFilter = orderCountryScopeFilter(scope, 3, "o.shipping_address->>'country'")
  const result = await query(
    `SELECT COUNT(*) as order_count, COALESCE(SUM(o.grand_total), 0) as revenue
     FROM orders o
     WHERE o.created_at >= $1 AND o.created_at < $2
       AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
       ${scopeFilter.clause}`,
    [range.from, range.to, ...scopeFilter.params],
  )
  const row = result.rows[0]
  return { orderCount: safeNumber(row.order_count), revenue: safeNumber(row.revenue) }
}

async function getVisitorsSummary(range: DateRange, scope: StaffScope) {
  const scopeFilter = sessionCountryScopeFilter(scope, 3)
  const result = await query(
    `SELECT COUNT(DISTINCT session_id) as visitor_count
     FROM user_sessions
     WHERE start_time >= $1 AND start_time < $2
       ${scopeFilter.clause}`,
    [range.from, range.to, ...scopeFilter.params],
  )
  return safeNumber(result.rows[0].visitor_count)
}

/**
 * checkout_start/payment_success are reliably fired from the web store but
 * NOT from the mobile app today (trackCheckoutStart/trackPaymentSuccess are
 * defined but never called from any mobile screen -- see the ADMIN-2B
 * report's mobile audit). Every caller of this must treat the result as
 * PARTIAL, not complete, and the Overview/Funnel responses carry an
 * explicit dataQuality note rather than presenting it as trustworthy.
 */
async function getCheckoutFunnelSummary(range: DateRange, scope: StaffScope) {
  const scopeFilter = sessionCountryScopeFilter(scope, 3, 's.country_code')
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE e.event_type = 'checkout_start') as checkout_starts,
       COUNT(*) FILTER (WHERE e.event_type = 'payment_success') as payment_successes
     FROM events_core e
     LEFT JOIN user_sessions s ON s.session_id = e.session_id
     WHERE e.event_time >= $1 AND e.event_time < $2
       AND e.event_type IN ('checkout_start', 'payment_success')
       ${scopeFilter.clause}`,
    [range.from, range.to, ...scopeFilter.params],
  )
  const row = result.rows[0]
  return {
    checkoutStarts: safeNumber(row.checkout_starts),
    paymentSuccesses: safeNumber(row.payment_successes),
  }
}

async function getRefundCount(range: DateRange): Promise<{ refundCount: number; available: boolean }> {
  const hasRefundsTable = await tableExists('public.refunds')
  if (!hasRefundsTable) return { refundCount: 0, available: false }
  const result = await query(
    `SELECT COUNT(*) as refund_count FROM refunds WHERE created_at >= $1 AND created_at < $2 AND status = 'completed'`,
    [range.from, range.to],
  )
  return { refundCount: safeNumber(result.rows[0].refund_count), available: true }
}

async function getReturningCustomerRate(range: DateRange, scope: StaffScope) {
  const scopeFilter = orderCountryScopeFilter(scope, 3, "o.shipping_address->>'country'")
  const result = await query(
    `WITH period_customers AS (
       SELECT DISTINCT o.user_id
       FROM orders o
       WHERE o.created_at >= $1 AND o.created_at < $2
         AND o.user_id IS NOT NULL
         AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
         ${scopeFilter.clause}
     ),
     lifetime_counts AS (
       SELECT pc.user_id, COUNT(o2.id) as lifetime_orders
       FROM period_customers pc
       JOIN orders o2 ON o2.user_id = pc.user_id AND o2.order_status IN ${COMPLETED_ORDER_STATUSES}
       GROUP BY pc.user_id
     )
     SELECT
       COUNT(*) as sample_size,
       COUNT(*) FILTER (WHERE lifetime_orders > 1) as returning_count
     FROM lifetime_counts`,
    [range.from, range.to, ...scopeFilter.params],
  )
  const row = result.rows[0]
  const sampleSize = safeNumber(row.sample_size)
  return { rate: safeRound(safeDivide(safeNumber(row.returning_count), sampleSize) * 100), sampleSize }
}

/**
 * Gross margin, computed only from order_items whose product has a known
 * products.cost_price -- never fabricated for products where cost is
 * unknown. marginCoveragePercent tells the frontend how much of period
 * revenue that figure actually represents, so a low-coverage period can
 * show a DataQualityNotice instead of a falsely-precise number.
 */
async function getGrossMarginSummary(range: DateRange, scope: StaffScope) {
  const scopeFilter = orderCountryScopeFilter(scope, 3, "o.shipping_address->>'country'")
  const result = await query(
    `SELECT
       COALESCE(SUM(oi.total_price), 0) as total_revenue,
       COALESCE(SUM(oi.total_price) FILTER (WHERE p.cost_price IS NOT NULL), 0) as covered_revenue,
       COALESCE(SUM(oi.total_price - (oi.quantity * p.cost_price)) FILTER (WHERE p.cost_price IS NOT NULL), 0) as gross_margin
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.created_at >= $1 AND o.created_at < $2
       AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
       ${scopeFilter.clause}`,
    [range.from, range.to, ...scopeFilter.params],
  )
  const row = result.rows[0]
  const totalRevenue = safeNumber(row.total_revenue)
  const coveredRevenue = safeNumber(row.covered_revenue)
  return {
    grossMargin: safeRound(row.gross_margin),
    marginCoveragePercent: safeRound(safeDivide(coveredRevenue, totalRevenue) * 100),
  }
}

async function computeOverviewMetrics(range: DateRange, scope: StaffScope) {
  const [orders, visitors, funnel, refunds, returning, margin] = await Promise.all([
    getOrdersSummary(range, scope),
    getVisitorsSummary(range, scope),
    getCheckoutFunnelSummary(range, scope),
    getRefundCount(range),
    getReturningCustomerRate(range, scope),
    getGrossMarginSummary(range, scope),
  ])

  return {
    revenue: orders.revenue,
    orders: orders.orderCount,
    aov: safeRound(safeDivide(orders.revenue, orders.orderCount)),
    visitors: visitors,
    conversionRate: safeRound(safeDivide(orders.orderCount, visitors) * 100),
    checkoutAbandonmentRate: safeRound(
      safeDivide(funnel.checkoutStarts - funnel.paymentSuccesses, funnel.checkoutStarts) * 100,
    ),
    refundRate: refunds.available ? safeRound(safeDivide(refunds.refundCount, orders.orderCount) * 100) : null,
    returningCustomerRate: returning.rate,
    grossMargin: margin.grossMargin,
    marginCoveragePercent: margin.marginCoveragePercent,
  }
}

export const getOverview = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const parsed = parseDateRangeParams(req.query as Record<string, unknown>)
  if (!parsed.ok || !parsed.range) return sendDateRangeError(res, parsed.error || 'Invalid date range')

  try {
    const scope = applyCountryFilterOverride(resolveStaffScope(req), req.query.country)
    const range = parsed.range

    const [current, previous] = await Promise.all([
      computeOverviewMetrics({ from: range.from, to: range.to }, scope),
      range.compare ? computeOverviewMetrics(range.compare, scope) : Promise.resolve(null),
    ])

    const metricKeys: (keyof typeof current)[] = [
      'revenue',
      'orders',
      'aov',
      'visitors',
      'conversionRate',
      'checkoutAbandonmentRate',
      'refundRate',
      'returningCustomerRate',
      'grossMargin',
    ]

    const metrics: Record<string, ReturnType<typeof compareToPreviousPeriod>> = {}
    for (const key of metricKeys) {
      metrics[key] = compareToPreviousPeriod(current[key], previous ? previous[key] : null)
    }

    res.json({
      success: true,
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      comparisonMode: range.comparisonMode,
      compare: range.compare
        ? { from: range.compare.from.toISOString(), to: range.compare.to.toISOString() }
        : null,
      scoped: !scope.isGlobal,
      markets: scope.isGlobal ? [] : scope.countries,
      metrics,
      dataQuality: {
        refundRateAvailable: current.refundRate !== null,
        marginCoveragePercent: current.marginCoveragePercent,
        checkoutFunnelNote:
          'checkout_start/payment_success events are not yet fired from the mobile app -- checkoutAbandonmentRate and conversionRate reflect web + any instrumented sources only, not true cross-platform totals.',
      },
    })
  } catch (error) {
    logger.error('Error fetching analytics overview:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch analytics overview' })
  }
}

// ============================================================
// Sales
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validates a query param looks like a real UUID before it ever reaches SQL -- garbage input becomes "filter not applied", not a query error. */
function parseUuidParam(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

/**
 * Builds an `EXISTS (...)` clause restricting orders to ones containing a
 * given product/category, used to let every Sales sub-query honor the same
 * productId/categoryId filter without each one hand-rolling its own join.
 */
function productCategoryExistsFilter(
  productId: string | null,
  categoryId: string | null,
  nextParamIndex: number,
): { clause: string; params: unknown[] } {
  if (!productId && !categoryId) return { clause: '', params: [] }
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = nextParamIndex
  if (productId) {
    conditions.push(`oi.product_id = $${idx}`)
    params.push(productId)
    idx += 1
  }
  if (categoryId) {
    conditions.push(`p.category_id = $${idx}`)
    params.push(categoryId)
    idx += 1
  }
  return {
    clause: `AND EXISTS (
      SELECT 1 FROM order_items oi
      ${categoryId ? 'JOIN products p ON p.id = oi.product_id' : ''}
      WHERE oi.order_id = o.id AND ${conditions.join(' AND ')}
    )`,
    params,
  }
}

export const getSales = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const parsed = parseDateRangeParams(req.query as Record<string, unknown>)
  if (!parsed.ok || !parsed.range) return sendDateRangeError(res, parsed.error || 'Invalid date range')

  try {
    const scope = applyCountryFilterOverride(resolveStaffScope(req), req.query.country)
    const { from, to } = parsed.range
    const productId = parseUuidParam(req.query.productId)
    const categoryId = parseUuidParam(req.query.categoryId)

    // Every sub-query below shares the same three building blocks --
    // [date range params, order-scope filter, product/category filter] --
    // assembled in that fixed order so each query's own extra params
    // (e.g. a LIMIT) can safely start counting from a known offset.
    const buildFilters = (nextParamIndex: number) => {
      const scopeFilter = orderCountryScopeFilter(scope, nextParamIndex, "o.shipping_address->>'country'")
      const pcFilter = productCategoryExistsFilter(productId, categoryId, nextParamIndex + scopeFilter.params.length)
      return {
        clause: `${scopeFilter.clause} ${pcFilter.clause}`,
        params: [...scopeFilter.params, ...pcFilter.params],
      }
    }

    const filters = buildFilters(3)

    const [trendResult, byProductResult, byCategoryResult, byCountryResult, orderStatusResult, paymentStatusResult, unitsResult] =
      await Promise.all([
        query(
          `SELECT
             DATE(o.created_at) as date,
             COUNT(*) as order_count,
             COALESCE(SUM(o.grand_total), 0) as revenue
           FROM orders o
           WHERE o.created_at >= $1 AND o.created_at < $2
             AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
             ${filters.clause}
           GROUP BY DATE(o.created_at)
           ORDER BY DATE(o.created_at) ASC`,
          [from, to, ...filters.params],
        ),
        query(
          `SELECT p.id as product_id, p.name as product_name, p.sku,
                  SUM(oi.quantity) as units_sold,
                  COALESCE(SUM(oi.total_price), 0) as revenue
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE o.created_at >= $1 AND o.created_at < $2
             AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
             ${buildFilters(3).clause}
           GROUP BY p.id, p.name, p.sku
           ORDER BY revenue DESC
           LIMIT 20`,
          [from, to, ...buildFilters(3).params],
        ),
        query(
          `SELECT c.id as category_id, c.name as category_name,
                  COALESCE(SUM(oi.total_price), 0) as revenue
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           LEFT JOIN products p ON p.id = oi.product_id
           LEFT JOIN categories c ON c.id = p.category_id
           WHERE o.created_at >= $1 AND o.created_at < $2
             AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
             ${buildFilters(3).clause}
           GROUP BY c.id, c.name
           ORDER BY revenue DESC
           LIMIT 20`,
          [from, to, ...buildFilters(3).params],
        ),
        query(
          `SELECT COALESCE(o.shipping_address->>'country', 'unknown') as country,
                  COUNT(*) as order_count,
                  COALESCE(SUM(o.grand_total), 0) as revenue
           FROM orders o
           WHERE o.created_at >= $1 AND o.created_at < $2
             AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
             ${buildFilters(3).clause}
           GROUP BY o.shipping_address->>'country'
           ORDER BY revenue DESC
           LIMIT 25`,
          [from, to, ...buildFilters(3).params],
        ),
        query(
          `SELECT o.order_status as status, COUNT(*) as count
           FROM orders o
           WHERE o.created_at >= $1 AND o.created_at < $2
             ${buildFilters(3).clause}
           GROUP BY o.order_status`,
          [from, to, ...buildFilters(3).params],
        ),
        query(
          `SELECT o.payment_status as status, COUNT(*) as count
           FROM orders o
           WHERE o.created_at >= $1 AND o.created_at < $2
             ${buildFilters(3).clause}
           GROUP BY o.payment_status`,
          [from, to, ...buildFilters(3).params],
        ),
        query(
          `SELECT COALESCE(SUM(oi.quantity), 0) as units_sold
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.created_at >= $1 AND o.created_at < $2
             AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
             ${buildFilters(3).clause}`,
          [from, to, ...buildFilters(3).params],
        ),
      ])

    const [refunds, cancellationTotal] = await Promise.all([
      getRefundCount({ from, to }),
      query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE o.order_status = 'cancelled') as cancelled
         FROM orders o
         WHERE o.created_at >= $1 AND o.created_at < $2
           ${buildFilters(3).clause}`,
        [from, to, ...buildFilters(3).params],
      ),
    ])

    const totalOrdersInRange = safeNumber(cancellationTotal.rows[0]?.total)
    const cancelledOrders = safeNumber(cancellationTotal.rows[0]?.cancelled)

    res.json({
      success: true,
      period: { from: from.toISOString(), to: to.toISOString() },
      scoped: !scope.isGlobal,
      markets: scope.isGlobal ? [] : scope.countries,
      filters: { productId, categoryId },
      trend: trendResult.rows.map((row: any) => {
        const revenue = safeNumber(row.revenue)
        const orderCount = safeNumber(row.order_count)
        return {
          date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
          revenue,
          orders: orderCount,
          aov: safeRound(safeDivide(revenue, orderCount)),
        }
      }),
      unitsSold: safeNumber(unitsResult.rows[0]?.units_sold),
      revenueByProduct: byProductResult.rows.map((row: any) => ({
        productId: row.product_id,
        productName: row.product_name || 'Unknown product',
        sku: row.sku,
        unitsSold: safeNumber(row.units_sold),
        revenue: safeNumber(row.revenue),
      })),
      revenueByCategory: byCategoryResult.rows.map((row: any) => ({
        categoryId: row.category_id,
        categoryName: row.category_name || 'Uncategorized',
        revenue: safeNumber(row.revenue),
      })),
      revenueByCountry: byCountryResult.rows.map((row: any) => ({
        country: row.country,
        orders: safeNumber(row.order_count),
        revenue: safeNumber(row.revenue),
      })),
      orderStatusDistribution: orderStatusResult.rows.map((row: any) => ({
        status: row.status,
        count: safeNumber(row.count),
      })),
      paymentStatusDistribution: paymentStatusResult.rows.map((row: any) => ({
        status: row.status,
        count: safeNumber(row.count),
      })),
      cancellationRate: safeRound(safeDivide(cancelledOrders, totalOrdersInRange) * 100),
      refundRate: refunds.available ? safeRound(safeDivide(refunds.refundCount, totalOrdersInRange) * 100) : null,
      dataQuality: {
        refundRateAvailable: refunds.available,
      },
    })
  } catch (error) {
    logger.error('Error fetching sales analytics:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch sales analytics' })
  }
}

// ============================================================
// Funnel
// ============================================================

const FUNNEL_DEVICE_TYPES = ['desktop', 'tablet', 'mobile', 'unknown']

/**
 * Segmentation shared by the "Sessions" stage (user_sessions columns) and,
 * via the session join, every later stage too. Product/category do NOT
 * apply here -- a session itself isn't tied to a product; they're applied
 * separately, only to the product_view/add_to_cart stages (see
 * getFunnelProductStages below), since checkout_start/payment_success
 * events carry no product_id in this schema (their payload is cart/order-
 * level, covering multiple products at once).
 */
function funnelSessionFilters(
  query: Record<string, unknown>,
  scope: StaffScope,
  nextParamIndex: number,
): { clause: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = nextParamIndex

  const device = typeof query.device === 'string' ? query.device : null
  if (device && FUNNEL_DEVICE_TYPES.includes(device)) {
    conditions.push(`device_type = $${idx}`)
    params.push(device)
    idx += 1
  }
  const source = typeof query.source === 'string' ? query.source : null
  if (source) {
    conditions.push(`utm_source = $${idx}`)
    params.push(source)
    idx += 1
  }
  const campaign = typeof query.campaign === 'string' ? query.campaign : null
  if (campaign) {
    conditions.push(`utm_campaign = $${idx}`)
    params.push(campaign)
    idx += 1
  }

  const scopeFilter = sessionCountryScopeFilter(scope, idx)
  const clauseParts = [conditions.length ? `AND ${conditions.join(' AND ')}` : '', scopeFilter.clause]
  return { clause: clauseParts.filter(Boolean).join(' '), params: [...params, ...scopeFilter.params] }
}

export const getFunnel = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const parsed = parseDateRangeParams(req.query as Record<string, unknown>)
  if (!parsed.ok || !parsed.range) return sendDateRangeError(res, parsed.error || 'Invalid date range')

  try {
    const scope = applyCountryFilterOverride(resolveStaffScope(req), req.query.country)
    const { from, to } = parsed.range
    const productId = parseUuidParam(req.query.productId)
    const categoryId = parseUuidParam(req.query.categoryId)
    const sessionFilters = funnelSessionFilters(req.query as Record<string, unknown>, scope, 3)

    const sessionsResult = await query(
      `SELECT COUNT(DISTINCT session_id) as session_count
       FROM user_sessions
       WHERE start_time >= $1 AND start_time < $2
         ${sessionFilters.clause}`,
      [from, to, ...sessionFilters.params],
    )
    const sessionCount = safeNumber(sessionsResult.rows[0]?.session_count)

    // product_view / add_to_cart -- these DO carry product_id, so the
    // product/category filter applies here, restricted to sessions that
    // already matched the segmentation above via a join.
    const productFilterConditions: string[] = []
    const productFilterParams: unknown[] = []
    let pIdx = 3 + sessionFilters.params.length
    if (productId) {
      productFilterConditions.push(`e.product_id = $${pIdx}`)
      productFilterParams.push(productId)
      pIdx += 1
    }
    if (categoryId) {
      productFilterConditions.push(`p.category_id = $${pIdx}`)
      productFilterParams.push(categoryId)
      pIdx += 1
    }

    const productStageResult = await query(
      `WITH in_scope_sessions AS (
         SELECT session_id FROM user_sessions
         WHERE start_time >= $1 AND start_time < $2
           ${sessionFilters.clause}
       )
       SELECT
         COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'product_view') as product_views,
         COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'add_to_cart') as add_to_carts
       FROM events_core e
       JOIN in_scope_sessions iss ON iss.session_id = e.session_id
       ${categoryId ? 'LEFT JOIN products p ON p.id = e.product_id' : ''}
       WHERE e.event_time >= $1 AND e.event_time < $2
         AND e.event_type IN ('product_view', 'add_to_cart')
         ${productFilterConditions.length ? `AND ${productFilterConditions.join(' AND ')}` : ''}`,
      [from, to, ...sessionFilters.params, ...productFilterParams],
    )
    const productViews = safeNumber(productStageResult.rows[0]?.product_views)
    const addToCarts = safeNumber(productStageResult.rows[0]?.add_to_carts)

    // checkout_start / payment_success -- never product-filtered (see the
    // function doc comment above); still respects device/source/campaign/
    // country segmentation via the same in-scope-sessions join.
    const checkoutStageResult = await query(
      `WITH in_scope_sessions AS (
         SELECT session_id FROM user_sessions
         WHERE start_time >= $1 AND start_time < $2
           ${sessionFilters.clause}
       )
       SELECT
         COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'checkout_start') as checkout_starts,
         COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'payment_success') as payment_successes
       FROM events_core e
       JOIN in_scope_sessions iss ON iss.session_id = e.session_id
       WHERE e.event_time >= $1 AND e.event_time < $2
         AND e.event_type IN ('checkout_start', 'payment_success')`,
      [from, to, ...sessionFilters.params],
    )
    const checkoutStarts = safeNumber(checkoutStageResult.rows[0]?.checkout_starts)
    const paymentSuccesses = safeNumber(checkoutStageResult.rows[0]?.payment_successes)

    const stageCounts = [
      { key: 'sessions', label: 'Sessions', count: sessionCount, dataQuality: 'complete' as const },
      { key: 'product_view', label: 'Product View', count: productViews, dataQuality: 'complete' as const },
      { key: 'add_to_cart', label: 'Add to Cart', count: addToCarts, dataQuality: 'complete' as const },
      { key: 'checkout_start', label: 'Checkout Start', count: checkoutStarts, dataQuality: 'partial' as const },
      { key: 'payment_success', label: 'Payment Success', count: paymentSuccesses, dataQuality: 'partial' as const },
    ]

    let previousCount = stageCounts[0].count
    const stages = stageCounts.map((stage, index) => {
      const stageConversion = index === 0 ? 100 : safeRound(safeDivide(stage.count, previousCount) * 100)
      const dropOffCount = index === 0 ? 0 : Math.max(previousCount - stage.count, 0)
      const dropOffPercent = index === 0 ? 0 : safeRound(safeDivide(dropOffCount, previousCount) * 100)
      previousCount = stage.count
      return {
        key: stage.key,
        label: stage.label,
        count: stage.count,
        stageConversionPercent: stageConversion,
        dropOffCount,
        dropOffPercent,
        dataQuality: stage.dataQuality,
      }
    })

    res.json({
      success: true,
      period: { from: from.toISOString(), to: to.toISOString() },
      scoped: !scope.isGlobal,
      markets: scope.isGlobal ? [] : scope.countries,
      filters: {
        device: typeof req.query.device === 'string' ? req.query.device : null,
        source: typeof req.query.source === 'string' ? req.query.source : null,
        campaign: typeof req.query.campaign === 'string' ? req.query.campaign : null,
        productId,
        categoryId,
      },
      stages,
      overallConversionPercent: safeRound(safeDivide(paymentSuccesses, sessionCount) * 100),
      dataQuality: {
        note:
          'Mobile checkout funnel data is partially instrumented -- the mobile app tracks Sessions/Product View/Add to Cart but does not yet fire Checkout Start or Payment Success events. Those two stages reflect web (and any other instrumented source) only, not true cross-platform totals.',
        partialStages: ['checkout_start', 'payment_success'],
      },
    })
  } catch (error) {
    logger.error('Error fetching funnel analytics:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch funnel analytics' })
  }
}

// ============================================================
// Product Intelligence
// ============================================================

const PRODUCT_SORT_COLUMNS: Record<string, string> = {
  most_viewed: 'views DESC',
  most_revenue: 'revenue DESC',
  best_conversion: 'conversion_rate DESC NULLS LAST',
  worst_conversion: 'conversion_rate ASC NULLS LAST',
  highest_demand: 'add_to_carts DESC',
  low_stock: 'current_stock ASC NULLS LAST',
  // "high demand + zero stock" -- the procurement-priority sort: rank
  // zero-stock products with real demand first, then everyone else by
  // revenue. Never fabricates a combined score beyond a simple boolean
  // partition + existing revenue ordering.
  high_demand_zero_stock: '(current_stock = 0 AND add_to_carts > 0) DESC, add_to_carts DESC',
}

/**
 * Product intelligence table -- Views/Add to carts/Purchases/Revenue come
 * from events_core + order_items (real, per-product). "Checkout starts" is
 * deliberately NOT included here: checkout_start events carry no
 * product_id in this schema (the payload is a whole cart, not a single
 * item), so a per-product checkout-start count would have to be
 * fabricated by, e.g., attributing the whole cart's checkout to every item
 * in it -- not done. "Search demand" is likewise not attempted here as an
 * approximate per-product number; see GET /analytics/search-demand for
 * the aggregate (not per-product) search-quality signals this schema can
 * actually support.
 */
export const getProductIntelligence = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const parsed = parseDateRangeParams(req.query as Record<string, unknown>)
  if (!parsed.ok || !parsed.range) return sendDateRangeError(res, parsed.error || 'Invalid date range')

  try {
    const scope = applyCountryFilterOverride(resolveStaffScope(req), req.query.country)
    const { from, to } = parsed.range
    const categoryId = parseUuidParam(req.query.categoryId)
    const sortKey = typeof req.query.sort === 'string' && PRODUCT_SORT_COLUMNS[req.query.sort] ? req.query.sort : 'most_revenue'
    const limit = Math.min(Math.max(safeNumber(req.query.limit) || 50, 1), 200)

    // events_core has no market-scope column of its own -- product-level
    // demand is scoped via the viewing session's country, same primitive
    // every other events_core-derived endpoint in this file uses.
    const sessionScope = sessionCountryScopeFilter(scope, 3, 's.country_code')
    const orderScope = orderCountryScopeFilter(scope, 3 + sessionScope.params.length, "o.shipping_address->>'country'")

    const categoryFilter = categoryId ? `AND p.category_id = $${4 + sessionScope.params.length + orderScope.params.length}` : ''
    const categoryParam = categoryId ? [categoryId] : []

    const result = await query(
      `WITH view_stats AS (
         SELECT e.product_id,
                COUNT(*) FILTER (WHERE e.event_type = 'product_view') as views,
                COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'product_view') as unique_visitors,
                COUNT(*) FILTER (WHERE e.event_type = 'add_to_cart') as add_to_carts
         FROM events_core e
         LEFT JOIN user_sessions s ON s.session_id = e.session_id
         WHERE e.event_time >= $1 AND e.event_time < $2
           AND e.event_type IN ('product_view', 'add_to_cart')
           AND e.product_id IS NOT NULL
           ${sessionScope.clause}
         GROUP BY e.product_id
       ),
       purchase_stats AS (
         SELECT oi.product_id,
                SUM(oi.quantity) as units_purchased,
                COALESCE(SUM(oi.total_price), 0) as revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= $1 AND o.created_at < $2
           AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
           ${orderScope.clause}
         GROUP BY oi.product_id
       ),
       stock AS (
         SELECT product_id, COALESCE(SUM(available_stock), 0) as current_stock
         FROM inventory
         GROUP BY product_id
       )
       SELECT
         p.id as product_id,
         p.name as product_name,
         p.sku,
         p.cost_price,
         p.base_price,
         p.sale_price,
         COALESCE(vs.views, 0) as views,
         COALESCE(vs.unique_visitors, 0) as unique_visitors,
         COALESCE(vs.add_to_carts, 0) as add_to_carts,
         COALESCE(ps.units_purchased, 0) as units_purchased,
         COALESCE(ps.revenue, 0) as revenue,
         st.current_stock,
         CASE WHEN COALESCE(vs.unique_visitors, 0) > 0
           THEN COALESCE(ps.units_purchased, 0)::NUMERIC / vs.unique_visitors
           ELSE NULL
         END as conversion_rate
       FROM products p
       LEFT JOIN view_stats vs ON vs.product_id = p.id
       LEFT JOIN purchase_stats ps ON ps.product_id = p.id
       LEFT JOIN stock st ON st.product_id = p.id
       WHERE p.deleted_at IS NULL
         AND (vs.product_id IS NOT NULL OR ps.product_id IS NOT NULL)
         ${categoryFilter}
       ORDER BY ${PRODUCT_SORT_COLUMNS[sortKey]}
       LIMIT ${limit}`,
      [from, to, ...sessionScope.params, ...orderScope.params, ...categoryParam],
    )

    const products = result.rows.map((row: any) => {
      const views = safeNumber(row.views)
      const uniqueVisitors = safeNumber(row.unique_visitors)
      const addToCarts = safeNumber(row.add_to_carts)
      const unitsPurchased = safeNumber(row.units_purchased)
      const revenue = safeNumber(row.revenue)
      const hasCostPrice = row.cost_price !== null && row.cost_price !== undefined
      const sellPrice = safeNumber(row.sale_price) || safeNumber(row.base_price)
      const marginPerUnit = hasCostPrice ? safeRound(sellPrice - safeNumber(row.cost_price)) : null

      return {
        productId: row.product_id,
        productName: row.product_name || 'Unknown product',
        sku: row.sku,
        views,
        uniqueVisitors,
        addToCarts,
        purchases: unitsPurchased,
        revenue,
        conversionRate: safeRound(safeDivide(unitsPurchased, uniqueVisitors) * 100),
        cartToPurchaseRate: safeRound(safeDivide(unitsPurchased, addToCarts) * 100),
        currentStock: row.current_stock === null || row.current_stock === undefined ? null : safeNumber(row.current_stock),
        margin: marginPerUnit === null ? null : { perUnit: marginPerUnit, available: true },
      }
    })

    res.json({
      success: true,
      period: { from: from.toISOString(), to: to.toISOString() },
      scoped: !scope.isGlobal,
      markets: scope.isGlobal ? [] : scope.countries,
      sort: sortKey,
      products,
      dataQuality: {
        checkoutStartsNote:
          'Per-product checkout-start counts are not shown -- checkout_start events record the whole cart, not individual items, so a per-product figure cannot be derived without attribution guesses.',
        marginNote:
          'Margin is shown only for products with a recorded cost price (products.cost_price); products without one show no margin figure rather than an assumed 0.',
        stockNote:
          'currentStock is summed from inventory.available_stock across all warehouse rows for the product -- the same source checkout itself trusts, not the separate (and potentially stale) products.stock_quantity column.',
      },
    })
  } catch (error) {
    logger.error('Error fetching product intelligence:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch product intelligence' })
  }
}

// ============================================================
// Search & Demand Intelligence
// ============================================================

/**
 * "Zero-result searches" doubles as "high-frequency searches with no
 * matching product" from the spec -- a search that legitimately returned
 * zero results IS, by definition, a query with no matching product; a
 * second, separately-computed list would just be the same data twice.
 */
export const getSearchDemand = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const parsed = parseDateRangeParams(req.query as Record<string, unknown>)
  if (!parsed.ok || !parsed.range) return sendDateRangeError(res, parsed.error || 'Invalid date range')

  try {
    const scope = applyCountryFilterOverride(resolveStaffScope(req), req.query.country)
    const { from, to } = parsed.range
    const sessionScope = sessionCountryScopeFilter(scope, 3, 's.country_code')

    const [
      topSearchesResult,
      zeroResultResult,
      byCountryResult,
      trendResult,
      unavailableViewedResult,
      productFunnelResult,
      productsByCountryResult,
    ] = await Promise.all([
        query(
          `SELECT e.payload->>'searchQuery' as search_query, COUNT(*) as search_count
           FROM events_core e
           LEFT JOIN user_sessions s ON s.session_id = e.session_id
           WHERE e.event_time >= $1 AND e.event_time < $2
             AND e.event_type = 'search'
             AND e.payload->>'searchQuery' IS NOT NULL
             ${sessionScope.clause}
           GROUP BY e.payload->>'searchQuery'
           ORDER BY search_count DESC
           LIMIT 50`,
          [from, to, ...sessionScope.params],
        ),
        query(
          `SELECT e.payload->>'searchQuery' as search_query, COUNT(*) as search_count
           FROM events_core e
           LEFT JOIN user_sessions s ON s.session_id = e.session_id
           WHERE e.event_time >= $1 AND e.event_time < $2
             AND e.event_type = 'search'
             AND e.payload->>'searchQuery' IS NOT NULL
             AND COALESCE(e.payload->>'resultsCount', '0') = '0'
             ${sessionScope.clause}
           GROUP BY e.payload->>'searchQuery'
           ORDER BY search_count DESC
           LIMIT 50`,
          [from, to, ...sessionScope.params],
        ),
        query(
          `SELECT COALESCE(s.country_code, 'XX') as country, COUNT(*) as search_count
           FROM events_core e
           LEFT JOIN user_sessions s ON s.session_id = e.session_id
           WHERE e.event_time >= $1 AND e.event_time < $2
             AND e.event_type = 'search'
             ${sessionScope.clause}
           GROUP BY COALESCE(s.country_code, 'XX')
           ORDER BY search_count DESC
           LIMIT 25`,
          [from, to, ...sessionScope.params],
        ),
        query(
          `SELECT DATE(e.event_time) as date,
                  COUNT(*) as search_count,
                  COUNT(*) FILTER (WHERE COALESCE(e.payload->>'resultsCount', '0') = '0') as zero_result_count
           FROM events_core e
           LEFT JOIN user_sessions s ON s.session_id = e.session_id
           WHERE e.event_time >= $1 AND e.event_time < $2
             AND e.event_type = 'search'
             ${sessionScope.clause}
           GROUP BY DATE(e.event_time)
           ORDER BY DATE(e.event_time) ASC`,
          [from, to, ...sessionScope.params],
        ),
        // Products viewed repeatedly (>=3 views in range) that are currently
        // unavailable (inactive, or zero available stock right now).
        query(
          `SELECT p.id as product_id, p.name as product_name, p.sku,
                  COUNT(*) as view_count,
                  COALESCE(st.current_stock, 0) as current_stock,
                  p.is_active
           FROM events_core e
           LEFT JOIN user_sessions s ON s.session_id = e.session_id
           JOIN products p ON p.id = e.product_id
           LEFT JOIN (
             SELECT product_id, SUM(available_stock) as current_stock
             FROM inventory GROUP BY product_id
           ) st ON st.product_id = p.id
           WHERE e.event_time >= $1 AND e.event_time < $2
             AND e.event_type = 'product_view'
             AND (p.is_active = false OR COALESCE(st.current_stock, 0) <= 0)
             ${sessionScope.clause}
           GROUP BY p.id, p.name, p.sku, st.current_stock, p.is_active
           HAVING COUNT(*) >= 3
           ORDER BY view_count DESC
           LIMIT 25`,
          [from, to, ...sessionScope.params],
        ),
        // Base data for high-view/low-cart and high-cart/low-purchase --
        // computed once, sliced two ways in JS below.
        query(
          `WITH view_stats AS (
             SELECT e.product_id,
                    COUNT(*) FILTER (WHERE e.event_type = 'product_view') as views,
                    COUNT(*) FILTER (WHERE e.event_type = 'add_to_cart') as add_to_carts
             FROM events_core e
             LEFT JOIN user_sessions s ON s.session_id = e.session_id
             WHERE e.event_time >= $1 AND e.event_time < $2
               AND e.event_type IN ('product_view', 'add_to_cart')
               AND e.product_id IS NOT NULL
               ${sessionScope.clause}
             GROUP BY e.product_id
             HAVING COUNT(*) FILTER (WHERE e.event_type = 'product_view') >= 10
           ),
           purchase_stats AS (
             SELECT product_id, SUM(quantity) as units_purchased
             FROM order_items
             GROUP BY product_id
           )
           SELECT vs.product_id, p.name as product_name, p.sku,
                  vs.views, vs.add_to_carts, COALESCE(ps.units_purchased, 0) as units_purchased
           FROM view_stats vs
           JOIN products p ON p.id = vs.product_id
           LEFT JOIN purchase_stats ps ON ps.product_id = vs.product_id`,
          [from, to, ...sessionScope.params],
        ),
        // Top-viewed product per country -- DISTINCT ON picks the single
        // highest-view-count product for each country, ranked by that
        // country's total product_view volume.
        query(
          `WITH product_country_views AS (
             SELECT e.product_id, p.name as product_name, s.country_code as country,
                    COUNT(*) as view_count
             FROM events_core e
             JOIN user_sessions s ON s.session_id = e.session_id
             JOIN products p ON p.id = e.product_id
             WHERE e.event_time >= $1 AND e.event_time < $2
               AND e.event_type = 'product_view'
               AND s.country_code IS NOT NULL
               ${sessionScope.clause}
             GROUP BY e.product_id, p.name, s.country_code
           )
           SELECT DISTINCT ON (country) country, product_id, product_name, view_count
           FROM product_country_views
           ORDER BY country, view_count DESC`,
          [from, to, ...sessionScope.params],
        ),
      ])

    const productFunnelRows = productFunnelResult.rows.map((row: any) => {
      const views = safeNumber(row.views)
      const addToCarts = safeNumber(row.add_to_carts)
      const unitsPurchased = safeNumber(row.units_purchased)
      return {
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        views,
        addToCarts,
        purchases: unitsPurchased,
        viewToCartRate: safeRound(safeDivide(addToCarts, views) * 100),
        cartToPurchaseRate: safeRound(safeDivide(unitsPurchased, addToCarts) * 100),
      }
    })

    const highViewLowCart = [...productFunnelRows]
      .filter((p) => p.views >= 10)
      .sort((a, b) => a.viewToCartRate - b.viewToCartRate)
      .slice(0, 20)

    const highCartLowPurchase = [...productFunnelRows]
      .filter((p) => p.addToCarts >= 5)
      .sort((a, b) => a.cartToPurchaseRate - b.cartToPurchaseRate)
      .slice(0, 20)

    res.json({
      success: true,
      period: { from: from.toISOString(), to: to.toISOString() },
      scoped: !scope.isGlobal,
      markets: scope.isGlobal ? [] : scope.countries,
      topSearches: topSearchesResult.rows.map((row: any) => ({
        query: row.search_query,
        count: safeNumber(row.search_count),
      })),
      zeroResultSearches: zeroResultResult.rows.map((row: any) => ({
        query: row.search_query,
        count: safeNumber(row.search_count),
      })),
      searchesByCountry: byCountryResult.rows.map((row: any) => ({
        country: row.country,
        count: safeNumber(row.search_count),
      })),
      searchTrend: trendResult.rows.map((row: any) => {
        const searchCount = safeNumber(row.search_count)
        const zeroResultCount = safeNumber(row.zero_result_count)
        return {
          date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
          searchCount,
          zeroResultCount,
          zeroResultRate: safeRound(safeDivide(zeroResultCount, searchCount) * 100),
        }
      }),
      productsViewedButUnavailable: unavailableViewedResult.rows.map((row: any) => ({
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        viewCount: safeNumber(row.view_count),
        currentStock: safeNumber(row.current_stock),
        isActive: Boolean(row.is_active),
      })),
      highViewLowCart,
      highCartLowPurchase,
      topProductByCountry: productsByCountryResult.rows.map((row: any) => ({
        country: row.country,
        productId: row.product_id,
        productName: row.product_name,
        viewCount: safeNumber(row.view_count),
      })),
      dataQuality: {
        note:
          'Search-to-product attribution is not shown -- events_core has no reliable link from a search query to the product(s) a shopper eventually viewed as a result, so that pairing is not computed rather than guessed.',
      },
    })
  } catch (error) {
    logger.error('Error fetching search-demand analytics:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch search-demand analytics' })
  }
}

// ============================================================
// Acquisition (first-party UTM attribution)
// ============================================================

/**
 * Split into two queries (funnel-stage counts, orders+revenue) rather than
 * one LEFT JOIN spanning sessions -> events -> orders -- a single query
 * risks double-counting an order's revenue if a session ever has more than
 * one payment_success event fan out against the same events join. Merged
 * back together in JS by the (source, medium, campaign) key.
 */
export const getAcquisition = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const parsed = parseDateRangeParams(req.query as Record<string, unknown>)
  if (!parsed.ok || !parsed.range) return sendDateRangeError(res, parsed.error || 'Invalid date range')

  try {
    const scope = applyCountryFilterOverride(resolveStaffScope(req), req.query.country)
    const { from, to } = parsed.range
    const sessionScope = sessionCountryScopeFilter(scope, 3)

    const [funnelResult, revenueResult] = await Promise.all([
      query(
        `WITH scoped_sessions AS (
           SELECT session_id, utm_source, utm_medium, utm_campaign
           FROM user_sessions
           WHERE start_time >= $1 AND start_time < $2
             ${sessionScope.clause}
         )
         SELECT
           COALESCE(ss.utm_source, 'direct') as source,
           COALESCE(ss.utm_medium, 'none') as medium,
           COALESCE(ss.utm_campaign, '') as campaign,
           COUNT(DISTINCT ss.session_id) as sessions,
           COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'product_view') as product_views,
           COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'add_to_cart') as add_to_carts,
           COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'checkout_start') as checkout_starts
         FROM scoped_sessions ss
         LEFT JOIN events_core e ON e.session_id = ss.session_id
           AND e.event_time >= $1 AND e.event_time < $2
           AND e.event_type IN ('product_view', 'add_to_cart', 'checkout_start')
         GROUP BY 1, 2, 3`,
        [from, to, ...sessionScope.params],
      ),
      query(
        `WITH scoped_sessions AS (
           SELECT session_id, utm_source, utm_medium, utm_campaign
           FROM user_sessions
           WHERE start_time >= $1 AND start_time < $2
             ${sessionScope.clause}
         )
         SELECT
           COALESCE(ss.utm_source, 'direct') as source,
           COALESCE(ss.utm_medium, 'none') as medium,
           COALESCE(ss.utm_campaign, '') as campaign,
           COUNT(DISTINCT o.id) as orders,
           COALESCE(SUM(o.grand_total), 0) as revenue
         FROM scoped_sessions ss
         JOIN events_core e ON e.session_id = ss.session_id
           AND e.event_type = 'payment_success'
           AND e.event_time >= $1 AND e.event_time < $2
         JOIN orders o ON o.id = e.order_id AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
         GROUP BY 1, 2, 3`,
        [from, to, ...sessionScope.params],
      ),
    ])

    const key = (row: any) => `${row.source} ${row.medium} ${row.campaign}`
    const revenueByKey = new Map(revenueResult.rows.map((row: any) => [key(row), row]))

    const channels = funnelResult.rows.map((row: any) => {
      const revRow = revenueByKey.get(key(row))
      const sessions = safeNumber(row.sessions)
      const orders = safeNumber(revRow?.orders)
      return {
        source: row.source,
        medium: row.medium,
        campaign: row.campaign || null,
        sessions,
        productViews: safeNumber(row.product_views),
        addToCarts: safeNumber(row.add_to_carts),
        checkoutStarts: safeNumber(row.checkout_starts),
        orders,
        revenue: safeNumber(revRow?.revenue),
        conversionRate: safeRound(safeDivide(orders, sessions) * 100),
      }
    })
    channels.sort((a, b) => b.revenue - a.revenue)

    res.json({
      success: true,
      period: { from: from.toISOString(), to: to.toISOString() },
      scoped: !scope.isGlobal,
      markets: scope.isGlobal ? [] : scope.countries,
      channels,
      totals: {
        sessions: channels.reduce((sum, c) => sum + c.sessions, 0),
        orders: channels.reduce((sum, c) => sum + c.orders, 0),
        revenue: safeRound(channels.reduce((sum, c) => sum + c.revenue, 0)),
      },
      dataQuality: {
        note:
          'Attribution is first-party and session-derived (UTM parameters captured at session start) -- no ad-spend/CPA/ROAS figures are shown because no spend data exists in this schema yet. This endpoint is structured so spend/CPA/CAC/ROAS can be added per channel later without changing the attribution model itself.',
      },
    })
  } catch (error) {
    logger.error('Error fetching acquisition analytics:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch acquisition analytics' })
  }
}

// ============================================================
// Operations (basic view -- feeds Command Center later)
// ============================================================

const STUCK_ORDER_THRESHOLD_DAYS = 3

/**
 * Alerts (unified analytics `alerts` table) have no country/market column
 * -- confirmed in docs/ADMIN-2A5-STAFF-ACCESS-INTEGRATION-REPORT.md. A
 * market-scoped caller gets an honest omission (dataQuality note) instead
 * of the global alert count relabeled as theirs, matching the Command
 * Center's existing Market Overview behavior for the same reason.
 */
export const getOperations = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const parsed = parseDateRangeParams(req.query as Record<string, unknown>)
  if (!parsed.ok || !parsed.range) return sendDateRangeError(res, parsed.error || 'Invalid date range')

  try {
    const scope = applyCountryFilterOverride(resolveStaffScope(req), req.query.country)
    const { from, to } = parsed.range
    const orderScope = orderCountryScopeFilter(scope, 3, "o.shipping_address->>'country'")
    const supplierScope = orderCountryScopeFilter(scope, 3, 's.country_code')
    // Point-in-time queries below take no date-range params at all, so
    // their scope placeholder starts at $1, not $3 -- a separate filter
    // instance keeps each query's own param list self-consistent instead
    // of string-rewriting the $3-indexed one above.
    const orderScopeFromParam1 = orderCountryScopeFilter(scope, 1, "o.shipping_address->>'country'")

    const queries: Record<string, Promise<any>> = {
      paymentFailures: query(
        `SELECT COUNT(*) as count, COALESCE(SUM(pay.amount), 0) as amount
         FROM payments pay
         JOIN orders o ON o.id = pay.order_id
         WHERE pay.status = 'failed' AND pay.created_at >= $1 AND pay.created_at < $2
           ${orderScope.clause}`,
        [from, to, ...orderScope.params],
      ),
      cancellations: query(
        `SELECT COUNT(*) as count
         FROM orders o
         WHERE o.order_status = 'cancelled' AND o.cancelled_at >= $1 AND o.cancelled_at < $2
           ${orderScope.clause}`,
        [from, to, ...orderScope.params],
      ),
      overdueShipments: query(
        `SELECT COUNT(*) as count
         FROM orders o
         WHERE o.order_status = 'shipped'
           AND o.estimated_delivery_date IS NOT NULL
           AND o.estimated_delivery_date < CURRENT_DATE
           AND o.actual_delivery_date IS NULL
           ${orderScopeFromParam1.clause}`,
        [...orderScopeFromParam1.params],
      ),
      stuckOrders: query(
        `SELECT COUNT(*) as count
         FROM orders o
         WHERE o.order_status IN ('pending', 'confirmed', 'processing')
           AND o.created_at < NOW() - INTERVAL '${STUCK_ORDER_THRESHOLD_DAYS} days'
           ${orderScopeFromParam1.clause}`,
        [...orderScopeFromParam1.params],
      ),
      supplierImportFailures: query(
        `SELECT COUNT(*) as count
         FROM supplier_import_batches b
         JOIN suppliers s ON s.id = b.supplier_id
         WHERE b.status = 'failed' AND b.created_at >= $1 AND b.created_at < $2
           ${supplierScope.clause}`,
        [from, to, ...supplierScope.params],
      ),
      lowStockHighDemand: query(
        `WITH demand AS (
           SELECT product_id, COUNT(*) as add_to_cart_count
           FROM events_core
           WHERE event_type = 'add_to_cart' AND event_time >= $1 AND event_time < $2
             AND product_id IS NOT NULL
           GROUP BY product_id
           HAVING COUNT(*) >= 5
         ),
         stock AS (
           SELECT product_id, COALESCE(SUM(available_stock), 0) as current_stock
           FROM inventory
           GROUP BY product_id
         )
         SELECT p.id as product_id, p.name as product_name, p.sku,
                d.add_to_cart_count, COALESCE(st.current_stock, 0) as current_stock
         FROM demand d
         JOIN products p ON p.id = d.product_id
         LEFT JOIN stock st ON st.product_id = p.id
         WHERE COALESCE(st.current_stock, 0) <= 5
         ORDER BY d.add_to_cart_count DESC
         LIMIT 20`,
        [from, to],
      ),
      refunds: getRefundCount({ from, to }),
    }

    const [
      paymentFailures,
      cancellations,
      overdueShipments,
      stuckOrders,
      supplierImportFailures,
      lowStockHighDemand,
      refunds,
    ] = await Promise.all([
      queries.paymentFailures,
      queries.cancellations,
      queries.overdueShipments,
      queries.stuckOrders,
      queries.supplierImportFailures,
      queries.lowStockHighDemand,
      queries.refunds,
    ])

    let activeAlerts: { critical: number; high: number; medium: number; low: number } | null = null
    let recentAlerts: any[] = []
    if (scope.isGlobal) {
      const hasAlertsTable = await tableExists('public.alerts')
      if (hasAlertsTable) {
        const [activeResult, recentResult] = await Promise.all([
          query(
            `SELECT
               COUNT(*) FILTER (WHERE severity = 'critical') as critical,
               COUNT(*) FILTER (WHERE severity = 'high') as high,
               COUNT(*) FILTER (WHERE severity = 'medium') as medium,
               COUNT(*) FILTER (WHERE severity = 'low') as low
             FROM alerts WHERE is_active = true`,
          ),
          query(
            `SELECT id, alert_type, severity, title, triggered_at
             FROM alerts
             ORDER BY triggered_at DESC
             LIMIT 20`,
          ),
        ])
        const row = activeResult.rows[0] || {}
        activeAlerts = {
          critical: safeNumber(row.critical),
          high: safeNumber(row.high),
          medium: safeNumber(row.medium),
          low: safeNumber(row.low),
        }
        recentAlerts = recentResult.rows.map((r: any) => ({
          id: r.id,
          type: r.alert_type,
          severity: r.severity,
          title: r.title,
          triggeredAt: r.triggered_at,
        }))
      }
    }

    res.json({
      success: true,
      period: { from: from.toISOString(), to: to.toISOString() },
      scoped: !scope.isGlobal,
      markets: scope.isGlobal ? [] : scope.countries,
      activeAlerts,
      recentAlerts,
      paymentFailures: {
        count: safeNumber(paymentFailures.rows[0]?.count),
        amount: safeNumber(paymentFailures.rows[0]?.amount),
      },
      cancellations: safeNumber(cancellations.rows[0]?.count),
      refunds: refunds.available ? refunds.refundCount : null,
      overdueShipments: safeNumber(overdueShipments.rows[0]?.count),
      stuckOrders: {
        count: safeNumber(stuckOrders.rows[0]?.count),
        thresholdDays: STUCK_ORDER_THRESHOLD_DAYS,
      },
      supplierImportFailures: safeNumber(supplierImportFailures.rows[0]?.count),
      lowStockHighDemand: lowStockHighDemand.rows.map((row: any) => ({
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        addToCartCount: safeNumber(row.add_to_cart_count),
        currentStock: safeNumber(row.current_stock),
      })),
      dataQuality: {
        alertsNote: scope.isGlobal
          ? null
          : 'Alerts are not shown for a market-scoped view -- the alerts table has no country/market dimension, so a scoped alert feed would either be empty or misleadingly global. See docs/ADMIN-2A5-STAFF-ACCESS-INTEGRATION-REPORT.md.',
        shippingNote:
          'overdueShipments approximates "shipping failures" as shipped orders past their estimated_delivery_date with no recorded actual_delivery_date -- there is no explicit shipping-failure status in this schema.',
      },
    })
  } catch (error) {
    logger.error('Error fetching operations analytics:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch operations analytics' })
  }
}

// ============================================================
// Country Performance (explicitly a preview, NOT the future Markets
// workspace -- Global Commerce's countries/markets tables don't exist
// yet. Every dimension here is keyed by user_sessions.country_code, not
// orders.shipping_address, precisely to sidestep the shipping-address
// country-format ambiguity documented in
// docs/ADMIN-2A5-STAFF-ACCESS-INTEGRATION-REPORT.md -- session geo-IP
// country is a single reliable ISO source every metric below can share a
// join key with. See dataQuality.note in the response for the resulting
// caveat (session country can differ from shipping country in edge
// cases like gifting or a VPN).
// ============================================================

export const getCountryPerformance = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const parsed = parseDateRangeParams(req.query as Record<string, unknown>)
  if (!parsed.ok || !parsed.range) return sendDateRangeError(res, parsed.error || 'Invalid date range')

  try {
    const scope = applyCountryFilterOverride(resolveStaffScope(req), req.query.country)
    const { from, to } = parsed.range
    const sessionScope = sessionCountryScopeFilter(scope, 3)

    const [visitorsResult, ordersResult, topProductResult, topSearchResult, topChannelResult] = await Promise.all([
      query(
        `SELECT country_code as country, COUNT(DISTINCT session_id) as visitors
         FROM user_sessions
         WHERE start_time >= $1 AND start_time < $2
           AND country_code IS NOT NULL
           ${sessionScope.clause}
         GROUP BY country_code`,
        [from, to, ...sessionScope.params],
      ),
      query(
        `SELECT s.country_code as country, COUNT(DISTINCT o.id) as orders, COALESCE(SUM(o.grand_total), 0) as revenue
         FROM events_core e
         JOIN user_sessions s ON s.session_id = e.session_id
         JOIN orders o ON o.id = e.order_id AND o.order_status IN ${COMPLETED_ORDER_STATUSES}
         WHERE e.event_type = 'payment_success'
           AND e.event_time >= $1 AND e.event_time < $2
           AND s.country_code IS NOT NULL
           ${sessionScope.clause}
         GROUP BY s.country_code`,
        [from, to, ...sessionScope.params],
      ),
      query(
        `WITH product_country_views AS (
           SELECT e.product_id, p.name as product_name, s.country_code as country, COUNT(*) as view_count
           FROM events_core e
           JOIN user_sessions s ON s.session_id = e.session_id
           JOIN products p ON p.id = e.product_id
           WHERE e.event_time >= $1 AND e.event_time < $2
             AND e.event_type = 'product_view'
             AND s.country_code IS NOT NULL
             ${sessionScope.clause}
           GROUP BY e.product_id, p.name, s.country_code
         )
         SELECT DISTINCT ON (country) country, product_id, product_name, view_count
         FROM product_country_views
         ORDER BY country, view_count DESC`,
        [from, to, ...sessionScope.params],
      ),
      query(
        `WITH search_by_country AS (
           SELECT s.country_code as country, e.payload->>'searchQuery' as search_query, COUNT(*) as search_count
           FROM events_core e
           JOIN user_sessions s ON s.session_id = e.session_id
           WHERE e.event_time >= $1 AND e.event_time < $2
             AND e.event_type = 'search'
             AND e.payload->>'searchQuery' IS NOT NULL
             AND s.country_code IS NOT NULL
             ${sessionScope.clause}
           GROUP BY s.country_code, e.payload->>'searchQuery'
         )
         SELECT DISTINCT ON (country) country, search_query, search_count
         FROM search_by_country
         ORDER BY country, search_count DESC`,
        [from, to, ...sessionScope.params],
      ),
      query(
        `WITH channel_by_country AS (
           SELECT country_code as country, COALESCE(utm_source, 'direct') as source, COUNT(DISTINCT session_id) as session_count
           FROM user_sessions
           WHERE start_time >= $1 AND start_time < $2
             AND country_code IS NOT NULL
             ${sessionScope.clause}
           GROUP BY country_code, COALESCE(utm_source, 'direct')
         )
         SELECT DISTINCT ON (country) country, source, session_count
         FROM channel_by_country
         ORDER BY country, session_count DESC`,
        [from, to, ...sessionScope.params],
      ),
    ])

    const ordersByCountry = new Map(ordersResult.rows.map((row: any) => [row.country, row]))
    const topProductByCountry = new Map(topProductResult.rows.map((row: any) => [row.country, row]))
    const topSearchByCountry = new Map(topSearchResult.rows.map((row: any) => [row.country, row]))
    const topChannelByCountry = new Map(topChannelResult.rows.map((row: any) => [row.country, row]))

    const countries = visitorsResult.rows.map((row: any) => {
      const country = row.country
      const visitors = safeNumber(row.visitors)
      const orderRow: any = ordersByCountry.get(country)
      const productRow: any = topProductByCountry.get(country)
      const searchRow: any = topSearchByCountry.get(country)
      const channelRow: any = topChannelByCountry.get(country)
      const orders = safeNumber(orderRow?.orders)

      return {
        country,
        visitors,
        orders,
        revenue: safeNumber(orderRow?.revenue),
        conversionRate: safeRound(safeDivide(orders, visitors) * 100),
        topProduct: productRow ? { productId: productRow.product_id, productName: productRow.product_name } : null,
        topSearch: searchRow ? { query: searchRow.search_query, count: safeNumber(searchRow.search_count) } : null,
        topChannel: channelRow ? channelRow.source : null,
      }
    })
    countries.sort((a, b) => b.revenue - a.revenue)

    res.json({
      success: true,
      label: 'Country Performance',
      period: { from: from.toISOString(), to: to.toISOString() },
      scoped: !scope.isGlobal,
      markets: scope.isGlobal ? [] : scope.countries,
      countries,
      dataQuality: {
        note:
          'This is a country-based preview, not the future Markets workspace -- real market grouping (regions spanning multiple countries, currency zones) requires the Global Commerce countries/markets schema, which does not exist yet. Every figure here is keyed by the visiting session\'s geo-IP country (user_sessions.country_code), not the order\'s shipping address, so revenue can differ slightly from Sales > Revenue by Country in edge cases (gifting, VPN use).',
      },
    })
  } catch (error) {
    logger.error('Error fetching country performance:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch country performance' })
  }
}
