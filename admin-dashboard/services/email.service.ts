import { apiClient } from '@/lib/api-client'
import { ApiResponse } from '@/types'

// =====================================================
// Email Types
// =====================================================

export interface EmailMessage {
  id: string
  order_id?: string
  recipient_email: string
  recipient_name?: string
  email_type: 'order_confirmation' | 'order_status' | 'shipping_update' | 'delivery_confirmation' | 'welcome' | 'password_reset' | 'verification' | 'promotional' | 'custom'
  subject: string
  body_html?: string
  body_text?: string
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed'
  smtp_message_id?: string
  error_message?: string
  from_email?: string
  from_name?: string
  reply_to?: string
  cc?: string
  bcc?: string
  sent_at?: string
  opened_at?: string
  clicked_at?: string
  created_at: string
  updated_at: string
  // Joined fields
  order_number?: string
  order_first_name?: string
  order_last_name?: string
}

export interface EmailStats {
  total: number
  sent: number
  delivered: number
  bounced: number
  failed: number
  todayCount: number
  weekCount: number
  byType: Record<string, number>
}

export interface EmailSettings {
  [key: string]: {
    value: string
    description: string
    isEncrypted: boolean
  }
}

export interface EmailTemplate {
  id: string
  name: string
  template_key: string
  subject: string
  body_html: string
  body_text?: string
  variables?: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailAlias {
  id: string
  alias_email: string
  alias_name: string
  purpose: string
  smtp_host?: string
  smtp_port?: number
  smtp_secure?: boolean
  smtp_user?: string
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at?: string
}

export interface EmailFilters {
  page?: number
  limit?: number
  status?: string
  emailType?: string
  search?: string
  startDate?: string
  endDate?: string
}

export interface EmailMessagesResponse {
  messages: EmailMessage[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// =====================================================
// Email Service
// =====================================================

class EmailService {
  // =====================================================
  // Messages
  // =====================================================

  /**
   * Get email messages with filters
   */
  async getMessages(filters: EmailFilters = {}): Promise<ApiResponse<EmailMessagesResponse>> {
    const params = new URLSearchParams()

    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))
    if (filters.status) params.append('status', filters.status)
    if (filters.emailType) params.append('emailType', filters.emailType)
    if (filters.search) params.append('search', filters.search)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    return apiClient.get<ApiResponse<EmailMessagesResponse>>(
      `/emails/messages?${params.toString()}`
    )
  }

  /**
   * Get message statistics
   */
  async getStats(): Promise<ApiResponse<{ stats: EmailStats }>> {
    return apiClient.get<ApiResponse<{ stats: EmailStats }>>('/emails/messages/stats')
  }

  /**
   * Send a custom email
   */
  async sendEmail(data: {
    to: string
    toName?: string
    subject: string
    html: string
    text?: string
    replyTo?: string
    cc?: string
    bcc?: string
    orderId?: string
    emailType?: string
    fromAlias?: string
  }): Promise<ApiResponse<{ messageId: string }>> {
    return apiClient.post<ApiResponse<{ messageId: string }>>('/emails/messages/send', data)
  }

  /**
   * Resend a failed email
   */
  async resendEmail(id: string): Promise<ApiResponse<void>> {
    return apiClient.post<ApiResponse<void>>(`/emails/messages/${id}/resend`)
  }

  /**
   * Get configuration status
   */
  async getConfigStatus(): Promise<ApiResponse<{
    isConfigured: boolean
    provider: string
  }>> {
    return apiClient.get<ApiResponse<{
      isConfigured: boolean
      provider: string
    }>>('/emails/config/status')
  }

  // =====================================================
  // Settings
  // =====================================================

  /**
   * Get email settings
   */
  async getSettings(): Promise<ApiResponse<{
    settings: EmailSettings
    isConfigured: boolean
  }>> {
    return apiClient.get<ApiResponse<{
      settings: EmailSettings
      isConfigured: boolean
    }>>('/emails/settings')
  }

  /**
   * Update email settings
   */
  async updateSettings(settings: Record<string, string>): Promise<ApiResponse<void>> {
    return apiClient.put<ApiResponse<void>>('/emails/settings', { settings })
  }

  // =====================================================
  // Aliases
  // =====================================================

  /**
   * Get all email aliases
   */
  async getAliases(): Promise<ApiResponse<{ aliases: EmailAlias[] }>> {
    return apiClient.get<ApiResponse<{ aliases: EmailAlias[] }>>('/emails/aliases')
  }

  /**
   * Create a new alias
   */
  async createAlias(data: {
    aliasEmail: string
    aliasName: string
    purpose: string
    smtpHost?: string
    smtpPort?: number
    smtpSecure?: boolean
    smtpUser?: string
    smtpPass?: string
    isDefault?: boolean
  }): Promise<ApiResponse<{ alias: EmailAlias }>> {
    return apiClient.post<ApiResponse<{ alias: EmailAlias }>>('/emails/aliases', data)
  }

  /**
   * Update an alias
   */
  async updateAlias(
    id: string,
    data: {
      aliasName?: string
      purpose?: string
      smtpHost?: string
      smtpPort?: number
      smtpSecure?: boolean
      smtpUser?: string
      smtpPass?: string
      isActive?: boolean
      isDefault?: boolean
    }
  ): Promise<ApiResponse<{ alias: EmailAlias }>> {
    return apiClient.put<ApiResponse<{ alias: EmailAlias }>>(`/emails/aliases/${id}`, data)
  }

  /**
   * Delete an alias
   */
  async deleteAlias(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(`/emails/aliases/${id}`)
  }

  /**
   * Test an alias configuration
   */
  async testAlias(id: string, testEmail: string): Promise<ApiResponse<void>> {
    return apiClient.post<ApiResponse<void>>(`/emails/aliases/${id}/test`, { testEmail })
  }

  // =====================================================
  // Templates
  // =====================================================

  /**
   * Get all templates
   */
  async getTemplates(): Promise<ApiResponse<{ templates: EmailTemplate[] }>> {
    return apiClient.get<ApiResponse<{ templates: EmailTemplate[] }>>('/emails/templates')
  }

  /**
   * Create a new template
   */
  async createTemplate(data: {
    name: string
    templateKey: string
    subject: string
    bodyHtml: string
    bodyText?: string
    variables?: string[]
  }): Promise<ApiResponse<{ template: EmailTemplate }>> {
    return apiClient.post<ApiResponse<{ template: EmailTemplate }>>('/emails/templates', data)
  }

  /**
   * Update a template
   */
  async updateTemplate(
    id: string,
    data: {
      name?: string
      subject?: string
      bodyHtml?: string
      bodyText?: string
      variables?: string[]
      isActive?: boolean
    }
  ): Promise<ApiResponse<{ template: EmailTemplate }>> {
    return apiClient.put<ApiResponse<{ template: EmailTemplate }>>(`/emails/templates/${id}`, data)
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(`/emails/templates/${id}`)
  }
}

export const emailService = new EmailService()
export default emailService
