/**
 * MOBILE APP - EVENT TYPES
 * Frontend event types for tech-tools-mobile-app
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
  | 'supplier_interaction';

export type EventSource = 'web_store' | 'mobile_app' | 'api' | 'admin_dashboard' | 'internal';
export type DeviceType = 'desktop' | 'tablet' | 'mobile' | 'unknown';

export interface BaseEvent {
  eventType: EventType;
  source: EventSource;
  deviceType?: DeviceType;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  payload?: Record<string, any>;
}

// Event-specific payloads
export interface ProductViewEvent extends BaseEvent {
  eventType: 'product_view';
  payload: {
    productId: string;
    productName: string;
    sku?: string;
    categoryId?: string;
    price?: number;
    discount?: number;
  };
}

export interface SearchEvent extends BaseEvent {
  eventType: 'search';
  payload: {
    searchQuery: string;
    resultsCount: number;
    filters?: Record<string, any>;
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
    cartValue?: number;
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
  };
}

export interface PaymentSuccessEvent extends BaseEvent {
  eventType: 'payment_success';
  payload: {
    orderId: string;
    orderValue: number;
    itemCount: number;
    paymentMethod: 'card' | 'wallet' | 'bank_transfer' | 'other';
  };
}

export type AnyEvent =
  | ProductViewEvent
  | SearchEvent
  | AddToCartEvent
  | RemoveFromCartEvent
  | CheckoutStartEvent
  | PaymentSuccessEvent
  | BaseEvent;

export interface EventContext {
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}
