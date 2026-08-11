// ============================================
// PROMOTION-OPS-1 service
// ============================================
// Thin typed wrapper around POST/GET /promotions/campaigns and
// /promotions/connections, mirroring analytics-v2.service.ts's template.

import { apiClient } from '@/lib/api-client'

export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'LINKEDIN' | 'PINTEREST' | 'X'

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'PINTEREST', 'X']

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PARTIAL_SUCCESS' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | 'DRY_RUN_COMPLETED'
export type ChannelPostStatus = 'DRAFT' | 'QUEUED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | 'DRY_RUN_SUCCEEDED' | 'REQUIRES_ACTION'
export type PlatformReadiness = 'NOT_CONFIGURED' | 'NEEDS_CREDENTIALS' | 'AVAILABLE'

export interface PlatformCapabilities {
  platform: SocialPlatform
  readiness: PlatformReadiness
  requiresAppReview: boolean
  supportsText: boolean
  supportsImage: boolean
  supportsMultiImage: boolean
  supportsVideo: boolean
  supportsReelOrShort: boolean
  supportsLink: boolean
  supportsScheduling: boolean
  supportsPostMetrics: boolean
  supportsComments: boolean
  supportsDelete: boolean
  supportsEdit: boolean
  rateLimitNotes: string
  tokenExpiryNotes: string
  notes: string
}

export interface CampaignListItem {
  id: string
  name: string
  campaignKey: string
  status: CampaignStatus
  objective: string | null
  scheduledAt: string | null
  publishedAt: string | null
  completedAt: string | null
  createdBy: string
  createdAt: string
  channelCount: number
  productCount: number
}

export interface CampaignProduct {
  id: string
  productId: string | null
  displayOrder: number
  name: string
  slug: string | null
  price: number | null
  currency: string | null
  imageUrl: string | null
}

export interface CampaignChannelPost {
  id: string
  channel: SocialPlatform
  connectionId: string | null
  status: ChannelPostStatus
  messageOverride: string | null
  hashtags: string[]
  creativeAssetKey: string | null
  linkUrl: string | null
  scheduledAt: string | null
  publishedAt: string | null
  remotePostId: string | null
  remotePermalink: string | null
  lastError: string | null
  lastErrorCode: string | null
  attemptCount: number
  maxRetries: number
  dryRun: boolean
  validationErrors: { valid: boolean; errors: string[]; warnings: string[] } | null
}

export interface CreativeAsset {
  key: string
  url: string
  variant: string
  width: number
  height: number
  mediaType: 'image' | 'video'
}

export interface CampaignDetail {
  id: string
  name: string
  campaignKey: string
  status: CampaignStatus
  objective: string | null
  masterMessage: string
  couponId: string | null
  /** NULL = global campaign. See docs/SOCIAL-PUBLISHING-ARCHITECTURE.md §8 -- not enforced against product/coupon availability, only campaign visibility. */
  marketScope: string[] | null
  landingUrl: string | null
  creativeAssets: CreativeAsset[]
  timezone: string
  scheduledAt: string | null
  publishedAt: string | null
  completedAt: string | null
  dryRun: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  products: CampaignProduct[]
  channels: CampaignChannelPost[]
}

export interface CampaignListFilters {
  page?: number
  pageSize?: number
  status?: CampaignStatus
  search?: string
  channel?: SocialPlatform
}

async function listCampaigns(filters: CampaignListFilters = {}) {
  return apiClient.get<{ success: true; campaigns: CampaignListItem[]; pagination: { page: number; pageSize: number; total: number } }>(
    '/promotions/campaigns',
    { params: filters },
  )
}

async function getCampaign(id: string) {
  return apiClient.get<{ success: true; campaign: CampaignDetail }>(`/promotions/campaigns/${id}`)
}

async function createCampaign(data: { name: string; objective?: string; masterMessage?: string; landingUrl?: string; couponId?: string; timezone?: string }) {
  return apiClient.post<{ success: true; campaign: CampaignDetail }>('/promotions/campaigns', data)
}

export interface UpdateCampaignInput {
  name?: string
  objective?: string | null
  masterMessage?: string
  landingUrl?: string | null
  couponId?: string | null
  timezone?: string
  creativeAssets?: CreativeAsset[]
  products?: { productId: string }[]
  channels?: { channel: SocialPlatform; connectionId?: string | null; messageOverride?: string | null; hashtags?: string[]; creativeAssetKey?: string | null; scheduledAt?: string | null }[]
}

