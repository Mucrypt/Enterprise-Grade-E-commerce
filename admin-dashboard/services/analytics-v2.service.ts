// ============================================
// Analytics 2.0 (ADMIN-2B) service
// ============================================
// Thin typed wrapper around the GET /analytics/{overview,sales,funnel,
// products,search-demand,acquisition,operations,country-performance}
// endpoints added in tech-tools-api/src/api/v1/analytics/analytics-v2.controller.ts.
// Deliberately separate from trending.service.ts (the pre-existing global
// analytics endpoints) -- see that file's own header comment; this phase
// does not touch it.

import { apiClient } from '@/lib/api-client'

export type ComparisonMode = 'previous_period' | 'previous_year' | 'none'

export interface AnalyticsDateFilters {
  from?: string
  to?: string
  comparisonMode?: ComparisonMode
  compareFrom?: string
  compareTo?: string
  country?: string
}

export interface PeriodComparison {
  value: number
  previousValue: number | null
  absoluteChange: number | null
  percentChange: number | null
}

export interface AnalyticsPeriod {
  from: string
  to: string
}

interface ScopedResponse {
  scoped: boolean
  markets: string[]
}

// ---------- Currency safety (Production Review Round 1 §5) ----------
// orders.currency defaults to 'EUR' today, but the column exists precisely
// so Global Commerce can introduce other currencies later. No endpoint here
// ever sums or converts across currencies -- a period spanning more than
// one currency comes back as an honest "mixed" shape instead of a fake
// blended total. See tech-tools-api's analytics-v2.controller.ts §5 and
// docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md's Production Review
// Round 1 section.

export interface CurrencyBreakdownRow {
  currency: string
  orderCount: number
  revenue: number
}

/** Whole-endpoint circuit-breaker shape used by Overview/Sales/Acquisition -- these are single-aggregate-shaped responses where the primary purpose IS the revenue figure, so a mixed period replaces the entire payload rather than hiding individual fields. */
interface MixedCurrencyPayload extends ScopedResponse {
  success: true
  mixedCurrencies: true
  currency: null
  currencyBreakdown: CurrencyBreakdownRow[]
  period: AnalyticsPeriod
  message: string
}

// ---------- Overview ----------

export interface OverviewMetricsPayload extends ScopedResponse {
  success: true
  mixedCurrencies: false
  currency: string | null
  period: AnalyticsPeriod
  comparisonMode: ComparisonMode
  compare: AnalyticsPeriod | null
  metrics: {
    revenue: PeriodComparison
    orders: PeriodComparison
    aov: PeriodComparison
    visitors: PeriodComparison
    conversionRate: PeriodComparison
    checkoutAbandonmentRate: PeriodComparison
    refundRate: PeriodComparison
    returningCustomerRate: PeriodComparison
    grossMargin: PeriodComparison
  }
  dataQuality: {
    refundRateAvailable: boolean
    marginCoveragePercent: number
    checkoutFunnelNote: string
  }
}

export type OverviewResponse = OverviewMetricsPayload | MixedCurrencyPayload

async function getOverview(filters: AnalyticsDateFilters = {}): Promise<OverviewResponse> {
  return apiClient.get<OverviewResponse>('/analytics/overview', { params: filters })
}

// ---------- Sales ----------

export interface SalesDataPayload extends ScopedResponse {
  success: true
  mixedCurrencies: false
  currency: string | null
  period: AnalyticsPeriod
  filters: { productId: string | null; categoryId: string | null }
  trend: { date: string; revenue: number; orders: number; aov: number }[]
  unitsSold: number
  revenueByProduct: { productId: string; productName: string; sku: string; unitsSold: number; revenue: number }[]
  revenueByCategory: { categoryId: string | null; categoryName: string; revenue: number }[]
  revenueByCountry: { country: string; orders: number; revenue: number }[]
  orderStatusDistribution: { status: string; count: number }[]
  paymentStatusDistribution: { status: string; count: number }[]
  cancellationRate: number
  refundRate: number | null
  dataQuality: { refundRateAvailable: boolean }
}

export type SalesResponse = SalesDataPayload | MixedCurrencyPayload

async function getSales(
  filters: AnalyticsDateFilters & { productId?: string; categoryId?: string } = {},
): Promise<SalesResponse> {
  return apiClient.get<SalesResponse>('/analytics/sales', { params: filters })
}

// ---------- Funnel ----------

export interface FunnelStage {
  key: string
  label: string
  count: number
  stageConversionPercent: number
  dropOffCount: number
  dropOffPercent: number
  dataQuality: 'complete' | 'partial'
}

export interface FunnelResponse extends ScopedResponse {
  success: true
  period: AnalyticsPeriod
  filters: { device: string | null; source: string | null; campaign: string | null; productId: string | null; categoryId: string | null }
  stages: FunnelStage[]
  overallConversionPercent: number
  dataQuality: { note: string; partialStages: string[] }
}

async function getFunnel(
  filters: AnalyticsDateFilters & {
    device?: string
    source?: string
    campaign?: string
    productId?: string
    categoryId?: string
  } = {},
): Promise<FunnelResponse> {
  return apiClient.get<FunnelResponse>('/analytics/funnel', { params: filters })
}

// ---------- Product Intelligence ----------

export type ProductSort =
  | 'most_viewed'
  | 'most_revenue'
  | 'best_conversion'
  | 'worst_conversion'
  | 'highest_demand'
  | 'low_stock'
  | 'high_demand_zero_stock'

