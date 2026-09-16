import apiClient from '@/lib/api-client'

export interface SellerVerificationQueueItem {
  id: string
  user_id: string
  seller_profile_id: string
  requested_tier: 'unverified' | 'basic' | 'trusted' | 'pro'
  status: 'none' | 'pending' | 'approved' | 'rejected' | 'suspended'
  notes?: string | null
  admin_notes?: string | null
  admin_decision_reason?: string | null
  created_at: string
  display_name?: string | null
  handle?: string | null
  tier?: string
  verification_status?: string
  email?: string
  first_name?: string
  last_name?: string
}

export const sellerService = {
  async getVerificationQueue(params?: {
    status?: 'pending' | 'approved' | 'rejected' | 'suspended' | 'none'
    page?: number
    limit?: number
  }) {
    const search = new URLSearchParams()

    if (params?.status) search.set('status', params.status)
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))

    const query = search.toString()
    return await apiClient.get<{
      success: boolean
      data: {
        items: SellerVerificationQueueItem[]
        pagination: {
          page: number
          limit: number
          total: number
          totalPages: number
        }
      }
    }>(
      query
        ? `/admin/sellers/verification-queue?${query}`
        : '/admin/sellers/verification-queue',
    )
  },

  async approveVerificationRequest(
    requestId: string,
    payload?: {
      adminNotes?: string
      decisionReason?: string
      phoneVerified?: boolean
      idVerified?: boolean
      paymentMethodVerified?: boolean
    },
  ) {
    return await apiClient.post(
      `/admin/sellers/verification-requests/${requestId}/approve`,
      payload || {},
    )
  },

  async rejectVerificationRequest(
    requestId: string,
    payload?: {
      adminNotes?: string
      decisionReason?: string
    },
  ) {
    return await apiClient.post(
      `/admin/sellers/verification-requests/${requestId}/reject`,
      payload || {},
    )
  },

  async suspendSellerProfile(
    sellerProfileId: string,
    payload: {
      suspensionReason: string
    },
  ) {
    return await apiClient.post(
      `/admin/sellers/${sellerProfileId}/suspend`,
      payload,
    )
  },

  async setCreatorAccess(
    sellerProfileId: string,
    payload: {
      accessEnabled: boolean
      reason?: string
    },
  ) {
    return await apiClient.post(
      `/admin/sellers/${sellerProfileId}/creator-access`,
      payload,
    )
  },

  // Products a seller listed themselves, pending approval -- real
  // inventory/pricing, gated the same way seller-authored Discover
  // posts are (is_active=false until an admin approves).
  async getPendingProducts() {
    return await apiClient.get<{ success: boolean; data: SellerPendingProduct[] }>(
      '/seller/products/pending',
    )
  },

  async approveProduct(productId: string) {
    return await apiClient.patch(`/seller/products/${productId}/review`, {})
  },

  async rejectProduct(productId: string) {
    return await apiClient.delete(`/seller/products/${productId}`)
  },
}

export interface SellerPendingProduct {
  id: string
  name: string
  sku: string
  slug: string
  base_price: string | number
  sale_price: string | number | null
  category_name?: string | null
  seller_display_name?: string | null
  seller_handle?: string | null
  images?: { url: string; is_primary?: boolean }[]
  total_stock?: number
  created_at: string
}
