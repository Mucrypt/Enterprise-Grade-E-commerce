import { apiClient } from '@/lib/api-client'
import { ApiResponse } from '@/types'

// =====================================================
// Contact Types
// =====================================================

export interface ContactSubmission {
  id: string
  recipient_email: string
  recipient_name: string
  subject: string
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed'
  metadata: {
    ticketNumber: string
    phone?: string
    orderNumber?: string
    message: string
  }
  sent_at: string
  created_at: string
  updated_at: string
}

export interface ContactStats {
  total: number
  pending: number
  sent: number
  today: number
  thisWeek: number
}

export interface ContactFilters {
  page?: number
  limit?: number
  status?: string
  search?: string
}

export interface ContactAnalyticsTotals {
  guest_contact_cta_click: number
  protected_contact_login_redirect: number
}

export interface ContactAnalyticsDayEntry {
  day: string
  guest_contact_cta_click: number
  protected_contact_login_redirect: number
}

export interface ContactAnalyticsData {
  totals: ContactAnalyticsTotals
  last7Days: ContactAnalyticsDayEntry[]
  last30Days: ContactAnalyticsTotals
  conversionRate: number
}



class ContactService {
  private baseUrl = '/contact'

  /**
   * Get all contact form submissions
   */
  async getSubmissions(filters: ContactFilters = {}): Promise<
    ApiResponse<{
      submissions: ContactSubmission[]
      pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
      }
    }>
  > {
    const params = new URLSearchParams()
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.limit) params.append('limit', filters.limit.toString())
    if (filters.status) params.append('status', filters.status)
    if (filters.search) params.append('search', filters.search)

    return apiClient.get<
      ApiResponse<{
        submissions: ContactSubmission[]
        pagination: {
          page: number
          limit: number
          total: number
          totalPages: number
        }
      }>
    >(`${this.baseUrl}/submissions?${params.toString()}`)
  }

  /**
   * Get contact submission stats
   */
  async getStats(): Promise<ApiResponse<ContactStats>> {
    return apiClient.get<ApiResponse<ContactStats>>(`${this.baseUrl}/stats`)
  }

  /**
   * Update submission status
   */
  async updateStatus(
    id: string,
    status: string,
  ): Promise<ApiResponse<ContactSubmission>> {
    return apiClient.put<ApiResponse<ContactSubmission>>(
      `${this.baseUrl}/submissions/${id}`,
      { status },
    )
  }

  /**
   * Delete a submission
   */
  async deleteSubmission(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(
      `${this.baseUrl}/submissions/${id}`,
    )
  }

  /**
   * Export submissions to CSV
   */
  async exportSubmissions(): Promise<Blob> {
    return apiClient.get<Blob>(`${this.baseUrl}/submissions/export`, {
      responseType: 'blob',
    })
  }

  /**
   * Send an admin reply to a submission
   */
  async replyToSubmission(
    id: string,
    data: { body: string; subject?: string },
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<ApiResponse<{ message: string }>>(
      `${this.baseUrl}/submissions/${id}/reply`,
      data,
    )
  }

  /**
   * Get contact funnel analytics (hybrid policy conversion metrics)
   */
  async getAnalytics(): Promise<ApiResponse<ContactAnalyticsData>> {
    return apiClient.get<ApiResponse<ContactAnalyticsData>>(
      `${this.baseUrl}/analytics`,
    )
  }
}

const contactService = new ContactService()
export default contactService
