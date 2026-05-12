import { apiClient } from '@/lib/api-client'
import { ApiResponse } from '@/types'

// =====================================================
// Newsletter Types
// =====================================================

export interface NewsletterSubscriber {
  id: string
  email: string
  name?: string
  status: 'active' | 'unsubscribed' | 'bounced'
  source: 'website' | 'checkout' | 'popup' | 'footer' | 'import' | 'admin'
  ip_address?: string
  user_agent?: string
  confirmed_at?: string
  unsubscribed_at?: string
  created_at: string
  updated_at: string
}

export interface NewsletterStats {
  total: number
  active: number
  unsubscribed: number
  bounced: number
  today: number
  thisWeek: number
  thisMonth: number
  bySource: Record<string, number>
  growth: Array<{
    date: string
    subscribed: number
    unsubscribed: number
  }>
}

export interface NewsletterCampaign {
  id: string
  name: string
  subject: string
  content_html: string
  content_text?: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
  scheduled_at?: string
  sent_at?: string
  total_recipients: number
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
  unsubscribed_count: number
  created_by?: string
  rate_limit_per_minute?: number
  max_retries?: number
  retry_backoff_seconds?: number
  ab_test_enabled?: boolean
  subject_a?: string
  subject_b?: string
  content_html_a?: string
  content_html_b?: string
  content_text_a?: string
  content_text_b?: string
  segment_a?: {
    sources?: string[]
    statuses?: string[]
  }
  segment_b?: {
    sources?: string[]
    statuses?: string[]
  }
  created_at: string
  updated_at: string
}

export interface DeliverabilityDashboard {
  window: string
  totals: {
    total: number
    sent: number
    delivered: number
    bounced: number
    failed: number
    complaints: number
    bounceRate: number
    complaintRate: number
  }
  domainHealth: {
    fromDomain: string
    score: number
    label: 'healthy' | 'warning' | 'critical'
    checks: {
      spf: boolean
      dkim: boolean
      dmarc: boolean
    }
  }
  domains: Array<{
    domain: string
    total: number
    sent: number
    bounced: number
    failed: number
  }>
  abPerformance: Array<{
    variant_key: 'A' | 'B'
    recipients: number
    sent: number
    bounced: number
    opened: number
    clicked: number
  }>
}

export interface NewsletterSettings {
  [key: string]: {
    value: string
    description: string
  }
}

