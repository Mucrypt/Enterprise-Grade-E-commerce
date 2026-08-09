import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

export type StaffRole =
  | 'OWNER'
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MARKET_MANAGER'
  | 'CATALOG_MANAGER'
  | 'ORDER_MANAGER'
  | 'MARKETING_MANAGER'
  | 'SUPPORT_AGENT'

export type StaffMembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED'

export interface StaffMembership {
  id: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  legacyUserType: string
  role: StaffRole
  status: StaffMembershipStatus
  marketScope: string[] | null
  grantedBy: string | null
  grantedAt: string
  suspendedAt: string | null
  suspendedBy: string | null
  revokedAt: string | null
  revokedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface StaffAuditLogEntry {
  id: string
  action: string
  actorUserId: string | null
  targetUserId: string | null
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface MyStaffContext {
  legacyUserType: string
  memberships: Array<{ id: string; role: StaffRole; marketScope: string[] | null }>
  permissions: string[]
}

export const staffService = {
  async getMyContext(): Promise<ApiResponse<MyStaffContext>> {
    return apiClient.get<ApiResponse<MyStaffContext>>('/staff/me')
  },

  async list(params?: {
    status?: StaffMembershipStatus
    role?: StaffRole
    page?: number
    limit?: number
  }): Promise<
    ApiResponse<{
      staff: StaffMembership[]
      pagination: { page: number; limit: number; total: number }
    }>
  > {
    return apiClient.get<
      ApiResponse<{
        staff: StaffMembership[]
        pagination: { page: number; limit: number; total: number }
      }>
    >('/staff', { params })
  },

  async getById(id: string): Promise<ApiResponse<{ staff: StaffMembership }>> {
    return apiClient.get<ApiResponse<{ staff: StaffMembership }>>(`/staff/${id}`)
  },

  async grant(payload: {
    userId?: string
    email?: string
    role: StaffRole
    marketScope?: string[] | null
  }): Promise<ApiResponse<{ staff: StaffMembership }>> {
    return apiClient.post<ApiResponse<{ staff: StaffMembership }>>('/staff', payload)
  },

  async updateRole(id: string, role: StaffRole): Promise<ApiResponse<{ staff: StaffMembership }>> {
    return apiClient.patch<ApiResponse<{ staff: StaffMembership }>>(`/staff/${id}/role`, {
      role,
    })
  },

  async updateMarketScope(
    id: string,
    marketScope: string[] | null,
  ): Promise<ApiResponse<{ staff: StaffMembership }>> {
    return apiClient.patch<ApiResponse<{ staff: StaffMembership }>>(
      `/staff/${id}/market-scope`,
      { marketScope },
    )
  },

  async suspend(id: string, reason?: string): Promise<ApiResponse<{ staff: StaffMembership }>> {
    return apiClient.post<ApiResponse<{ staff: StaffMembership }>>(`/staff/${id}/suspend`, {
      reason,
    })
  },

  async reactivate(id: string): Promise<ApiResponse<{ staff: StaffMembership }>> {
    return apiClient.post<ApiResponse<{ staff: StaffMembership }>>(
      `/staff/${id}/reactivate`,
      {},
    )
  },

  async revoke(id: string, reason?: string): Promise<ApiResponse<{ staff: StaffMembership }>> {
    return apiClient.post<ApiResponse<{ staff: StaffMembership }>>(`/staff/${id}/revoke`, {
      reason,
    })
  },

  async getAuditLog(id: string, limit = 50): Promise<ApiResponse<{ entries: StaffAuditLogEntry[] }>> {
    return apiClient.get<ApiResponse<{ entries: StaffAuditLogEntry[] }>>(
      `/staff/${id}/audit-log`,
      { params: { limit } },
    )
  },
}

export default staffService
