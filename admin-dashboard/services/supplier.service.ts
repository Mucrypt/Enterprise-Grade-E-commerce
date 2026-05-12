import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

export interface SupplierProfile {
  id: string
  company_name: string
  contact_name?: string | null
  email: string
  phone?: string | null
  source_platform?: 'amazon' | 'alibaba' | 'other'
  country_code?: string | null
  status?: 'active' | 'watchlist' | 'blocked'
  rating?: number | null
  on_time_rate?: number | null
  defect_rate?: number | null
  refund_rate?: number | null
  lead_time_days?: number | null
  created_at: string
  updated_at: string
}

export interface SupplierOffer {
  id: string
  supplier_id: string
  product_id: string
  product_name?: string
  product_slug?: string
  supplier_product_id?: string | null
  supplier_sku?: string | null
  cost_price: number
  shipping_cost: number
  currency_code: string
  stock_quantity: number
  min_order_quantity: number
  estimated_delivery_days?: number | null
  lead_time_days?: number | null
  is_primary: boolean
  is_available: boolean
  supplier_url?: string | null
}

export interface ProductEconomics {
  product_id: string
  sell_price: number
  landed_cost: number
  payment_fee: number
  ad_cost_per_order: number
  expected_refund_cost: number
  gross_margin: number
  contribution_margin: number
  margin_percent: number
  updated_at: string
}

export interface AutoPausedProduct {
  product_id: string
  product_name: string
  product_slug: string
  sku: string
  auto_pause: boolean
  pause_reason?: string | null
  paused_at: string
  margin_percent?: number | null
  contribution_margin?: number | null
  sell_price?: number | null
  landed_cost?: number | null
}

class SupplierService {
  async getSuppliers(params?: {
    page?: number
    limit?: number
    status?: 'active' | 'watchlist' | 'blocked'
    sourcePlatform?: 'amazon' | 'alibaba' | 'other'
    search?: string
  }): Promise<
    ApiResponse<{
      suppliers: SupplierProfile[]
      pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
      }
    }>
  > {
    const search = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          search.append(key, String(value))
        }
      })
    }

    return apiClient.get(`/suppliers?${search.toString()}`)
  }

  async createSupplier(payload: {
    companyName: string
    contactName?: string
    email: string
    phone?: string
    address?: Record<string, unknown>
    sourcePlatform?: 'amazon' | 'alibaba' | 'other'
    countryCode?: string
    status?: 'active' | 'watchlist' | 'blocked'
    paymentTerms?: string
    leadTimeDays?: number
  }): Promise<ApiResponse<{ supplier: SupplierProfile }>> {
    return apiClient.post('/suppliers', payload)
  }

  async updateSupplier(
    id: string,
    payload: Partial<{
      companyName: string
      contactName: string
      email: string
      phone: string
      address: Record<string, unknown>
      sourcePlatform: 'amazon' | 'alibaba' | 'other'
      countryCode: string
      status: 'active' | 'watchlist' | 'blocked'
      paymentTerms: string
      leadTimeDays: number
      rating: number
      onTimeRate: number
      defectRate: number
      refundRate: number
    }>,
  ): Promise<ApiResponse<{ supplier: SupplierProfile }>> {
    return apiClient.put(`/suppliers/${id}`, payload)
  }

  async deleteSupplier(id: string): Promise<ApiResponse<{ supplierId: string }>> {
    return apiClient.delete(`/suppliers/${id}`)
  }

  async getSupplierProducts(
    supplierId: string,
  ): Promise<ApiResponse<{ supplierId: string; products: SupplierOffer[] }>> {
    return apiClient.get(`/suppliers/${supplierId}/products`)
  }

  async upsertSupplierOffer(
    supplierId: string,
    payload: {
      productId: string
      supplierProductId?: string
      supplierSku?: string
      costPrice: number
      shippingCost?: number
      currencyCode?: string
      stockQuantity?: number
      minOrderQuantity?: number
      estimatedDeliveryDays?: number
      leadTimeDays?: number
      isAvailable?: boolean
      isPrimary?: boolean
      supplierUrl?: string
    },
  ): Promise<ApiResponse<{ offer: SupplierOffer }>> {
    return apiClient.post(`/suppliers/${supplierId}/products/offers`, payload)
  }

  async getProductEconomics(
    productId: string,
  ): Promise<
    ApiResponse<{
      economics: ProductEconomics
      flags: {
        auto_pause: boolean
        pause_reason?: string | null
        is_publish_blocked: boolean
        publish_block_reason?: string | null
      } | null
    }>
  > {
    return apiClient.get(`/suppliers/products/${productId}/economics`)
  }

  async recomputeProductEconomics(
    productId: string,
    payload?: {
      adCostPerOrder?: number
      paymentFee?: number
      expectedRefundCost?: number
      fallbackShippingCost?: number
    },
  ): Promise<ApiResponse<{ economics: ProductEconomics }>> {
    return apiClient.post(
      `/suppliers/products/${productId}/economics/recompute`,
      payload || {},
    )
  }

  async evaluateProductAutoPause(
    productId: string,
    payload?: { marginFloorPercent?: number },
  ): Promise<
    ApiResponse<{
      shouldPause: boolean
      marginFloorPercent: number
      economics: {
        marginPercent: number
        contributionMargin: number
      }
    }>
  > {
    return apiClient.post(
      `/suppliers/products/${productId}/auto-pause/evaluate`,
      payload || {},
    )
  }

  async getAutoPausedProducts(
    limit: number = 20,
  ): Promise<ApiResponse<{ items: AutoPausedProduct[] }>> {
    return apiClient.get(`/suppliers/ops/auto-paused?limit=${limit}`)
  }
}

export const supplierService = new SupplierService()
export default supplierService
