import { apiClient } from '@/lib/api-client'
import type { ProductCollection } from './collection.service'
import type { Brand } from './brand.service'
import type {
  RevenueTrendPoint,
  ConversionFunnelStep,
  TopProductMetric,
  CheckoutMetrics,
} from '@/types/events'

// ============================================
// Trending Service Types
// ============================================

export interface TrendingStats {
  totalCollections: number
  activeCollections: number
  featuredCollections: number
  totalBrands: number
  featuredBrands: number
  // Real order count for the period -- there is no page/collection view
  // tracking in this codebase today, so this is deliberately labeled
  // "orders," not "views."
  totalOrders: number
  totalSales: number
  conversionRate: number
}

export interface TrendingCollection extends ProductCollection {
  is_featured: boolean
  // Real manual sort order (product_collections.position), not a display
  // index. Absent means unranked.
  trending_rank?: number | null
}

export interface BrandRealStats {
  productCount: number
  unitsSold: number
  revenueTotal: number
  newProductsCount: number
}

export interface TrendingBrand extends Brand {
  is_featured?: boolean
  // Real manual sort order (brands.trending_position). Absent means
  // unranked. There is deliberately no follower_count field -- no real
  // follow/subscribe feature exists yet, and a fabricated number is worse
  // than an absent one.
  trending_rank?: number | null
  product_count?: number
  units_sold?: number
  total_sales?: number
  products?: any[]
}

export interface UpdateTrendingSettingsDTO {
  collectionId?: string
  brandId?: string
  isFeatured?: boolean
  trendingRank?: number
  displayPriority?: number
}

export interface AnalyticsChartPoint {
  date: string
  orders: number
  revenue: number
}

export interface AnalyticsData {
  period: string
  data: AnalyticsChartPoint[]
  summary: {
    totalOrders: number
    totalRevenue: number
  }
}

// ============================================
// Trending Service - REAL ANALYTICS
// ============================================

