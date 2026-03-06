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

export interface CustomerFilters {
  page?: number
  limit?: number
  search?: string
  status?: 'active' | 'inactive' | ''
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
   * Get customer statistics for dashboard cards
   */
  async getStats(): Promise<ApiResponse<CustomerStats>> {
    return apiClient.get<ApiResponse<CustomerStats>>('/admin/customers/stats')
  },

  /**
   * Get all customers with pagination and filters
   */
  async getCustomers(
    filters?: CustomerFilters,
  ): Promise<PaginatedCustomersResponse> {
    const params = new URLSearchParams()

    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.search) params.append('search', filters.search)
    if (filters?.status) params.append('status', filters.status)
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
   * Update customer status (activate/deactivate)
   */
  async updateCustomerStatus(
    customerId: string,
    isActive: boolean,
  ): Promise<ApiResponse<{ customer: Customer }>> {
    return apiClient.patch<ApiResponse<{ customer: Customer }>>(
      `/admin/customers/${customerId}/status`,
      { isActive },
    )
  },

  /**
   * Delete customer
   */
  async deleteCustomer(customerId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(`/admin/customers/${customerId}`)
  },
}

export default customerService