async function updateCampaign(id: string, data: UpdateCampaignInput) {
  return apiClient.patch<{ success: true; campaign: CampaignDetail }>(`/promotions/campaigns/${id}`, data)
}

export interface ChannelValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

async function validateCampaign(id: string) {
  return apiClient.post<{ success: true; results: Record<SocialPlatform, ChannelValidationResult> }>(`/promotions/campaigns/${id}/validate`, {})
}

async function scheduleCampaign(id: string, scheduledAt: string) {
  return apiClient.post<{ success: true; message: string }>(`/promotions/campaigns/${id}/schedule`, { scheduledAt })
}

async function publishCampaignNow(id: string) {
  return apiClient.post<{ success: true; message: string }>(`/promotions/campaigns/${id}/publish-now`, {})
}

async function cancelCampaign(id: string) {
  return apiClient.post<{ success: true; message: string }>(`/promotions/campaigns/${id}/cancel`, {})
}

export interface CampaignChannelMetrics {
  channel: SocialPlatform
  status: ChannelPostStatus
  remotePermalink: string | null
  dryRun: boolean
  metrics: {
    impressions: number | null
    reach: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    clicks: number | null
    capturedAt: string
  } | null
}

async function getCampaignMetrics(id: string) {
  return apiClient.get<{ success: true; channels: CampaignChannelMetrics[]; dataQuality: { note: string } }>(`/promotions/campaigns/${id}/metrics`)
}

export interface CampaignActivityEntry {
  id: string
  channelPostId: string | null
  actorUserId: string | null
  action: string
  metadata: Record<string, unknown>
  createdAt: string
}

async function getCampaignActivity(id: string) {
  return apiClient.get<{ success: true; activity: CampaignActivityEntry[] }>(`/promotions/campaigns/${id}/activity`)
}

export type ChannelResolutionOutcome = 'PUBLISHED' | 'FAILED' | 'RETRY'

/** Human resolution for a channel post stuck in REQUIRES_ACTION -- the queue never auto-retries an ambiguous outcome, so a staff member must explicitly confirm what really happened. See docs/SOCIAL-PUBLISHING-ARCHITECTURE.md §4. */
async function resolveChannelPost(campaignId: string, channelPostId: string, outcome: ChannelResolutionOutcome, details?: { remotePostId?: string; remotePermalink?: string }) {
  return apiClient.post<{ success: true; message: string }>(
    `/promotions/campaigns/${campaignId}/channels/${channelPostId}/resolve`,
    { outcome, ...details },
  )
}

// ---------- Connections ----------

export interface SocialConnection {
  id: string
  platform: SocialPlatform
  displayName: string | null
  externalAccountId: string | null
  status: string
  scopes: string[]
  connectedAt: string | null
  lastValidatedAt: string | null
  lastError: string | null
  disabledByAdmin: boolean
  tokenExpiresAt: string | null
  metadata: Record<string, unknown>
}

async function listConnections() {
  return apiClient.get<{ success: true; connections: SocialConnection[]; capabilities: PlatformCapabilities[] }>('/promotions/connections')
}

async function getCapabilities() {
  return apiClient.get<{ success: true; capabilities: PlatformCapabilities[] }>('/promotions/connections/capabilities')
}

async function startOAuth(platform: SocialPlatform, redirectUri: string) {
  return apiClient.post<{ success: true; authorizeUrl: string; state: string } | { success: false; error: string; readiness?: PlatformReadiness }>(
    `/promotions/connections/${platform.toLowerCase()}/oauth/start`,
    { redirectUri },
  )
}

async function disconnectConnection(id: string) {
  return apiClient.delete<{ success: true; message: string }>(`/promotions/connections/${id}`)
}

async function disableConnection(id: string, disabled: boolean) {
  return apiClient.post<{ success: true }>(`/promotions/connections/${id}/disable`, { disabled })
}

export const promotionService = {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  validateCampaign,
  scheduleCampaign,
  publishCampaignNow,
  cancelCampaign,
  getCampaignMetrics,
  getCampaignActivity,
  resolveChannelPost,
  listConnections,
  getCapabilities,
  startOAuth,
  disconnectConnection,
  disableConnection,
}

export default promotionService
