// ============================================
// SOURCING-1 service
// ============================================
// Thin typed wrapper around /sourcing, mirroring channel.service.ts's
// template -- an in-house Alibaba/Amazon product importer, an AutoDS
// replacement. Product data is captured by a browser extension (see
// sourcing-extension/), never fetched server-side.

import { apiClient } from '@/lib/api-client'

export type SourcePlatform = 'alibaba' | 'amazon'

export type SourcedProductStatus =
  | 'captured'
  | 'rewriting'
  | 'ready_for_review'
  | 'review_edited'
  | 'committed'
  | 'rewrite_failed'
  | 'discarded'

export interface CapturedImage {
  url: string
  altText?: string | null
  position?: number
}

export interface SourcedProductSummary {
  id: string
  status: SourcedProductStatus
  source_platform: SourcePlatform
  source_url: string
  captured_title: string
  rewritten_title: string | null
  review_title: string | null
  captured_images: CapturedImage[]
  rewrite_confidence: number | null
  suggested_sale_price: string | null
  suggested_margin_percent: string | null
  final_sale_price: string | null
  captured_cost_price_eur: string | null
  captured_at: string
  committed_product_id: string | null
}

export interface SourcedProductDetail extends SourcedProductSummary {
  source_product_id: string | null
  captured_description_html: string | null
  captured_price_tiers: Array<{ minQty: number; maxQty?: number | null; price: number; currency: string }>
  captured_specs: Record<string, string>
  review_specs: Record<string, string> | null
  captured_supplier_name: string | null
  captured_currency: string
  captured_cost_price_original: string | null
  fx_rate_used: string | null
  fx_rate_source: string | null
  rewritten_description_html: string | null
  rewrite_model_name: string | null
  rewrite_notes: string | null
  rewrite_error: string | null
  rewrite_attempt_count: number
  review_description_html: string | null
  review_images: CapturedImage[] | null
  final_cost_price: string | null
  discard_reason: string | null
}

async function listSourcedProducts(status?: SourcedProductStatus) {
  return apiClient.get<{ success: true; products: SourcedProductSummary[] }>('/sourcing/products', {
    params: status ? { status } : undefined,
  })
}

export interface SiblingDraft {
  id: string
  status: SourcedProductStatus
  captured_at: string
}

export interface SourcingAnalytics {
  totals: {
    total: number
    committed: number
    discarded: number
    pendingReview: number
    rewriteFailed: number
    conversionRate: number | null
  }
  avgMarginPercent: number | null
  byPlatform: Array<{ platform: SourcePlatform; total: number; committed: number }>
  captureTrend: Array<{ day: string; count: number }>
  recentCommitted: Array<{
    id: string
    title: string
    sourcePlatform: SourcePlatform
    committedProductId: string | null
    committedAt: string | null
    finalSalePrice: string | null
    marginPercent: number | null
  }>
}

async function getAnalytics() {
  return apiClient.get<{ success: true; analytics: SourcingAnalytics }>('/sourcing/analytics')
}

export interface SourcedOrigin {
  id: string
  sourceUrl: string
  sourcePlatform: SourcePlatform
  capturedSupplierName: string | null
}

/** Backs the "Recheck price" link on a committed product's edit page. */
async function getSourcedOriginForProduct(productId: string) {
  return apiClient.get<{ success: true; sourced: SourcedOrigin | null }>(`/sourcing/products/by-committed/${productId}`)
}

async function getSourcedProduct(id: string) {
  return apiClient.get<{ success: true; product: SourcedProductDetail; siblingDrafts: SiblingDraft[] }>(`/sourcing/products/${id}`)
}

export interface ReviewFieldsPayload {
  reviewTitle?: string
  reviewDescriptionHtml?: string
  reviewImages?: CapturedImage[]
  reviewSpecs?: Record<string, string>
  finalCostPrice?: number
  finalSalePrice?: number
}

async function updateReview(id: string, fields: ReviewFieldsPayload) {
  return apiClient.patch<{ success: true } | { success: false; error: string }>(`/sourcing/products/${id}/review`, fields)
}

async function regenerateRewrite(id: string) {
  return apiClient.post<{ success: true; product: SourcedProductDetail } | { success: false; error: string }>(
    `/sourcing/products/${id}/regenerate`,
    {},
  )
}

async function commitSourcedProduct(id: string) {
  return apiClient.post<{ success: true; data: { productId: string } } | { success: false; error: string }>(
    `/sourcing/products/${id}/commit`,
    {},
  )
}

async function discardSourcedProduct(id: string, reason?: string) {
  return apiClient.post<{ success: true } | { success: false; error: string }>(`/sourcing/products/${id}/discard`, { reason })
}

// ---------- Pricing rules ----------

export interface SourcingPricingRule {
  id: string
  name: string
  rule_type: 'margin_percent' | 'cost_plus_fixed'
  margin_percent: string | null
  fixed_markup: string | null
  rounding_mode: 'none' | 'charm' | 'nearest_1'
  is_default: boolean
  created_at: string
}

async function listPricingRules() {
  return apiClient.get<{ success: true; rules: SourcingPricingRule[] }>('/sourcing/pricing-rules')
}

async function createPricingRule(payload: {
  name: string
  ruleType: 'margin_percent' | 'cost_plus_fixed'
  marginPercent?: number
  fixedMarkup?: number
  roundingMode?: 'none' | 'charm' | 'nearest_1'
  isDefault?: boolean
}) {
  return apiClient.post<{ success: true; data: { id: string } }>('/sourcing/pricing-rules', payload)
}

// ---------- Extension API tokens ----------

export interface SourcingApiToken {
  id: string
  name: string
  token_prefix: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

async function issueToken(name: string, expiresInDays?: number) {
  return apiClient.post<{ success: true; data: { id: string; token: string; tokenPrefix: string } }>('/sourcing/tokens', {
    name,
    expiresInDays,
  })
}

async function listTokens() {
  return apiClient.get<{ success: true; tokens: SourcingApiToken[] }>('/sourcing/tokens')
}

async function revokeToken(id: string) {
  return apiClient.delete<{ success: true }>(`/sourcing/tokens/${id}`)
}

// ---------- Extension package download ----------
// Always-current .zip of sourcing-extension/, served from the API itself
// rather than a Chrome Web Store listing -- the founder can grab it from
// any computer/browser they're logged into TechTools from, no local file
// path or Google review to depend on.

async function downloadExtensionZip(): Promise<void> {
  const blob = await apiClient.get<Blob>('/sourcing/extension/download', { responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'techtools-sourcing-extension.zip'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const sourcingService = {
  listSourcedProducts,
  getAnalytics,
  getSourcedOriginForProduct,
  getSourcedProduct,
  updateReview,
  regenerateRewrite,
  commitSourcedProduct,
  discardSourcedProduct,
  listPricingRules,
  createPricingRule,
  issueToken,
  listTokens,
  revokeToken,
  downloadExtensionZip,
}

export default sourcingService
