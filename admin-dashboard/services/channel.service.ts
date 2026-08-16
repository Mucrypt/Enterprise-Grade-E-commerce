// ============================================
// TIKTOK-COMMERCE-1 service
// ============================================
// Thin typed wrapper around /channels/accounts, mirroring
// promotion.service.ts's connections template exactly -- deliberately a
// separate file/domain from promotion.service.ts's SocialConnection (that
// covers organic publishing; this covers the TikTok Shop commerce
// channel, an unrelated system).

import { apiClient } from '@/lib/api-client'

export type ChannelType = 'TIKTOK_SHOP'

export const CHANNEL_TYPES: ChannelType[] = ['TIKTOK_SHOP']

export type ChannelReadiness = 'NOT_CONFIGURED' | 'NEEDS_CREDENTIALS' | 'AVAILABLE'

export interface ChannelCapabilities {
  channelType: ChannelType
  readiness: ChannelReadiness
  requiresAppReview: boolean
  supportsProductRead: boolean
  supportsProductWrite: boolean
  supportsInventoryRead: boolean
  supportsInventoryWrite: boolean
  supportsOrderImport: boolean
  supportsFulfillmentWrite: boolean
  supportsFinanceSync: boolean
  supportsAffiliateSync: boolean
  rateLimitNotes: string
  tokenExpiryNotes: string
  notes: string
}

export interface CommerceChannelAccount {
  id: string
  channelType: ChannelType
  displayName: string | null
  externalShopId: string | null
  marketCountry: string
  marketCurrency: string
  status: string
  syncMode: string
  scopes: string[]
  connectedAt: string | null
  lastValidatedAt: string | null
  lastError: string | null
  disabledByAdmin: boolean
  accessTokenExpiresAt: string | null
  metadata: Record<string, unknown>
}

async function listAccounts() {
  return apiClient.get<{ success: true; accounts: CommerceChannelAccount[]; capabilities: ChannelCapabilities[] }>('/channels/accounts')
}

async function getCapabilities() {
  return apiClient.get<{ success: true; capabilities: ChannelCapabilities[] }>('/channels/accounts/capabilities')
}

async function startOAuth(channelType: ChannelType, redirectUri: string) {
  return apiClient.post<{ success: true; authorizeUrl: string; state: string } | { success: false; error: string; readiness?: ChannelReadiness }>(
    `/channels/accounts/${channelType.toLowerCase()}/oauth/start`,
    { redirectUri },
  )
}

async function completeOAuth(code: string, state: string, redirectUri: string, marketCurrency: string) {
  return apiClient.post<{ success: true; account: CommerceChannelAccount } | { success: false; error: string }>(
    '/channels/accounts/oauth/callback',
    { code, state, redirectUri, marketCurrency },
  )
}

async function disconnectAccount(id: string) {
  return apiClient.delete<{ success: true; message: string }>(`/channels/accounts/${id}`)
}

async function disableAccount(id: string, disabled: boolean) {
  return apiClient.post<{ success: true }>(`/channels/accounts/${id}/disable`, { disabled })
}

// ---------- Product mappings ----------

export interface ChannelProductMapping {
  id: string
  channel_account_id: string
  product_id: string | null
  channel_product_id: string
  channel_sku: string | null
  channel_variation_id: string | null
  mapping_status: 'UNMAPPED' | 'MAPPED' | 'CONFLICT' | 'CHANNEL_ONLY'
  last_synced_at: string | null
  last_diff: Record<string, { previous: unknown; current: unknown }> | null
  product_name: string | null
  product_sku: string | null
}

export interface ProductSyncSummary {
  runId: string
  totalItems: number
  toCreate: number
  toUpdate: number
  unmapped: number
}

async function listProductMappings(channelAccountId?: string) {
  return apiClient.get<{ success: true; mappings: ChannelProductMapping[] }>('/channels/products', {
    params: channelAccountId ? { channelAccountId } : undefined,
  })
}

async function previewProductSync(channelAccountId: string) {
  return apiClient.post<{ success: true; data: ProductSyncSummary } | { success: false; error: string }>(
    '/channels/products/preview-sync',
    { channelAccountId },
  )
}

async function commitProductSync(channelAccountId: string, runId: string) {
  return apiClient.post<{ success: true; data: { createdCount: number; updatedCount: number } } | { success: false; error: string }>(
    '/channels/products/commit-sync',
    { channelAccountId, runId },
  )
}

