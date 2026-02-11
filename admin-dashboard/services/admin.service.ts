import { apiClient } from '@/lib/api-client'

export interface Admin {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'super_admin'
  status: 'active' | 'inactive' | 'suspended'
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface AdminInvitation {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'super_admin'
  token: string
  expiresAt: string
  status: 'pending' | 'accepted' | 'expired'
  invitedBy: string
  createdAt: string
}

export interface AdminActivityLog {
  id: string
  adminId: string
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: string
  admin?: {
    email: string
    firstName: string
    lastName: string
  }
}

export interface AdminPermission {
  id: string
  name: string
  code: string
  description?: string
  category: string
}

export const adminService = {
  // Get all admins
  async getAdmins(params?: {
    role?: 'admin' | 'super_admin'
    status?: 'active' | 'inactive' | 'suspended'
    page?: number
    limit?: number
  }) {
    const { data } = await apiClient.get('/admin', { params })
    return data
  },

  // Get admin by ID
  async getAdmin(id: string) {
    const { data } = await apiClient.get(`/admin/${id}`)
    return data
  },

  // Invite new admin
  async inviteAdmin(inviteData: {
    email: string
    firstName: string
    lastName: string
    role: 'admin' | 'super_admin'
  }) {
    const { data } = await apiClient.post('/admin/invite', inviteData)
    return data
  },

  // Update admin
  async updateAdmin(
    id: string,
    updateData: {
      firstName?: string
      lastName?: string
      role?: 'admin' | 'super_admin'
      status?: 'active' | 'inactive' | 'suspended'
    }
  ) {
    const { data } = await apiClient.put(`/admin/${id}`, updateData)
    return data
  },

  // Delete admin
  async deleteAdmin(id: string) {
    const { data } = await apiClient.delete(`/admin/${id}`)
    return data
  },

  // Get admin activity logs
  async getActivityLogs(params?: {
    adminId?: string
    action?: string
    resource?: string
    startDate?: string
    endDate?: string
    page?: number
    limit?: number
  }) {
    const { data } = await apiClient.get('/admin/activity-logs', { params })
    return data
  },

  // Get admin permissions
  async getPermissions() {
    const { data } = await apiClient.get('/admin/permissions')
    return data
  },

  // Get current admin's permissions
  async getMyPermissions() {
    const { data } = await apiClient.get('/admin/me/permissions')
    return data
  },
}
