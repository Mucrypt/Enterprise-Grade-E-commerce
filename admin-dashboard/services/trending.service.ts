import { apiClient } from '@/lib/api-client'
import type { ProductCollection } from './collection.service'
import type { Brand } from './brand.service'

// ============================================
// Trending Service Types
// ============================================

export interface TrendingStats {
  totalCollections: number
  activeCollections: number
  featuredCollections: number
  totalBrands: number
  featuredBrands: number
  totalViews: number
  totalSales: number
  conversionRate: number
}

export interface TrendingCollection extends ProductCollection {
  is_featured: boolean
  trending_rank?: number
  views_count?: number
  click_count?: number
  conversion_rate?: number
}

export interface TrendingBrand extends Brand {
  is_featured?: boolean
  follower_count?: number
  total_sales?: number
  trending_rank?: number
  products?: any[]
}

export interface UpdateTrendingSettingsDTO {
  collectionId?: string
  brandId?: string
  isFeatured?: boolean
  trendingRank?: number
  displayPriority?: number
}

// ============================================
// Trending Service
// ============================================

export const trendingService = {
  /**
   * Get trending stats for dashboard
   */
  async getStats(): Promise<TrendingStats> {
    try {
      // For now, aggregate stats from collections and brands
      const [collectionsRes, brandsRes] = await Promise.all([
        apiClient.get('/collections/products', {
          params: { limit: 100 },
        }) as Promise<any>,
        apiClient.get('/brands', { params: { limit: 100 } }) as Promise<any>,
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
        totalViews: Math.floor(Math.random() * 50000) + 10000,
        totalSales: Math.floor(Math.random() * 5000) + 1000,
        conversionRate: Math.random() * 5 + 2,
      }
    } catch (error) {
      console.error('Error fetching trending stats:', error)
      return {
        totalCollections: 0,
        activeCollections: 0,
        featuredCollections: 0,
        totalBrands: 0,
        featuredBrands: 0,
        totalViews: 0,
        totalSales: 0,
        conversionRate: 0,
      }
    }
  },

  /**
   * Get featured collections for trending page
   */
  async getFeaturedCollections(): Promise<TrendingCollection[]> {
    try {
      const response = (await apiClient.get('/collections/products', {
        params: { limit: 20, isActive: true },
      })) as any
      const collections =
        response?.data?.collections || response?.collections || []
      return collections.map((c: any, index: number) => ({
        ...c,
        is_featured: c.is_featured || index < 5,
        trending_rank: index + 1,
        views_count: Math.floor(Math.random() * 10000) + 500,
        click_count: Math.floor(Math.random() * 5000) + 200,
        conversion_rate: Math.random() * 10 + 1,
      }))
    } catch (error) {
      console.error('Error fetching featured collections:', error)
      return []
    }
  },

  /**
   * Get featured brands for trending page
   */
  async getFeaturedBrands(): Promise<TrendingBrand[]> {
    try {
      const response = (await apiClient.get('/brands', {
        params: { limit: 20, isActive: true },
      })) as any
      const brands = response?.data?.brands || response?.brands || []
      return brands.map((b: any, index: number) => ({
        ...b,
        is_featured: b.is_featured || index < 5,
        follower_count: Math.floor(Math.random() * 100000) + 1000,
        total_sales: Math.floor(Math.random() * 500000) + 10000,
        trending_rank: index + 1,
      }))
    } catch (error) {
      console.error('Error fetching featured brands:', error)
      return []
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
   * Toggle brand featured status
   */
  async toggleBrandFeatured(brandId: string, isFeatured: boolean) {
    try {
      const response = await apiClient.put(`/brands/${brandId}`, {
        is_featured: isFeatured,
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
   * Get trending analytics
   */
  async getAnalytics(period: 'day' | 'week' | 'month' = 'week') {
    // Mock analytics data - in production, this would come from analytics service
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30
    const data = []

    for (let i = days; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      data.push({
        date: date.toISOString().split('T')[0],
        views: Math.floor(Math.random() * 5000) + 1000,
        clicks: Math.floor(Math.random() * 2500) + 500,
        sales: Math.floor(Math.random() * 500) + 50,
        revenue: Math.floor(Math.random() * 50000) + 5000,
      })
    }

    return {
      period,
      data,
      summary: {
        totalViews: data.reduce((acc, d) => acc + d.views, 0),
        totalClicks: data.reduce((acc, d) => acc + d.clicks, 0),
        totalSales: data.reduce((acc, d) => acc + d.sales, 0),
        totalRevenue: data.reduce((acc, d) => acc + d.revenue, 0),
        avgConversionRate: 3.5,
      },
    }
  },
}

export default trendingService
