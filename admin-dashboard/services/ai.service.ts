import { apiClient } from '@/lib/api-client'

// ─── Types ──────────────────────────────────────────────────
export type AiChannel = 'email' | 'whatsapp' | 'newsletter' | 'contact_reply'
export type AiDraftStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'failed'

export interface AiDraft {
  id: string
  channel: AiChannel
  status: AiDraftStatus
  recipientEmail?: string
  recipientPhone?: string
  recipientName?: string
  customerId?: string
  contactId?: string
  subject?: string
  bodyHtml?: string
  bodyText: string
  prompt: string
  modelName: string
  tokenUsage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  confidence: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface GenerateDraftPayload {
  channel: AiChannel
  prompt: string
  recipientEmail?: string
  recipientPhone?: string
  recipientName?: string
  customerId?: string
  contactId?: string
  scheduledAt?: string
}

export interface GenerateCampaignDraftPayload {
  prompt: string
  scheduledAt?: string
  segment?: {
    sources?: string[]
    statuses?: string[]
    includeUnsubscribed?: boolean
  }
  selectedProductIds?: string[]
}

export interface AiStats {
  pending: string
  approved: string
  rejected: string
  sent: string
  failed: string
  last_24h: string
  avg_confidence: string
  total_tokens_used: string
}

export interface CustomerContext {
  customer: {
    id: string
    name: string
    email: string
    phone?: string
    joinedAt: string
    totalOrders: number
    totalSpent: number
    lastOrderAt?: string
  }
  recentOrders: Array<{
    id: string
    number: string
    status: string
    total: number
    createdAt: string
    items: Array<{ name: string; quantity: number; price: number }>
  }>
  communicationHistory: Array<{
    channel: string
    direction: string
    subject?: string
    preview: string
    createdAt: string
  }>
}

export interface TimelineEvent {
  id: string
  channel: AiChannel
  direction: 'inbound' | 'outbound'
  subject?: string
  body_preview: string
  status: string
  created_at: string
}

// ─── API calls ───────────────────────────────────────────────
const aiService = {
  /** Get AI service status (configured / model) */
  getStatus: async (): Promise<{
    configured: boolean
    model: string
    status: string
  }> => {
    return apiClient.get<{ configured: boolean; model: string; status: string }>(
      '/ai/status',
    )
  },

  /** Generate an AI draft (returns pending draft for review) */
  generateDraft: async (payload: GenerateDraftPayload): Promise<AiDraft> => {
    const res = await apiClient.post<{ draft: AiDraft }>('/ai/drafts', payload)
    return res.draft
  },

  /** Generate segment-aware newsletter campaign draft */
  generateCampaignDraft: async (
    payload: GenerateCampaignDraftPayload,
  ): Promise<{ draft: AiDraft; audienceEstimate: number }> => {
    return apiClient.post<{ draft: AiDraft; audienceEstimate: number }>(
      '/ai/campaigns/generate',
      payload,
    )
  },

  /** List drafts with optional filters */
  listDrafts: async (params?: {
    status?: AiDraftStatus
    channel?: AiChannel
    page?: number
    limit?: number
  }): Promise<{ drafts: AiDraft[]; total: number }> => {
    return apiClient.get<{ drafts: AiDraft[]; total: number }>('/ai/drafts', {
      params,
    })
  },

  /** Approve a draft — triggers actual send */
  approveDraft: async (
    id: string,
    options?: { forceSend?: boolean },
  ): Promise<{ sent: boolean; message: string }> => {
    return apiClient.post<{ sent: boolean; message: string }>(
      `/ai/drafts/${id}/approve`,
      options || {},
    )
  },

  /** Reject a draft with a reason */
  rejectDraft: async (id: string, reason: string): Promise<void> => {
    await apiClient.post<void>(`/ai/drafts/${id}/reject`, { reason })
  },

  /** Load full customer context (orders, spend, history) */
  getCustomerContext: async (customerId: string): Promise<CustomerContext> => {
    const res = await apiClient.get<{ context: CustomerContext }>(
      `/ai/context/${customerId}`,
    )
    return res.context
  },

  /** Get unified communication timeline for a customer */
  getTimeline: async (
    customerId: string,
    page = 1,
    limit = 30,
  ): Promise<{ events: TimelineEvent[]; total: number }> => {
    return apiClient.get<{ events: TimelineEvent[]; total: number }>(
      `/ai/timeline/${customerId}`,
      { params: { page, limit } },
    )
  },

  /** Get AI usage stats for the dashboard */
  getStats: async (): Promise<AiStats> => {
    const res = await apiClient.get<{ stats: AiStats }>('/ai/stats')
    return res.stats
  },
}

export default aiService
