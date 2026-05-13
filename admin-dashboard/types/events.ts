/**
 * ADMIN DASHBOARD - EVENT TYPES
 * Frontend event types for admin dashboard
 * Mirrors backend contract from tech-tools-api/src/types/events.ts
 */

export type EventType =
  | 'product_view'
  | 'search'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_start'
  | 'payment_success'
  | 'order_created'
  | 'refund_created'
  | 'return_requested'
  | 'support_ticket_created'
  | 'product_favorite'
  | 'category_view'
  | 'filter_applied'
  | 'sort_applied'
  | 'checkout_abandoned'
  | 'promo_code_applied'
  | 'review_submitted'
  | 'supplier_interaction'

export type EventSource =
  | 'web_store'
  | 'mobile_app'
  | 'api'
  | 'admin_dashboard'
  | 'internal'
export type DeviceType = 'desktop' | 'tablet' | 'mobile' | 'unknown'

export interface BaseEvent {
  eventType: EventType
  source: EventSource
  deviceType?: DeviceType
  timestamp: Date
  userId?: string
  sessionId?: string
  payload?: Record<string, any>
}

// Analytics types
export interface RevenueTrendPoint {
  date: string
  revenue: number
  orderCount: number
  averageOrderValue: number
}

export interface ConversionFunnelStep {
  step: 'product_view' | 'add_to_cart' | 'checkout_start' | 'payment_success'
  eventCount: number
  uniqueUsers: number
  conversionRate: number
}

export interface TopProductMetric {
  productId: string
  productName: string
  sku?: string
  viewCount: number
  addToCartCount: number
  purchaseCount: number
  conversionRate: number
  revenue: number
}

export interface RefundMetric {
  timeframe: string
  totalOrders: number
  refundCount: number
  refundRate: number
  totalRefundAmount: number
  averageRefundAmount: number
}

export interface CheckoutMetrics {
  timeframe: string
  checkoutStartCount: number
  paymentSuccessCount: number
  abandonmentCount: number
  abandonmentRate: number
}

export interface Alert {
  id: string
  alertType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  currentValue: number
  thresholdValue: number
  baselineValue?: number
  resourceType?: string
  resourceId?: string
  isActive: boolean
  triggeredAt: Date
  acknowledgedAt?: Date
  resolvedAt?: Date
}
