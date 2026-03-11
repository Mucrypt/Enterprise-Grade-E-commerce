import { apiClient } from '@/lib/api-client'
import { ApiResponse } from '@/types'

// =====================================================
// WhatsApp Types
// =====================================================

export interface WhatsAppMessage {
  id: string
  order_id?: string
  recipient_phone: string
  message_type: 'order_confirmation' | 'order_status' | 'shipping_update' | 'delivery_confirmation' | 'custom'
  message_content: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  provider_message_id?: string
  error_message?: string
  sent_at?: string
  delivered_at?: string
  read_at?: string
  created_at: string
  updated_at: string
  // Joined fields
  order_number?: string
  customer_first_name?: string
  customer_last_name?: string
}

export interface WhatsAppStats {
  total: number
  sent: number
  delivered: number
  read: number
  failed: number
  todayCount: number
  weekCount: number
}

export interface WhatsAppSettings {
  [key: string]: {
    value: string
    description: string
    isEncrypted: boolean
  }
}

export interface WhatsAppTemplate {
  id: string
  name: string
  template_key: string
  message_content: string
  variables?: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WhatsAppFilters {
  page?: number
  limit?: number
  status?: string
  messageType?: string
  search?: string
  startDate?: string
  endDate?: string
}

export interface WhatsAppMessagesResponse {
  messages: WhatsAppMessage[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// =====================================================
// WhatsApp Service
// =====================================================

class WhatsAppService {
  // =====================================================
  // Messages
  // =====================================================

  /**
   * Get WhatsApp messages with filters
   */
  async getMessages(filters: WhatsAppFilters = {}): Promise<ApiResponse<WhatsAppMessagesResponse>> {
    const params = new URLSearchParams()

    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))
    if (filters.status) params.append('status', filters.status)
    if (filters.messageType) params.append('messageType', filters.messageType)
    if (filters.search) params.append('search', filters.search)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    return apiClient.get<ApiResponse<WhatsAppMessagesResponse>>(
      `/whatsapp/messages?${params.toString()}`
    )
  }

  /**
   * Get message statistics
   */
  async getStats(): Promise<ApiResponse<{ stats: WhatsAppStats }>> {
    return apiClient.get<ApiResponse<{ stats: WhatsAppStats }>>('/whatsapp/messages/stats')
  }

  /**
   * Get a single message by ID
   */
  async getMessage(id: string): Promise<ApiResponse<{ message: WhatsAppMessage }>> {
    return apiClient.get<ApiResponse<{ message: WhatsAppMessage }>>(`/whatsapp/messages/${id}`)
  }

  /**
   * Send a custom WhatsApp message
   */
  async sendMessage(data: {
    recipientPhone: string
    message: string
    orderId?: string
  }): Promise<ApiResponse<{ messageId: string }>> {
    return apiClient.post<ApiResponse<{ messageId: string }>>('/whatsapp/messages/send', data)
  }

  /**
   * Resend a failed message
   */
  async resendMessage(id: string): Promise<ApiResponse<void>> {
    return apiClient.post<ApiResponse<void>>(`/whatsapp/messages/${id}/resend`)
  }

  /**
   * Send WhatsApp notification to an order
   */
  async sendToOrder(
    orderId: string,
    messageType: 'order_confirmation' | 'order_status' | 'shipping_update' | 'delivery_confirmation'
  ): Promise<ApiResponse<void>> {
    return apiClient.post<ApiResponse<void>>(`/whatsapp/orders/${orderId}/send`, { messageType })
  }

  // =====================================================
  // Settings
  // =====================================================

  /**
   * Get WhatsApp settings
   */
  async getSettings(): Promise<ApiResponse<{
    settings: WhatsAppSettings
    isConfigured: boolean
    provider: string
  }>> {
    return apiClient.get<ApiResponse<{
      settings: WhatsAppSettings
      isConfigured: boolean
      provider: string
    }>>('/whatsapp/settings')
  }

  /**
   * Update WhatsApp settings
   */
  async updateSettings(settings: Record<string, string>): Promise<ApiResponse<void>> {
    return apiClient.put<ApiResponse<void>>('/whatsapp/settings', { settings })
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
    }>>('/whatsapp/config/status')
  }

  // =====================================================
  // Templates
  // =====================================================

  /**
   * Get all templates
   */
  async getTemplates(): Promise<ApiResponse<{ templates: WhatsAppTemplate[] }>> {
    return apiClient.get<ApiResponse<{ templates: WhatsAppTemplate[] }>>('/whatsapp/templates')
  }

  /**
   * Get a single template
   */
  async getTemplate(id: string): Promise<ApiResponse<{ template: WhatsAppTemplate }>> {
    return apiClient.get<ApiResponse<{ template: WhatsAppTemplate }>>(`/whatsapp/templates/${id}`)
  }

  /**
   * Create a new template
   */
  async createTemplate(data: {
    name: string
    templateKey: string
    messageContent: string
    variables?: string[]
  }): Promise<ApiResponse<{ template: WhatsAppTemplate }>> {
    return apiClient.post<ApiResponse<{ template: WhatsAppTemplate }>>('/whatsapp/templates', data)
  }

  /**
   * Update a template
   */
  async updateTemplate(
    id: string,
    data: {
      name?: string
      messageContent?: string
      variables?: string[]
      isActive?: boolean
    }
  ): Promise<ApiResponse<{ template: WhatsAppTemplate }>> {
    return apiClient.put<ApiResponse<{ template: WhatsAppTemplate }>>(`/whatsapp/templates/${id}`, data)
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(`/whatsapp/templates/${id}`)
  }
}

export const whatsappService = new WhatsAppService()
export default whatsappService
