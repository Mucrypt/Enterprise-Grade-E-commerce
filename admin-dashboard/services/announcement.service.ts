// Admin-side broadcast announcements to sellers -- one-to-many, in-app
// only (no bulk email yet, a deliberate scope decision -- see
// 073_seller_announcements.sql). Real per-seller read tracking, no
// fabricated "delivered" status.

import apiClient from '@/lib/api-client'

export type SellerTier = 'unverified' | 'basic' | 'trusted' | 'pro'

export interface SellerAnnouncement {
  id: string
  subject: string
  body: string
  target_tier: SellerTier | null
  created_by_admin_id: string
  created_at: string
  readCount: number
  totalRecipients: number
}

export const announcementService = {
  async list(params?: { page?: number; limit?: number }) {
    return await apiClient.get<{
      success: boolean
      data: {
        items: SellerAnnouncement[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }
    }>('/admin/announcements', { params })
  },

  async create(payload: { subject: string; body: string; targetTier?: SellerTier | null }) {
    return await apiClient.post<{ success: boolean; data: { announcement: SellerAnnouncement } }>(
      '/admin/announcements',
      payload,
    )
  },
}

export default announcementService
