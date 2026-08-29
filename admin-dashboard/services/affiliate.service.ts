// ============================================
// Affiliate program admin service
// ============================================
// Thin wrapper around /api/v1/affiliates/admin/* -- the referral program's
// admin surface (affiliate directory, per-affiliate conversions, program
// settings, and the store-credit ledger paid out as commissions are
// confirmed). Store-credit issuance itself is fully automatic (a background
// worker confirms commissions and credits them); nothing here writes to the
// ledger directly.

import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

export type AffiliateStatus = 'active' | 'suspended'
export type AffiliateConversionStatus = 'pending' | 'confirmed' | 'cancelled' | 'paid'
export type StoreCreditLedgerReason =
  | 'affiliate_commission'
  | 'affiliate_commission_clawback'
  | 'redeemed_at_checkout'
  | 'manual_adjustment'

export interface Affiliate {
  id: string
  referral_code: string
  status: AffiliateStatus
  total_clicks: number
  total_conversions: number
  // Postgres DECIMAL, serialized as a string over the wire -- coerce with
  // Number() before formatting, same as every other decimal column in this
  // codebase's admin services.
  total_earned: string
  created_at: string
  first_name: string | null
  last_name: string | null
  email: string
}

export interface AffiliateConversion {
  id: string
  order_id: string
  order_value: string
  commission_rate_snapshot: string
  commission_amount: string
  status: AffiliateConversionStatus
  cancelled_reason: string | null
  created_at: string
  confirmed_at: string | null
  cancelled_at: string | null
}

export interface AffiliateSettings {
  commission_rate_percent: number | string
  hold_period_days: number | string
  fallback_hold_period_days: number | string
  min_payout_amount: number | string
  program_enabled: boolean
}

export interface UpdateAffiliateSettingsPayload {
  commissionRatePercent?: number
  holdPeriodDays?: number
  fallbackHoldPeriodDays?: number
  programEnabled?: boolean
}

export interface StoreCreditLedgerEntry {
  id: string
  delta_amount: string
  reason: StoreCreditLedgerReason
  reference_type: string | null
  reference_id: string | null
  created_at: string
  first_name: string | null
  last_name: string | null
  email: string
}

export interface ListAffiliatesParams {
  page?: number
  limit?: number
  search?: string
  status?: AffiliateStatus | ''
}

export interface StoreCreditLedgerParams {
  page?: number
  limit?: number
}

export const affiliateService = {
  async listAffiliates(
    params: ListAffiliatesParams = {},
  ): Promise<ApiResponse<{ affiliates: Affiliate[]; total: number; page: number; limit: number }>> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.status) query.set('status', params.status)
    return apiClient.get<
      ApiResponse<{ affiliates: Affiliate[]; total: number; page: number; limit: number }>
    >(`/affiliates/admin/list?${query.toString()}`)
  },

  async getAffiliateConversions(
    id: string,
  ): Promise<ApiResponse<{ conversions: AffiliateConversion[] }>> {
    return apiClient.get<ApiResponse<{ conversions: AffiliateConversion[] }>>(
      `/affiliates/admin/${id}/conversions`,
    )
  },

  async updateAffiliateStatus(
    id: string,
    status: AffiliateStatus,
  ): Promise<ApiResponse<{ affiliate: { id: string; status: AffiliateStatus } }>> {
    return apiClient.patch<ApiResponse<{ affiliate: { id: string; status: AffiliateStatus } }>>(
      `/affiliates/admin/${id}/status`,
      { status },
    )
  },

  async getSettings(): Promise<ApiResponse<{ settings: AffiliateSettings }>> {
    return apiClient.get<ApiResponse<{ settings: AffiliateSettings }>>('/affiliates/admin/settings')
  },

  async updateSettings(
    payload: UpdateAffiliateSettingsPayload,
  ): Promise<ApiResponse<{ settings: AffiliateSettings }>> {
    return apiClient.put<ApiResponse<{ settings: AffiliateSettings }>>(
      '/affiliates/admin/settings',
      payload,
    )
  },

  async getStoreCreditLedger(
    params: StoreCreditLedgerParams = {},
  ): Promise<ApiResponse<{ entries: StoreCreditLedgerEntry[]; total: number; page: number; limit: number }>> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    return apiClient.get<
      ApiResponse<{ entries: StoreCreditLedgerEntry[]; total: number; page: number; limit: number }>
    >(`/affiliates/admin/ledger?${query.toString()}`)
  },
}

export default affiliateService