export const trendingService = {
  /**
   * Get revenue trend (replaces mock data with real API)
   */
  async getRevenueTrend(days: number = 7) {
    try {
      const response = (await apiClient.get('/analytics/revenue-trend', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        data: response?.data || [],
        summary: response?.summary || {
          totalRevenue: 0,
          totalOrders: 0,
          averageRevenue: 0,
        },
      }
    } catch (error) {
      console.error('Error fetching revenue trend:', error)
      return {
        period: `${days}_days`,
        data: [],
        summary: { totalRevenue: 0, totalOrders: 0, averageRevenue: 0 },
      }
    }
  },

  /**
   * Get conversion funnel (replaces mock data with real API)
   */
  async getConversionFunnel(days: number = 7) {
    try {
      const response = (await apiClient.get('/analytics/conversion-funnel', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        funnel: response?.funnel || [],
        summary: response?.summary || {
          topOfFunnelUsers: 0,
          paymentSuccessUsers: 0,
          overallConversionRate: 0,
        },
      }
    } catch (error) {
      console.error('Error fetching conversion funnel:', error)
      return {
        period: `${days}_days`,
        funnel: [],
        summary: {
          topOfFunnelUsers: 0,
          paymentSuccessUsers: 0,
          overallConversionRate: 0,
        },
      }
    }
  },

  /**
   * Get top products (replaces mock data with real API)
   */
  async getTopProducts(days: number = 7, limit: number = 10) {
    try {
      const response = (await apiClient.get('/analytics/top-products', {
        params: { days, limit },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        topProducts: response?.topProducts || [],
        summary: response?.summary || {
          totalViews: 0,
          totalPurchases: 0,
          totalRevenue: 0,
        },
      }
    } catch (error) {
      console.error('Error fetching top products:', error)
      return {
        period: `${days}_days`,
        topProducts: [],
        summary: { totalViews: 0, totalPurchases: 0, totalRevenue: 0 },
      }
    }
  },

  /**
   * Get search metrics (zero-result searches)
   */
  async getSearchMetrics(days: number = 7) {
    try {
      const response = (await apiClient.get('/analytics/search-metrics', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        totalSearches: response?.totalSearches || 0,
        zeroResultSearches: response?.zeroResultSearches || 0,
        zeroResultRate: response?.zeroResultRate || 0,
        uniqueSearchUsers: response?.uniqueSearchUsers || 0,
      }
    } catch (error) {
      console.error('Error fetching search metrics:', error)
      return {
        period: `${days}_days`,
        totalSearches: 0,
        zeroResultSearches: 0,
        zeroResultRate: 0,
        uniqueSearchUsers: 0,
      }
    }
  },

  /**
   * Get refund rate metrics
   */
  async getRefundRate(days: number = 30) {
    try {
      const response = (await apiClient.get('/analytics/refund-rate', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        totalOrders: response?.totalOrders || 0,
        totalRefunds: response?.totalRefunds || 0,
        refundRate: response?.refundRate || 0,
        totalRefundAmount: response?.totalRefundAmount || 0,
        avgRefundAmount: response?.avgRefundAmount || 0,
      }
    } catch (error) {
      console.error('Error fetching refund rate:', error)
      return {
        period: `${days}_days`,
        totalOrders: 0,
        totalRefunds: 0,
        refundRate: 0,
        totalRefundAmount: 0,
        avgRefundAmount: 0,
      }
    }
  },

  /**
   * Get return rate metrics
   */
  async getReturnRate(days: number = 30) {
    try {
      const response = (await apiClient.get('/analytics/return-rate', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        totalShipped: response?.totalShipped || 0,
        totalReturns: response?.totalReturns || 0,
        returnRate: response?.returnRate || 0,
      }
    } catch (error) {
      console.error('Error fetching return rate:', error)
      return {
        period: `${days}_days`,
        totalShipped: 0,
        totalReturns: 0,
        returnRate: 0,
      }
    }
  },

  /**
   * Get checkout abandonment metrics
   */
  async getCheckoutAbandonment(days: number = 7) {
    try {
      const response = (await apiClient.get('/analytics/checkout-abandonment', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        checkoutStartCount: response?.checkoutStartCount || 0,
        paymentSuccessCount: response?.paymentSuccessCount || 0,
        abandonmentCount: response?.abandonmentCount || 0,
        abandonmentRate: response?.abandonmentRate || 0,
        estimatedAbandonedValue: response?.estimatedAbandonedValue || 0,
      }
    } catch (error) {
      console.error('Error fetching checkout abandonment:', error)
      return {
        period: `${days}_days`,
        checkoutStartCount: 0,
        paymentSuccessCount: 0,
        abandonmentCount: 0,
        abandonmentRate: 0,
        estimatedAbandonedValue: 0,
      }
    }
  },

  /**
   * Get trending stats for dashboard (now using real API data)
   */
  async getStats(): Promise<TrendingStats> {
    try {
      const [collectionsRes, brandsRes, revenueTrendRes, funnelRes] =
        await Promise.all([
          apiClient.get('/collections/products', {
            params: { limit: 100 },
          }) as Promise<any>,
          apiClient.get('/brands', { params: { limit: 100 } }) as Promise<any>,
          this.getRevenueTrend(7),
          this.getConversionFunnel(7),
        ])

      const collections =
        collectionsRes?.data?.collections || collectionsRes?.collections || []
      const brands = brandsRes?.data?.brands || brandsRes?.brands || []

      return {
        totalCollections: collections.length,
        activeCollections: collections.filter((c: any) => c.is_active).length,
        featuredCollections: collections.filter((c: any) => c.is_featured)
          .length,
        totalBrands: brands.length,
        featuredBrands: brands.filter((b: any) => b.is_featured).length,
        totalOrders: revenueTrendRes?.summary?.totalOrders || 0,
        totalSales: revenueTrendRes?.summary?.totalRevenue || 0,
        conversionRate: funnelRes?.summary?.overallConversionRate || 0,
      }
    } catch (error) {
      console.error('Error fetching trending stats:', error)
      return {
        totalCollections: 0,
        activeCollections: 0,
        featuredCollections: 0,
        totalBrands: 0,
        featuredBrands: 0,
        totalOrders: 0,
        totalSales: 0,
        conversionRate: 0,
      }
    }
  },

  /**
   * Get collections for the Trending admin table -- every active
   * collection (not just currently-featured ones), so the admin can toggle
   * any of them featured/ranked. is_featured and position are real,
   * persisted columns (product_collections) -- no fabricated engagement
   * metrics are attached here (views/clicks/conversion-rate for a
   * collection have no real tracking backing them yet -- see Trending
   * doc). Sorted the same way the backend list endpoint sorts them
   * (position ASC, then newest).
   */
  async getFeaturedCollections(): Promise<TrendingCollection[]> {
    try {
      const response = (await apiClient.get('/collections/products', {
        params: { limit: 50, isActive: true },
      })) as any
      const collections =
        response?.data?.collections || response?.collections || []
      return collections.map((c: any) => ({
        ...c,
        is_featured: Boolean(c.is_featured),
        trending_rank: c.position ?? null,
      }))
    } catch (error) {
      console.error('Error fetching featured collections:', error)
      return []
    }
  },

  /**
   * Get brands for the Trending admin table, merged with real per-brand
   * numbers (units sold + revenue from paid orders, real product count --
   * see GET /brands/stats) instead of the Math.random() placeholders this
   * used to ship. is_featured/trending_position are real, persisted
   * columns (see 044_brand_trending_fields.sql) -- there is deliberately
   * no follower count, since no real follow feature exists.
   */
  async getFeaturedBrands(): Promise<TrendingBrand[]> {
    try {
      const response = (await apiClient.get('/brands', {
        params: { limit: 50, isActive: true },
      })) as any
      const brands = response?.data?.brands || response?.brands || []
      const ids = brands.map((b: any) => b.id)
      const stats = ids.length > 0 ? await this.getBrandStats(ids) : {}

      return brands.map((b: any) => ({
        ...b,
        is_featured: Boolean(b.is_featured),
        trending_rank: b.trending_position ?? null,
        product_count: stats[b.id]?.productCount ?? 0,
        units_sold: stats[b.id]?.unitsSold ?? 0,
        total_sales: stats[b.id]?.revenueTotal ?? 0,
      }))
    } catch (error) {
      console.error('Error fetching featured brands:', error)
      return []
    }
  },

  /**
   * Real per-brand engagement numbers (units sold, revenue, product
   * count) -- see brand.controller.ts's getBrandStats for the underlying
   * query. Never fabricated; a brand with no real orders/products yet
   * simply comes back at zero.
   */
  async getBrandStats(ids: string[]): Promise<Record<string, BrandRealStats>> {
    try {
      const response = (await apiClient.get('/brands/stats', {
        params: { ids: ids.join(',') },
      })) as any
      return response?.data?.stats || response?.stats || {}
    } catch (error) {
      console.error('Error fetching brand stats:', error)
      return {}
    }
  },

  /**
   * Toggle collection featured status
   */
  async toggleCollectionFeatured(collectionId: string, isFeatured: boolean) {
    try {
      const response = await apiClient.put(
        `/collections/products/${collectionId}`,
        {
          is_featured: isFeatured,
        },
      )
      return response
    } catch (error) {
      console.error('Error toggling collection featured:', error)
      throw error
    }
  },

  /**
   * Toggle brand featured status. updateBrand() reads camelCase fields
   * only (matching logoUrl/websiteUrl, its own existing convention) --
   * unlike the collections endpoint below, it does not also accept
   * snake_case, so this must send isFeatured, not is_featured.
   */
  async toggleBrandFeatured(brandId: string, isFeatured: boolean) {
    try {
      const response = await apiClient.put(`/brands/${brandId}`, {
        isFeatured,
      })
      return response
    } catch (error) {
      console.error('Error toggling brand featured:', error)
      throw error
    }
  },

  /**
   * Update collection trending rank
   */
  async updateCollectionRank(collectionId: string, rank: number) {
    try {
      const response = await apiClient.put(
        `/collections/products/${collectionId}`,
        {
          position: rank,
        },
      )
      return response
    } catch (error) {
      console.error('Error updating collection rank:', error)
      throw error
    }
  },

  /**
   * Update brand trending rank (brands.trending_position -- see
   * 044_brand_trending_fields.sql).
   */
  async updateBrandRank(brandId: string, rank: number) {
    try {
      const response = await apiClient.put(`/brands/${brandId}`, {
        trendingPosition: rank,
      })
      return response
    } catch (error) {
      console.error('Error updating brand rank:', error)
      throw error
    }
  },

  /**
   * "Promote" bridge into the real Promotions/social-publishing system
   * (PROMOTION-OPS-1) -- creates a DRAFT campaign pre-loaded with this
   * collection's real product list, then hands off to the campaign editor
   * for channel selection/scheduling. This is deliberately a thin bridge
   * into the existing composer rather than a second, parallel "advertise
   * from Trending" flow -- Promotions already owns organic social
   * publishing; Trending shouldn't reimplement it.
   */
  async promoteCollection(collection: { id: string; name: string }): Promise<string> {
    const { promotionService } = await import('./promotion.service')
    const { collectionService } = await import('./collection.service')
    const detail = (await collectionService.getProductCollection(collection.id)) as any
    const productIds: string[] = (detail?.data?.products || detail?.products || [])
      .map((p: any) => p.id)
      .filter(Boolean)
      .slice(0, 30)

    const created = await promotionService.createCampaign({
      name: `Promote: ${collection.name}`,
      objective: 'SALES',
      masterMessage: `Check out our ${collection.name} collection.`,
    })
    if (productIds.length > 0) {
      await promotionService.updateCampaign(created.campaign.id, {
        products: productIds.map((productId) => ({ productId })),
      })
    }
    return created.campaign.id
  },

  /**
   * Same bridge for a brand -- pulls that brand's real, currently active
   * products (the same catalog filter the storefront's brand page uses).
   */
  async promoteBrand(brand: { id: string; name: string }): Promise<string> {
    const { promotionService } = await import('./promotion.service')
    const { productService } = await import('./product.service')
    const productsRes = await productService.getProducts({ brandId: brand.id, limit: 30 })
    const productIds: string[] = (productsRes?.data?.items || [])
      .map((p) => p.id)
      .filter((id): id is string => Boolean(id))

    const created = await promotionService.createCampaign({
      name: `Promote: ${brand.name}`,
      objective: 'SALES',
      masterMessage: `Shop ${brand.name} at TechTools.`,
    })
    if (productIds.length > 0) {
      await promotionService.updateCampaign(created.campaign.id, {
        products: productIds.map((productId) => ({ productId })),
      })
    }
    return created.campaign.id
  },

  /**
   * Get comprehensive trending analytics (now using real data from API)
   */
  async getAnalytics(
    period: 'day' | 'week' | 'month' = 'week',
  ): Promise<AnalyticsData> {
    try {
      const days = period === 'day' ? 1 : period === 'week' ? 7 : 30
      const revenueTrend = await this.getRevenueTrend(days)

      // Real orders/revenue per day, from the same revenue-trend endpoint
      // the rest of Analytics uses -- no page/collection view tracking
      // exists yet, so this no longer fabricates a "views" or "clicks"
      // series.
      const data = revenueTrend.data.map((point: RevenueTrendPoint) => ({
        date: point.date,
        orders: point.orderCount,
        revenue: point.revenue,
      }))

      return {
        period,
        data,
        summary: {
          totalOrders: data.reduce((acc: number, d: AnalyticsChartPoint) => acc + d.orders, 0),
          totalRevenue: data.reduce((acc: number, d: AnalyticsChartPoint) => acc + d.revenue, 0),
        },
      }
    } catch (error) {
      console.error('Error fetching trending analytics:', error)
      return {
        period,
        data: [],
        summary: {
          totalOrders: 0,
          totalRevenue: 0,
        },
      }
    }
  },

  /**
   * Get live/active visitors (last N minutes)
   */
  async getLiveVisitors(minutes: number = 5) {
    try {
      const response = (await apiClient.get('/analytics/visitors/live', {
        params: { minutes },
      })) as any

      return {
        windowMinutes: response?.windowMinutes || minutes,
        activeCount: response?.activeCount || 0,
        visitors: response?.visitors || [],
      }
    } catch (error) {
      console.error('Error fetching live visitors:', error)
      return { windowMinutes: minutes, activeCount: 0, visitors: [] }
    }
  },

  /**
   * Get visitor breakdown by country
   */
  async getVisitorsByCountry(days: number = 7) {
    try {
      const response = (await apiClient.get('/analytics/visitors/by-country', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        data: response?.data || [],
        summary: response?.summary || { totalSessions: 0, countryCount: 0 },
      }
    } catch (error) {
      console.error('Error fetching visitors by country:', error)
      return {
        period: `${days}_days`,
        data: [],
        summary: { totalSessions: 0, countryCount: 0 },
      }
    }
  },

  /**
   * Get revenue/session breakdown by UTM channel
   */
  async getChannelBreakdown(days: number = 7) {
    try {
      const response = (await apiClient.get('/analytics/channels', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        data: response?.data || [],
        summary: response?.summary || { totalRevenue: 0, totalOrders: 0 },
      }
    } catch (error) {
      console.error('Error fetching channel breakdown:', error)
      return {
        period: `${days}_days`,
        data: [],
        summary: { totalRevenue: 0, totalOrders: 0 },
      }
    }
  },

  /**
   * Market-scoped overview for the Command Center's Market Overview panel
   * (analytics.view_market). Server-side scoped -- see GET
   * /analytics/market-overview / getMarketOverview in
   * analytics.controller.ts. Never call this to derive global numbers;
   * use the endpoints above for that.
   */
  async getMarketOverview(days: number = 7) {
    try {
      const response = (await apiClient.get('/analytics/market-overview', {
        params: { days },
      })) as any

      return {
        period: response?.period || `${days}_days`,
        scoped: Boolean(response?.scoped),
        markets: response?.markets || [],
        visitors: response?.visitors || { activeSessionCount: 0, uniqueVisitors: 0 },
        orders: response?.orders || { orderCount: 0, revenue: 0 },
        suppliers: response?.suppliers || { supplierCount: 0 },
        message: response?.message as string | undefined,
      }
    } catch (error) {
      console.error('Error fetching market overview:', error)
      return {
        period: `${days}_days`,
        scoped: true,
        markets: [] as string[],
        visitors: { activeSessionCount: 0, uniqueVisitors: 0 },
        orders: { orderCount: 0, revenue: 0 },
        suppliers: { supplierCount: 0 },
        message: undefined as string | undefined,
      }
    }
  },
}

export default trendingService
