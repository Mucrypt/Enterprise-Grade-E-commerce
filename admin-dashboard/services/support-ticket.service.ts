// Admin-side seller support ticketing -- a real threaded conversation,
// distinct from the older customer /contact form (which is just rows in
// email_messages with no real thread/status/assignment model). Finally
// puts the support.view/support.manage permissions to use.

import apiClient from '@/lib/api-client'

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type SupportTicketCategory = 'payouts' | 'verification' | 'product_listing' | 'technical' | 'other'

export interface SupportTicket {
  id: string
  seller_profile_id: string
  user_id: string
  subject: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  priority: 'low' | 'normal' | 'high'
  assigned_to_user_id: string | null
  created_at: string
  updated_at: string
  last_message_at: string
  resolved_at: string | null
  seller_display_name?: string | null
  seller_handle?: string | null
}

export interface SupportMessage {
  id: string
  ticket_id: string
  sender_type: 'seller' | 'staff'
  sender_user_id: string
  body: string
  is_internal_note: boolean
  created_at: string
}

export const supportTicketService = {
  // Admin proactively opens a ticket on a seller's behalf -- distinct
  // from every other method here, which acts on a ticket the seller
  // already opened themselves.
  async createForSeller(payload: {
    sellerProfileId: string
    subject: string
    category?: SupportTicketCategory
    body: string
  }) {
    return await apiClient.post<{
      success: boolean
      data: { ticket: SupportTicket; message: SupportMessage }
    }>('/admin/support-tickets', payload)
  },

  async list(params?: {
    page?: number
    limit?: number
    status?: SupportTicketStatus
    assignedToUserId?: string
    category?: SupportTicketCategory
    search?: string
  }) {
    return await apiClient.get<{
      success: boolean
      data: {
        items: SupportTicket[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }
    }>('/admin/support-tickets', { params })
  },

  async getById(id: string) {
    return await apiClient.get<{
      success: boolean
      data: { ticket: SupportTicket; messages: SupportMessage[] }
    }>(`/admin/support-tickets/${id}`)
  },

  async reply(id: string, payload: { body: string; isInternalNote?: boolean }) {
    return await apiClient.post<{ success: boolean; data: { message: SupportMessage } }>(
      `/admin/support-tickets/${id}/messages`,
      payload,
    )
  },

  async assign(id: string, userId: string | null) {
    return await apiClient.patch(`/admin/support-tickets/${id}/assign`, { userId })
  },

  async updateStatus(id: string, status: SupportTicketStatus) {
    return await apiClient.patch(`/admin/support-tickets/${id}/status`, { status })
  },

  async getReportingSummary(params?: { from?: string; to?: string }) {
    return await apiClient.get<{ success: boolean; data: SupportReportingSummary }>(
      '/admin/support-tickets/reporting',
      { params },
    )
  },
}

export interface SupportReportingSummary {
  byStatus: { status: SupportTicketStatus; count: number }[]
  byCategory: { category: SupportTicketCategory; count: number }[]
  averageFirstReplyHours: number | null
  ticketsPerStaffMember: { userId: string; name: string; count: number }[]
}

export default supportTicketService
