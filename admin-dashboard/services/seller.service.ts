import apiClient from '@/lib/api-client'
import type {
  SellerAccountStatus,
  SellerOnboardingStatus,
  SellerProfileVerificationStatus,
  SellerStoreStatus,
  SellerTier,
  SellerVerificationCaseStatus,
} from '@/lib/seller-lifecycle'

// Lowercase filter keys sent as the `status` query param -- this is a
// backward-compatible API CONTRACT choice on the backend (see
// tech-tools-api's admin/sellers.controller.ts comments), deliberately
// NOT the same casing as the enum values these map to server-side. Do
// not "fix" these to uppercase -- that would break the actual request.
export type SellerVerificationQueueStatusFilter =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'more_information_required'
  | 'expired'
  | 'superseded'

export type SellerProfileStatusFilter =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'more_information_required'
  | 'expired'

export interface SellerVerificationQueueItem {
  id: string
  user_id: string
  seller_profile_id: string
  requested_tier: SellerTier
  // seller_verification_case_status -- this request's OWN review lifecycle.
  status: SellerVerificationCaseStatus
  notes?: string | null
  admin_notes?: string | null
  admin_decision_reason?: string | null
  created_at: string
  display_name?: string | null
  handle?: string | null
  // The seller's CURRENT tier (sp.tier) -- distinct from requested_tier
  // above. A tier-upgrade request is not the same concept as identity
  // verification, and this is not the tier being requested.
  tier?: SellerTier
  // seller_profile_verification_status -- the PROFILE's overall standing,
  // a different enum from `status` above (joined in from seller_profiles).
  verification_status?: SellerProfileVerificationStatus
  account_status?: SellerAccountStatus
  email?: string
  first_name?: string
  last_name?: string
}

export interface SellerListItem {
  id: string
  user_id: string
  display_name: string | null
  handle: string | null
  tier: SellerTier
  verification_status: SellerProfileVerificationStatus
  account_status?: SellerAccountStatus
  store_status?: SellerStoreStatus
  onboarding_status?: SellerOnboardingStatus
  max_active_listings: number
  max_product_price: string | number | null
  is_active: boolean
  is_suspended: boolean
  created_at: string
  email: string
  first_name: string | null
  last_name: string | null
}

// Mirrors tech-tools-api's DocumentMetadataDTO (seller-documents.service.ts)
// -- never the raw DB row, so storage_key/storage_provider/checksum stay
// server-only even in this admin-facing type.
export interface SellerDocument {
  id: string
  category: string
  uploadStatus: string
  reviewStatus: 'pending' | 'accepted' | 'rejected'
  // Reflects the real ClamAV scan outcome -- 'not_scanned' briefly right
  // after upload (the scan runs async), then 'clean' | 'flagged' |
  // 'error'. A verification request can only be approved once this is
  // 'clean' AND reviewStatus is 'accepted' (see approveVerification on
  // the backend), so this UI must show it, not just reviewStatus.
  malwareScanStatus: 'not_scanned' | 'clean' | 'flagged' | 'error'
  byteSize: number
  contentType: string
  createdAt: string
  reviewedAt: string | null
}

export interface SellerDetail {
  sellerProfile: SellerListItem & {
    bio: string | null
    is_business_account: boolean
  }
  verificationRequests: SellerVerificationQueueItem[]
  storeProductCount: number
  discoverPostCount: number
  earningsSummary: {
    pendingBalance: number
    confirmedUnpaidBalance: number
    lifetimePaid: number
    tier: string | null
    commissionRate: number | null
  } | null
  documents: SellerDocument[]
}

export const sellerService = {
  async getAllSellers(params?: {
    tier?: string
    status?: SellerProfileStatusFilter
    suspended?: boolean
    search?: string
    page?: number
    limit?: number
  }) {
    const search = new URLSearchParams()
    if (params?.tier) search.set('tier', params.tier)
    if (params?.status) search.set('status', params.status)
    if (params?.suspended !== undefined) search.set('suspended', String(params.suspended))
    if (params?.search) search.set('search', params.search)
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))

    const qs = search.toString()
    return await apiClient.get<{
      success: boolean
      data: {
        items: SellerListItem[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }
    }>(`/admin/sellers${qs ? `?${qs}` : ''}`)
  },

  async getSellerDetail(sellerProfileId: string) {
    return await apiClient.get<{ success: boolean; data: SellerDetail }>(
      `/admin/sellers/${sellerProfileId}`,
    )
  },

  async grantSellerAccess(payload: { userId: string; tier?: string }) {
    return await apiClient.post<{ success: boolean; data: { sellerProfile: SellerListItem } }>(
      '/admin/sellers/grant',
      payload,
    )
  },

  async setSellerTier(sellerProfileId: string, tier: string) {
    return await apiClient.patch(`/admin/sellers/${sellerProfileId}/tier`, { tier })
  },

  async reactivateSellerProfile(sellerProfileId: string) {
    return await apiClient.post(`/admin/sellers/${sellerProfileId}/reactivate`, {})
  },

  async getVerificationQueue(params?: {
    status?: SellerVerificationQueueStatusFilter
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

  // The list endpoint only ever returns items for ONE status filter at a
  // time (paginated) -- there is no backend aggregate-counts endpoint,
  // and adding one is a backend change out of scope for this
  // admin-dashboard-only hotfix. `pagination.total` on a limit=1 request
  // is an exact count for that status without fetching real rows, so a
  // full breakdown across every case status is six small parallel
  // requests rather than one backend change.
  async getVerificationQueueCounts(): Promise<
    Record<SellerVerificationQueueStatusFilter, number>
  > {
    const statuses: SellerVerificationQueueStatusFilter[] = [
      'pending',
      'more_information_required',
      'approved',
      'rejected',
      'expired',
      'superseded',
    ]

    const results = await Promise.all(
      statuses.map((status) =>
        sellerService
          .getVerificationQueue({ status, limit: 1 })
          .then((response) => response.data?.pagination?.total || 0)
          .catch(() => 0),
      ),
    )

    return statuses.reduce(
      (acc, status, index) => ({ ...acc, [status]: results[index] }),
      {} as Record<SellerVerificationQueueStatusFilter, number>,
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

  // Gated by `sellers.manage` server-side (stronger than `sellers.view`)
  // -- inspecting a raw identity document is a more sensitive action
  // than browsing seller metadata.
  async downloadSellerDocument(documentId: string) {
    return await apiClient.get<Blob>(`/admin/sellers/documents/${documentId}/download`, {
      responseType: 'blob',
    })
  },

  async reviewSellerDocument(
    documentId: string,
    payload: { reviewStatus: 'accepted' | 'rejected'; reviewNotes?: string },
  ) {
    return await apiClient.patch(`/admin/sellers/documents/${documentId}/review`, payload)
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
