/**
 * UNIFIED EVENT TRACKING TYPES
 * Contract for all events across web, mobile, and API
 */

// Event type union for strict typing
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
  | 'supplier_interaction';

// Event source - where the event originated
export type EventSource = 'web_store' | 'mobile_app' | 'api' | 'admin_dashboard' | 'internal';

// Device type for tracking
export type DeviceType = 'desktop' | 'tablet' | 'mobile' | 'unknown';

/**
 * Base event structure - all events must include these
 */
export interface BaseEvent {
  eventType: EventType;
  source: EventSource;
  deviceType?: DeviceType;
  timestamp: Date;
  userId?: string; // UUID, nullable for guests
  sessionId?: string; // Session ID for tracking user journey
  payload?: Record<string, any>; // Event-specific data
}

/**
 * Context required to track event (IP, user agent, etc.)
 */
export interface EventContext {
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

/**
 * Event-specific payloads for type safety
 */

// Commerce Events
export interface ProductViewEvent extends BaseEvent {
  eventType: 'product_view';
  payload: {
    productId: string;
    productName: string;
    sku?: string;
    categoryId?: string;
    price?: number;
    discount?: number;
    timeOnProduct?: number; // milliseconds
  };
}

export interface SearchEvent extends BaseEvent {
  eventType: 'search';
  payload: {
    searchQuery: string;
    resultsCount: number;
    filters?: Record<string, any>;
    sortBy?: string;
  };
}

export interface AddToCartEvent extends BaseEvent {
  eventType: 'add_to_cart';
  payload: {
    productId: string;
    productName: string;
    sku?: string;
    price: number;
    quantity: number;
    discount?: number;
    cartValue?: number; // Total cart value after addition
    cartItemCount?: number;
  };
}

export interface RemoveFromCartEvent extends BaseEvent {
  eventType: 'remove_from_cart';
  payload: {
    productId: string;
    productName: string;
    sku?: string;
    price: number;
    quantity: number;
    reason?: 'user_action' | 'expiry' | 'out_of_stock';
  };
}

export interface CheckoutStartEvent extends BaseEvent {
  eventType: 'checkout_start';
  payload: {
    cartValue: number;
    itemCount: number;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    promoCodeApplied?: boolean;
    discountAmount?: number;
  };
}

export interface PaymentSuccessEvent extends BaseEvent {
  eventType: 'payment_success';
  payload: {
    orderId: string;
    orderValue: number;
    itemCount: number;
    paymentMethod: 'card' | 'wallet' | 'bank_transfer' | 'other';
    transactionId?: string;
    processingTime?: number; // milliseconds
  };
}

export interface OrderCreatedEvent extends BaseEvent {
  eventType: 'order_created';
  payload: {
    orderId: string;
    orderValue: number;
    itemCount: number;
    items: Array<{
      productId: string;
      sku?: string;
      quantity: number;
      price: number;
    }>;
    shippingAddress?: {
      country: string;
      region: string;
    };
    supplierId?: string;
  };
}

export interface RefundCreatedEvent extends BaseEvent {
  eventType: 'refund_created';
  payload: {
    orderId: string;
    refundId: string;
    refundAmount: number;
    reason: string;
    itemsRefunded: number;
  };
}

export interface ReturnRequestedEvent extends BaseEvent {
  eventType: 'return_requested';
  payload: {
    orderId: string;
    returnId: string;
    itemCount: number;
    reason: string;
    estimatedRefund: number;
  };
}

export interface SupportTicketCreatedEvent extends BaseEvent {
  eventType: 'support_ticket_created';
  payload: {
    ticketId: string;
    category: string;
    subject: string;
    priority: 'low' | 'medium' | 'high';
    relatedOrderId?: string;
  };
}

// Additional Events
export interface ProductFavoriteEvent extends BaseEvent {
  eventType: 'product_favorite';
  payload: {
    productId: string;
    productName: string;
    action: 'added' | 'removed';
  };
}

export interface CategoryViewEvent extends BaseEvent {
  eventType: 'category_view';
  payload: {
    categoryId: string;
    categoryName: string;
    parentCategoryId?: string;
  };
}

export interface FilterAppliedEvent extends BaseEvent {
  eventType: 'filter_applied';
  payload: {
    filterType: string;
    filterValue: any;
    resultsCount: number;
  };
}

export interface PromoCodeAppliedEvent extends BaseEvent {
  eventType: 'promo_code_applied';
  payload: {
    promoCode: string;
    discountAmount: number;
    cartValue: number;
  };
}

// Union type of all possible events for overloading
export type AnyEvent =
  | ProductViewEvent
  | SearchEvent
  | AddToCartEvent
  | RemoveFromCartEvent
  | CheckoutStartEvent
  | PaymentSuccessEvent
  | OrderCreatedEvent
  | RefundCreatedEvent
  | ReturnRequestedEvent
  | SupportTicketCreatedEvent
  | ProductFavoriteEvent
  | CategoryViewEvent
  | FilterAppliedEvent
  | PromoCodeAppliedEvent
  | BaseEvent;

/**
 * Analytics query result types
 */

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface ConversionFunnelStep {
  step: 'product_view' | 'add_to_cart' | 'checkout_start' | 'payment_success';
  eventCount: number;
  uniqueUsers: number;
  conversionRate: number; // percentage
}

export interface TopProductMetric {
  productId: string;
  productName: string;
  sku?: string;
  viewCount: number;
  addToCartCount: number;
  conversionRate: number;
  revenue: number;
}

export interface RefundMetric {
  timeframe: string;
  totalOrders: number;
  refundCount: number;
  refundRate: number; // percentage
  totalRefundAmount: number;
  averageRefundAmount: number;
}

export interface CheckoutMetrics {
  timeframe: string;
  checkoutStartCount: number;
  paymentSuccessCount: number;
  abandonmentCount: number;
  abandonmentRate: number; // percentage
}

export interface Alert {
  id: string;
  alertType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  currentValue: number;
  thresholdValue: number;
  baselineValue?: number;
  resourceType?: string;
  resourceId?: string;
  isActive: boolean;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}
