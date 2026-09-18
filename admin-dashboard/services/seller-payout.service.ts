// ============================================
// Seller earnings & manual payouts -- admin service
// ============================================
// Thin wrapper around /api/v1/admin/seller-payouts/*. Kept separate from
// seller.service.ts (seller verification/product moderation) -- this is
// a distinct money domain gated by its own sellers.payouts.view/manage
// permissions, not the plain admin/super_admin check seller verification
// uses. A seller's live "confirmed, unpaid" balance is always computed
// on the backend from seller_payout_ledger (SUM of real ledger rows),
// never a cached rollup -- same principle as the affiliate program's
// store-credit ledger.

import apiClient from '@/lib/api-client'

export interface SellerPayoutBalance {
  seller_profile_id: string
  display_name: string | null
  handle: string | null
  tier: 'unverified' | 'basic' | 'trusted' | 'pro'
  pending_balance: string
  confirmed_unpaid_balance: string
  lifetime_paid: string
}

export interface SellerLedgerEntry {
  id: string
  delta_amount: string
  reason: 'earning_confirmed' | 'earning_clawback' | 'payout_sent'
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

export interface EligibleEarning {
  id: string
  order_id: string
  order_number: string
  gross_item_amount: string
  commission_rate_snapshot: string
  seller_net_amount: string
  confirmed_at: string
}

export const sellerPayoutService = {
  async getBalances(params?: { owedOnly?: boolean }) {
    const search = new URLSearchParams()
    if (params?.owedOnly === false) search.set('owedOnly', 'false')
    const qs = search.toString()
    return await apiClient.get<{ success: boolean; data: SellerPayoutBalance[] }>(
      `/admin/seller-payouts/balances${qs ? `?${qs}` : ''}`,
    )
  },

  async getLedger(sellerProfileId: string, params?: { page?: number; limit?: number }) {
    const search = new URLSearchParams()
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))
    const qs = search.toString()
    return await apiClient.get<{ success: boolean; data: SellerLedgerEntry[] }>(
      `/admin/seller-payouts/${sellerProfileId}/ledger${qs ? `?${qs}` : ''}`,
    )
  },

  async getEligibleEarnings(sellerProfileId: string) {
    return await apiClient.get<{ success: boolean; data: EligibleEarning[] }>(
      `/admin/seller-payouts/${sellerProfileId}/eligible-earnings`,
    )
  },

  async recordPayoutBatch(
    sellerProfileId: string,
    payload: {
      amount: number
      payoutMethod: string
      payoutReference?: string
      notes?: string
      earningIds: string[]
    },
  ) {
    return await apiClient.post(`/admin/seller-payouts/${sellerProfileId}/batches`, payload)
  },
}

export default sellerPayoutService
