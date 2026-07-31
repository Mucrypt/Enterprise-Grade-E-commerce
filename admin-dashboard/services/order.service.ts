import { apiClient } from '@/lib/api-client'
import { ApiResponse } from '@/types'

export interface Order {
  id: string
  order_number: string
  user_id: string | null
  order_status:
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded'
  payment_status:
    | 'pending'
    | 'authorized'
    | 'paid'
    | 'partially_refunded'
    | 'refunded'
    | 'failed'
    | 'cancelled'
  total_amount: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  grand_total: number
  currency: string
  shipping_address: ShippingAddress
  billing_address?: ShippingAddress
  customer_notes?: string
  internal_notes?: string
  payment_method?: string
  payment_gateway?: string
  transaction_id?: string
  estimated_delivery_date?: string
  actual_delivery_date?: string
  cancelled_at?: string
  cancelled_reason?: string
  created_at: string
  updated_at: string
  // Joined fields
  customer_email?: string
  customer_first_name?: string
  customer_last_name?: string
  customer_phone?: string
  item_count?: number
  items?: OrderItem[]
  payments?: Payment[]
}

export interface ShippingAddress {
  first_name: string
  last_name: string
  company?: string
  address_line_1: string
  address_line_2?: string
  city: string
  state: string
  postal_code: string
  country: string
  phone?: string
  tracking_number?: string
  carrier?: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variation_id?: string
  supplier_id?: string
  supplier_name?: string | null
  sku: string
  product_name: string
  quantity: number
  unit_price: number
  tax_rate: number
  discount_amount: number
  total_price: number
  item_status: 'pending' | 'allocated' | 'shipped' | 'delivered' | 'cancelled'
  tracking_number?: string
  carrier?: string
  shipped_at?: string
  delivered_at?: string
  created_at: string
  product_image?: string
}

export interface Payment {
  id: string
  order_id: string
  payment_method: string
  payment_gateway: string
  transaction_id?: string
  amount: number
  currency: string
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'refunded'
    | 'cancelled'
  gateway_response?: Record<string, any>
  refund_amount: number
  refund_reason?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export interface OrderStats {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  todayOrders: number
  todayRevenue: number
  statusCounts: Record<string, number>
  paymentCounts: Record<string, number>
}

export interface OrderFilters {
  page?: number
  limit?: number
  search?: string
  orderStatus?: string
  paymentStatus?: string
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface OrdersResponse {
  orders: Order[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

class OrderService {
  // Get orders with filters (admin)
  async getOrders(
    filters: OrderFilters = {},
  ): Promise<ApiResponse<OrdersResponse>> {
    const params = new URLSearchParams()

    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))
    if (filters.search) params.append('search', filters.search)
    if (filters.orderStatus) params.append('orderStatus', filters.orderStatus)
    if (filters.paymentStatus)
      params.append('paymentStatus', filters.paymentStatus)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.minAmount) params.append('minAmount', String(filters.minAmount))
    if (filters.maxAmount) params.append('maxAmount', String(filters.maxAmount))
    if (filters.sortBy) params.append('sortBy', filters.sortBy)
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)

    return apiClient.get<ApiResponse<OrdersResponse>>(
      `/orders/admin/list?${params.toString()}`,
    )
  }

  // Get single order with items (admin)
  async getOrder(id: string): Promise<ApiResponse<{ order: Order }>> {
    return apiClient.get<ApiResponse<{ order: Order }>>(
      `/orders/admin/${id}`,
    )
  }

  // Get order statistics (admin)
  async getStats(): Promise<ApiResponse<{ stats: OrderStats }>> {
    return apiClient.get<ApiResponse<{ stats: OrderStats }>>(
      '/orders/admin/stats',
    )
  }

  // Update order status
  async updateStatus(
    id: string,
    status: string,
    internalNotes?: string,
  ): Promise<ApiResponse<{ order: Order }>> {
    return apiClient.put<ApiResponse<{ order: Order }>>(
      `/orders/admin/${id}/status`,
      {
        status,
        internalNotes,
      },
    )
  }

  // Bulk update order status
  async bulkUpdateStatus(
    orderIds: string[],
    status: string,
    internalNotes?: string,
  ): Promise<ApiResponse<{ updatedCount: number; updatedIds: string[] }>> {
    return apiClient.put<ApiResponse<{ updatedCount: number; updatedIds: string[] }>>(
      '/orders/admin/bulk-status',
      {
        orderIds,
        status,
        internalNotes,
      },
    )
  }

  // Update shipping information
  async updateShipping(
    id: string,
    data: {
      trackingNumber?: string
      carrier?: string
      estimatedDeliveryDate?: string
    },
  ): Promise<ApiResponse<{ order: Order }>> {
    return apiClient.put<ApiResponse<{ order: Order }>>(
      `/orders/admin/${id}/shipping`,
      data,
    )
  }

  // Export orders
  async exportOrders(
    filters: {
      startDate?: string
      endDate?: string
      orderStatus?: string
      format?: 'json' | 'csv'
    } = {},
  ): Promise<Blob | ApiResponse<{ orders: Order[]; exportedAt: string; count: number }>> {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.orderStatus) params.append('orderStatus', filters.orderStatus)
    if (filters.format) params.append('format', filters.format)

    if (filters.format === 'csv') {
      return apiClient.get<Blob>(
        `/orders/admin/export?${params.toString()}`,
        {
          responseType: 'blob',
        },
      )
    }

    return apiClient.get<ApiResponse<{ orders: Order[]; exportedAt: string; count: number }>>(
      `/orders/admin/export?${params.toString()}`,
    )
  }

  // Create refund for an order (Stripe integration)
  async createRefund(
    orderId: string,
    amount?: number,
    reason?: string,
  ): Promise<ApiResponse<{ refundId: string; amount: number; status: string }>> {
    return apiClient.post<ApiResponse<{ refundId: string; amount: number; status: string }>>(
      '/payments/refund',
      {
        orderId,
        amount,
        reason,
      },
    )
  }
}

export const orderService = new OrderService()
