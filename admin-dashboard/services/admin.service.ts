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
    return await apiClient.get('/admin', { params })
  },

  // Get admin by ID
  async getAdmin(id: string) {
    return await apiClient.get(`/admin/${id}`)
  },

  // Invite new admin
  async inviteAdmin(inviteData: {
    email: string
    firstName: string
    lastName: string
    role: 'admin' | 'super_admin'
  }) {
    return await apiClient.post('/admin/invite', inviteData)
  },

  // Update admin
  async updateAdmin(
    id: string,
    updateData: {
      firstName?: string
      lastName?: string
      role?: 'admin' | 'super_admin'
      status?: 'active' | 'inactive' | 'suspended'
    },
  ) {
    return await apiClient.put(`/admin/${id}`, updateData)
  },

  // Delete admin
  async deleteAdmin(id: string) {
    return await apiClient.delete(`/admin/${id}`)
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
    return await apiClient.get('/admin/activity-logs', { params })
  },

  // Get admin permissions
  async getPermissions() {
    return await apiClient.get('/admin/permissions')
  },

  // Get current admin's permissions
  async getMyPermissions() {
    return await apiClient.get('/admin/me/permissions')
  },
}