// ---------- Inventory diff ----------

export interface ChannelInventoryDiff {
  id: string
  run_id: string
  channel_product_mapping_id: string
  techtools_available_stock: number | null
  channel_reported_stock: number | null
  delta: number | null
  action_taken: 'NONE' | 'FLAGGED' | 'WRITTEN_TO_CHANNEL'
  created_at: string
  channel_product_id: string
  channel_sku: string | null
  product_name: string | null
}

async function listInventoryDiffs(channelAccountId?: string) {
  return apiClient.get<{ success: true; diffs: ChannelInventoryDiff[] }>('/channels/products/inventory-diffs', {
    params: channelAccountId ? { channelAccountId } : undefined,
  })
}

async function runInventoryDiff(channelAccountId: string) {
  return apiClient.post<{ success: true; data: { runId: string; comparedCount: number; flaggedCount: number } } | { success: false; error: string }>(
    '/channels/products/inventory-diff',
    { channelAccountId },
  )
}

// ---------- Orders ----------

export interface ChannelOrder {
  id: string
  channel_account_id: string
  channel_order_id: string
  channel_order_status: string
  buyer_display_name: string | null
  buyer_country: string | null
  currency: string
  gross_amount: string
  shipping_fee_amount: string | null
  tax_amount: string | null
  imported_at: string
  last_synced_at: string | null
  external_updated_at: string | null
  /** True if at least one line item has no known TechTools product mapping -- still a real, imported order, just flagged for a human to map. */
  needs_mapping: boolean
}

export interface ChannelOrderItem {
  id: string
  channel_product_mapping_id: string | null
  channel_sku: string | null
  quantity: number
  unit_price: string | null
  line_total: string | null
  product_name: string | null
}

export interface OrderImportSummary {
  runId: string
  totalFetched: number
  importedCount: number
  updatedCount: number
  staleIgnoredCount: number
  issueCount: number
  failedCount: number
  /** false if a page failed partway through pagination -- some real orders may not have been fetched this run. */
  complete: boolean
}

export interface ChannelOrderImportIssue {
  id: string
  channel_account_id: string
  external_order_id: string
  external_updated_at: string | null
  reason_code: 'INVALID_ORDER_AMOUNT' | 'MISSING_CURRENCY' | 'MISSING_REQUIRED_SKU' | 'UNMAPPED_PRODUCT' | 'UNSUPPORTED_ORDER_STATE' | 'MALFORMED_REMOTE_ORDER'
  reason_detail: string | null
  discovered_at: string
  resolved_at: string | null
  resolution_note: string | null
}

async function listChannelOrders(channelAccountId?: string, needsMapping?: boolean) {
  return apiClient.get<{ success: true; orders: ChannelOrder[] }>('/channels/orders', {
    params: { ...(channelAccountId ? { channelAccountId } : {}), ...(needsMapping ? { needsMapping: 'true' } : {}) },
  })
}

async function getChannelOrder(orderId: string) {
  return apiClient.get<{ success: true; order: ChannelOrder; items: ChannelOrderItem[] }>(`/channels/orders/${orderId}`)
}

/** `fromDate` triggers an explicit backfill (bypasses the checkpoint, never advances it) instead of the regular incremental poll. */
async function runOrderImport(channelAccountId: string, fromDate?: string) {
  return apiClient.post<{ success: true; data: OrderImportSummary } | { success: false; error: string }>(
    '/channels/orders/import',
    { channelAccountId, ...(fromDate ? { fromDate } : {}) },
  )
}

async function listOrderImportIssues(channelAccountId?: string) {
  return apiClient.get<{ success: true; issues: ChannelOrderImportIssue[] }>('/channels/orders/issues', {
    params: channelAccountId ? { channelAccountId } : undefined,
  })
}

async function resolveOrderImportIssue(issueId: string, note?: string) {
  return apiClient.post<{ success: true }>(`/channels/orders/issues/${issueId}/resolve`, { note })
}

export const channelService = {
  listAccounts,
  getCapabilities,
  startOAuth,
  completeOAuth,
  disconnectAccount,
  disableAccount,
  listProductMappings,
  previewProductSync,
  commitProductSync,
  listInventoryDiffs,
  runInventoryDiff,
  listChannelOrders,
  getChannelOrder,
  runOrderImport,
  listOrderImportIssues,
  resolveOrderImportIssue,
}

export default channelService