export interface ProductIntelligenceRow {
  productId: string
  productName: string
  sku: string
  views: number
  uniqueVisitors: number
  addToCarts: number
  purchases: number
  /** null when the period's orders span more than one currency -- see mixedCurrencies below. Views/carts/stock stay real regardless. */
  revenue: number | null
  conversionRate: number
  cartToPurchaseRate: number
  currentStock: number | null
  margin: { perUnit: number; available: true } | null
}

export interface ProductIntelligenceResponse extends ScopedResponse {
  success: true
  mixedCurrencies: boolean
  currency: string | null
  period: AnalyticsPeriod
  sort: ProductSort
  products: ProductIntelligenceRow[]
  dataQuality: { checkoutStartsNote: string; marginNote: string; stockNote: string; currencyNote: string | null }
}

async function getProductIntelligence(
  filters: AnalyticsDateFilters & { categoryId?: string; sort?: ProductSort; limit?: number } = {},
): Promise<ProductIntelligenceResponse> {
  return apiClient.get<ProductIntelligenceResponse>('/analytics/products', { params: filters })
}

// ---------- Search & Demand ----------

export interface SearchDemandResponse extends ScopedResponse {
  success: true
  period: AnalyticsPeriod
  topSearches: { query: string; count: number }[]
  zeroResultSearches: { query: string; count: number }[]
  searchesByCountry: { country: string; count: number }[]
  searchTrend: { date: string; searchCount: number; zeroResultCount: number; zeroResultRate: number }[]
  productsViewedButUnavailable: { productId: string; productName: string; sku: string; viewCount: number; currentStock: number; isActive: boolean }[]
  highViewLowCart: { productId: string; productName: string; sku: string; views: number; addToCarts: number; purchases: number; viewToCartRate: number; cartToPurchaseRate: number }[]
  highCartLowPurchase: { productId: string; productName: string; sku: string; views: number; addToCarts: number; purchases: number; viewToCartRate: number; cartToPurchaseRate: number }[]
  topProductByCountry: { country: string; productId: string; productName: string; viewCount: number }[]
  dataQuality: { note: string }
}

async function getSearchDemand(filters: AnalyticsDateFilters = {}): Promise<SearchDemandResponse> {
  return apiClient.get<SearchDemandResponse>('/analytics/search-demand', { params: filters })
}

// ---------- Acquisition ----------

export interface AcquisitionChannel {
  source: string
  medium: string
  campaign: string | null
  sessions: number
  productViews: number
  addToCarts: number
  checkoutStarts: number
  orders: number
  revenue: number
  conversionRate: number
}

export interface AcquisitionDataPayload extends ScopedResponse {
  success: true
  mixedCurrencies: false
  currency: string | null
  period: AnalyticsPeriod
  channels: AcquisitionChannel[]
  totals: { sessions: number; orders: number; revenue: number }
  dataQuality: { note: string }
}

export type AcquisitionResponse = AcquisitionDataPayload | MixedCurrencyPayload

async function getAcquisition(filters: AnalyticsDateFilters = {}): Promise<AcquisitionResponse> {
  return apiClient.get<AcquisitionResponse>('/analytics/acquisition', { params: filters })
}

// ---------- Operations ----------

export interface OperationsResponse extends ScopedResponse {
  success: true
  period: AnalyticsPeriod
  activeAlerts: { critical: number; high: number; medium: number; low: number } | null
  recentAlerts: { id: string; type: string; severity: string; title: string; triggeredAt: string }[]
  paymentFailures: { count: number; amount: number | null; currency: string | null; mixedCurrencies: boolean }
  cancellations: number
  refunds: number | null
  overdueShipments: number
  stuckOrders: { count: number; thresholdDays: number }
  supplierImportFailures: number
  lowStockHighDemand: { productId: string; productName: string; sku: string; addToCartCount: number; currentStock: number }[]
  dataQuality: { alertsNote: string | null; shippingNote: string; currencyNote: string | null }
}

async function getOperations(filters: AnalyticsDateFilters = {}): Promise<OperationsResponse> {
  return apiClient.get<OperationsResponse>('/analytics/operations', { params: filters })
}

// ---------- Country Performance ----------

export interface CountryPerformanceRow {
  country: string
  visitors: number
  orders: number
  /** null when this country's orders span more than one currency this period -- see currencyBreakdown. */
  revenue: number | null
  currency: string | null
  mixedCurrencies: boolean
  currencyBreakdown?: { currency: string; orders: number; revenue: number }[]
  conversionRate: number
  topProduct: { productId: string; productName: string } | null
  topSearch: { query: string; count: number } | null
  topChannel: string | null
}

export interface CountryPerformanceResponse extends ScopedResponse {
  success: true
  label: 'Country Performance'
  period: AnalyticsPeriod
  countries: CountryPerformanceRow[]
  dataQuality: { note: string }
}

async function getCountryPerformance(filters: AnalyticsDateFilters = {}): Promise<CountryPerformanceResponse> {
  return apiClient.get<CountryPerformanceResponse>('/analytics/country-performance', { params: filters })
}

export const analyticsV2Service = {
  getOverview,
  getSales,
  getFunnel,
  getProductIntelligence,
  getSearchDemand,
  getAcquisition,
  getOperations,
  getCountryPerformance,
}

export default analyticsV2Service
