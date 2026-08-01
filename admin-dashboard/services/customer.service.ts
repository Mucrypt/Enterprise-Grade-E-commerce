import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

export interface Customer {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  fullName: string
  phone: string | null
  userType: string
  companyName: string | null
  businessType: string | null
  emailVerified: boolean
  phoneVerified: boolean
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
  orderCount?: number
  totalSpent?: number
}

export interface CustomerDetails extends Customer {
  taxId: string | null
  addresses: CustomerAddress[]
  recentOrders: CustomerOrder[]
  orderSummary: {
    totalOrders: number
    totalSpent: number
    averageOrder: number
  }
}

export interface CustomerAddress {
  id: string
  addressType: string
  fullName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string
  isDefault: boolean
}

export interface CustomerOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
}

export interface CustomerStats {
  total: number
  active: number
  inactive: number
  newToday: number
  newThisWeek: number
  newThisMonth: number
  emailVerified: number
  withOrders: number
}

// 'supplier' is deliberately not an option here -- dropshipping suppliers
// are a separate `suppliers` table (see the Suppliers admin page), not a
// users.user_type value; the DB's check_user_type_valid constraint only
// allows customer/admin/super_admin.
export type AccountType = 'customer' | 'admin' | 'super_admin' | 'all'

export interface CustomerFilters {
  page?: number
  limit?: number
  search?: string
  status?: 'active' | 'inactive' | ''
  userType?: AccountType
  sortBy?: 'created_at' | 'email' | 'first_name' | 'last_name' | 'last_login'
  sortOrder?: 'ASC' | 'DESC'
}

export interface PaginatedCustomersResponse {
  success: boolean
  data: {
    customers: Customer[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export const customerService = {
  /**
   * Get account statistics for dashboard cards. userType defaults to
   * 'customer' server-side if omitted; pass 'all' or a specific type to
   * match whatever the list view is currently filtered to.
   */
  async getStats(userType?: AccountType): Promise<ApiResponse<CustomerStats>> {
    const params = userType ? `?userType=${userType}` : ''
    return apiClient.get<ApiResponse<CustomerStats>>(
      `/admin/customers/stats${params}`,
    )
  },

  /**
   * Get all accounts with pagination and filters. userType lets this reach
   * supplier/admin accounts too, not just customers (defaults to
   * 'customer' server-side if omitted).
   */
  async getCustomers(
    filters?: CustomerFilters,
  ): Promise<PaginatedCustomersResponse> {
    const params = new URLSearchParams()

    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.search) params.append('search', filters.search)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.userType) params.append('userType', filters.userType)
    if (filters?.sortBy) params.append('sortBy', filters.sortBy)
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder)

    const queryString = params.toString()
    const url = `/admin/customers${queryString ? `?${queryString}` : ''}`

    return apiClient.get<PaginatedCustomersResponse>(url)
  },

  /**
   * Get single customer details
   */
  async getCustomerById(
    customerId: string,
  ): Promise<ApiResponse<{ customer: CustomerDetails }>> {
    return apiClient.get<ApiResponse<{ customer: CustomerDetails }>>(
      `/admin/customers/${customerId}`,
    )
  },

  /**
   * Update account status (activate/deactivate). reason is recorded in the
   * admin activity log for accountability -- not required, but strongly
   * recommended for deactivations.
   */
  async updateCustomerStatus(
    customerId: string,
    isActive: boolean,
    reason?: string,
  ): Promise<ApiResponse<{ customer: Customer }>> {
    return apiClient.patch<ApiResponse<{ customer: Customer }>>(
      `/admin/customers/${customerId}/status`,
      { isActive, reason },
    )
  },

  /**
   * Delete (soft-delete) an account. Always deactivates + marks deleted_at
   * server-side now, regardless of order history. reason is recorded in
   * the admin activity log.
   */
  async deleteCustomer(
    customerId: string,
    reason?: string,
  ): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(
      `/admin/customers/${customerId}`,
      { data: { reason } },
    )
  },
}

export default customerService