export interface SubscriberFilters {
  page?: number
  limit?: number
  status?: string
  source?: string
  search?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface SubscribersResponse {
  subscribers: NewsletterSubscriber[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CampaignsResponse {
  campaigns: NewsletterCampaign[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CampaignStats {
  campaign: NewsletterCampaign
  stats: {
    pending: number
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    unsubscribed: number
  }
}

// =====================================================
// Newsletter Service Class
// =====================================================

class NewsletterService {
  // =====================================================
  // Subscriber Management
  // =====================================================

  /**
   * Get all subscribers with pagination and filters
   */
  async getSubscribers(
    filters: SubscriberFilters = {},
  ): Promise<ApiResponse<SubscribersResponse>> {
    const params = new URLSearchParams()

    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))
    if (filters.status) params.append('status', filters.status)
    if (filters.source) params.append('source', filters.source)
    if (filters.search) params.append('search', filters.search)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.sortBy) params.append('sortBy', filters.sortBy)
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)

    return apiClient.get<ApiResponse<SubscribersResponse>>(
      `/newsletter/subscribers?${params.toString()}`,
    )
  }

  /**
   * Get subscriber statistics
   */
  async getSubscriberStats(): Promise<ApiResponse<{ stats: NewsletterStats }>> {
    return apiClient.get<ApiResponse<{ stats: NewsletterStats }>>(
      '/newsletter/subscribers/stats',
    )
  }

  /**
   * Get subscriber by ID
   */
  async getSubscriberById(
    id: string,
  ): Promise<ApiResponse<{ subscriber: NewsletterSubscriber }>> {
    return apiClient.get<ApiResponse<{ subscriber: NewsletterSubscriber }>>(
      `/newsletter/subscribers/${id}`,
    )
  }

  /**
   * Update subscriber
   */
  async updateSubscriber(
    id: string,
    data: Partial<Pick<NewsletterSubscriber, 'email' | 'name' | 'status'>>,
  ): Promise<ApiResponse<{ subscriber: NewsletterSubscriber }>> {
    return apiClient.put<ApiResponse<{ subscriber: NewsletterSubscriber }>>(
      `/newsletter/subscribers/${id}`,
      data,
    )
  }

  /**
   * Delete subscriber
   */
  async deleteSubscriber(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(`/newsletter/subscribers/${id}`)
  }

  /**
   * Export subscribers as CSV
   */
  async exportSubscribers(status?: string): Promise<Blob> {
    const params = status ? `?status=${status}` : ''
    const response = await apiClient.get<Blob>(
      `/newsletter/subscribers/export${params}`,
      {
        responseType: 'blob',
      },
    )
    return response as unknown as Blob
  }

  /**
   * Import subscribers
   */
  async importSubscribers(
    subscribers: Array<{ email: string; name?: string }>,
  ): Promise<
    ApiResponse<{ imported: number; skipped: number; errors: string[] }>
  > {
    return apiClient.post<
      ApiResponse<{ imported: number; skipped: number; errors: string[] }>
    >('/newsletter/subscribers/import', { subscribers })
  }

  // =====================================================
  // Campaign Management
  // =====================================================

  /**
   * Get all campaigns with pagination
   */
  async getCampaigns(
    page = 1,
    limit = 20,
    status?: string,
  ): Promise<ApiResponse<CampaignsResponse>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })
    if (status) params.append('status', status)

    return apiClient.get<ApiResponse<CampaignsResponse>>(
      `/newsletter/campaigns?${params.toString()}`,
    )
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(
    id: string,
  ): Promise<ApiResponse<{ campaign: NewsletterCampaign }>> {
    return apiClient.get<ApiResponse<{ campaign: NewsletterCampaign }>>(
      `/newsletter/campaigns/${id}`,
    )
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(id: string): Promise<ApiResponse<CampaignStats>> {
    return apiClient.get<ApiResponse<CampaignStats>>(
      `/newsletter/campaigns/${id}/stats`,
    )
  }

  /**
   * Create a new campaign
   */
  async createCampaign(data: {
    name: string
    subject: string
    contentHtml: string
    contentText?: string
    scheduledAt?: string
    rateLimitPerMinute?: number
    maxRetries?: number
    retryBackoffSeconds?: number
    abTestEnabled?: boolean
    subjectA?: string
    subjectB?: string
    contentHtmlA?: string
    contentHtmlB?: string
    contentTextA?: string
    contentTextB?: string
    segmentA?: {
      sources?: string[]
      statuses?: string[]
    }
    segmentB?: {
      sources?: string[]
      statuses?: string[]
    }
  }): Promise<ApiResponse<{ campaign: NewsletterCampaign }>> {
    return apiClient.post<ApiResponse<{ campaign: NewsletterCampaign }>>(
      '/newsletter/campaigns',
      data,
    )
  }

  /**
   * Update campaign
   */
  async updateCampaign(
    id: string,
    data: Partial<{
      name: string
      subject: string
      contentHtml: string
      contentText?: string
      scheduledAt?: string
      status: string
      rateLimitPerMinute?: number
      maxRetries?: number
      retryBackoffSeconds?: number
      abTestEnabled?: boolean
      subjectA?: string
      subjectB?: string
      contentHtmlA?: string
      contentHtmlB?: string
      contentTextA?: string
      contentTextB?: string
      segmentA?: {
        sources?: string[]
        statuses?: string[]
      }
      segmentB?: {
        sources?: string[]
        statuses?: string[]
      }
    }>,
  ): Promise<ApiResponse<{ campaign: NewsletterCampaign }>> {
    return apiClient.put<ApiResponse<{ campaign: NewsletterCampaign }>>(
      `/newsletter/campaigns/${id}`,
      data,
    )
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(`/newsletter/campaigns/${id}`)
  }

  /**
   * Send campaign to all active subscribers
   */
  async sendCampaign(
    id: string,
  ): Promise<ApiResponse<{ totalRecipients: number }>> {
    return apiClient.post<ApiResponse<{ totalRecipients: number }>>(
      `/newsletter/campaigns/${id}/send`,
    )
  }

  async getDeliverabilityDashboard(): Promise<
    ApiResponse<{ dashboard: DeliverabilityDashboard }>
  > {
    return apiClient.get<ApiResponse<{ dashboard: DeliverabilityDashboard }>>(
      '/newsletter/deliverability/dashboard',
    )
  }

  async recordComplaint(data: {
    recipientEmail: string
    campaignId?: string
    provider?: string
    reason?: string
    metadata?: Record<string, unknown>
  }): Promise<ApiResponse<void>> {
    return apiClient.post<ApiResponse<void>>(
      '/newsletter/deliverability/complaints',
      data,
    )
  }

  // =====================================================
  // Settings
  // =====================================================

  /**
   * Get newsletter settings
   */
  async getSettings(): Promise<ApiResponse<{ settings: NewsletterSettings }>> {
    return apiClient.get<ApiResponse<{ settings: NewsletterSettings }>>(
      '/newsletter/settings',
    )
  }

  /**
   * Update newsletter settings
   */
  async updateSettings(
    settings: Record<string, string>,
  ): Promise<ApiResponse<void>> {
    return apiClient.put<ApiResponse<void>>('/newsletter/settings', {
      settings,
    })
  }
}

// Export singleton instance
const newsletterService = new NewsletterService()
export default newsletterService
