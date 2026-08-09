/**
 * MOBILE APP - EVENT TRACKING SERVICE
 * Client-side event tracking for tech-tools-mobile-app
 * Optimized for React Native and Expo
 */

import * as DeviceInfo from 'expo-device';
import { AnyEvent, EventSource, EventContext } from '../types/events';
import { API_BASE_URL } from '../config/env';

interface EventQueueItem {
  event: AnyEvent;
  context?: EventContext;
  retries: number;
}

export class MobileEventTrackingService {
  private apiUrl: string;
  private sessionId: string;
  private userId: string | null = null;
  private eventQueue: EventQueueItem[] = [];
  private batchSize: number = 10;
  private batchTimeout: number = 5000; // 5 seconds
  private batchTimer: NodeJS.Timeout | null = null;
  private deviceInfo: any = null;

  constructor(
    // Reuse the same env-resolved base URL as the real API client
    // (src/api/index.ts) instead of a second, independently-configured
    // literal, so analytics always points at the same backend as the rest
    // of the app.
    apiUrl: string = API_BASE_URL,
  ) {
    this.apiUrl = apiUrl.replace(/\/api\/v1\/?$/, '');
    this.sessionId = this.generateSessionId();
    this.initializeDeviceInfo();
  }

  /**
   * Track a single event
   */
  trackEvent(event: AnyEvent, context?: EventContext): void {
    // Add session info to event if not present
    if (!event.sessionId) {
      event.sessionId = this.sessionId;
    }
    if (!event.source) {
      event.source = 'mobile_app' as EventSource;
    }
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Add context if not provided
    if (!context) {
      context = this.getDefaultContext();
    }

    // Queue the event
    this.eventQueue.push({
      event,
      context,
      retries: 0,
    });

    // Flush queue if batch size reached
    if (this.eventQueue.length >= this.batchSize) {
      this.flushEvents();
    } else {
      // Set timer to flush if no more events come in
      this.setFlushTimer();
    }
  }

  /**
   * Set user ID for tracking logged-in users
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Clear user ID for logout
   */
  clearUserId(): void {
    this.userId = null;
  }

  /**
   * Manually flush events to server
   */
  async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    clearTimeout(this.batchTimer as NodeJS.Timeout);
    this.batchTimer = null;

    // Take a copy of the queue
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const response = await fetch(`${this.apiUrl}/api/v1/analytics/events/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: eventsToSend.map(({ event, context }) => ({
            ...event,
            context,
            userId: this.userId,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send events: ${response.status}`);
      }

      console.debug(`[EventTracking] Sent ${eventsToSend.length} events to analytics`);
    } catch (error) {
      console.error('[EventTracking] Error sending events:', error);
      // Re-queue events with retry logic
      eventsToSend.forEach(item => {
        if (item.retries < 3) {
          item.retries++;
          this.eventQueue.push(item);
        }
      });
    }
  }

  /**
   * Track product view
   */
  trackProductView(productId: string, productName: string, sku?: string, price?: number): void {
    this.trackEvent({
      eventType: 'product_view',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        productId,
        productName,
        sku,
        price,
      },
    });
  }

  /**
   * Track search
   */
  trackSearch(searchQuery: string, resultsCount: number, filters?: Record<string, any>): void {
    this.trackEvent({
      eventType: 'search',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        searchQuery,
        resultsCount,
        filters,
      },
    });
  }

  /**
   * Track add to cart
   */
  trackAddToCart(
    productId: string,
    productName: string,
    price: number,
    quantity: number,
    cartValue?: number
  ): void {
    this.trackEvent({
      eventType: 'add_to_cart',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        productId,
        productName,
        price,
        quantity,
        cartValue,
      },
    });
  }

  /**
   * Track remove from cart
   */
  trackRemoveFromCart(
    productId: string,
    productName: string,
    price: number,
    quantity: number,
    reason?: 'user_action' | 'expiry' | 'out_of_stock'
  ): void {
    this.trackEvent({
      eventType: 'remove_from_cart',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        productId,
        productName,
        price,
        quantity,
        reason,
      },
    });
  }

  /**
   * Track checkout start
   */
  trackCheckoutStart(
    cartValue: number,
    itemCount: number,
    items: Array<{ productId: string; quantity: number; price: number }>
  ): void {
    this.trackEvent({
      eventType: 'checkout_start',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        cartValue,
        itemCount,
        items,
      },
    });
  }

  /**
   * Track payment success
   */
  trackPaymentSuccess(
    orderId: string,
    orderValue: number,
    itemCount: number,
    paymentMethod: 'card' | 'wallet' | 'bank_transfer' | 'other'
  ): void {
    this.trackEvent({
      eventType: 'payment_success',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        orderId,
        orderValue,
        itemCount,
        paymentMethod,
      },
    });
  }

  /**
   * Track category view
   */
  trackCategoryView(categoryId: string, categoryName: string, parentCategoryId?: string): void {
    this.trackEvent({
      eventType: 'category_view',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        categoryId,
        categoryName,
        parentCategoryId,
      },
    });
  }

  /**
   * Track promo code applied
   */
  trackPromoCodeApplied(promoCode: string, discountAmount: number, cartValue: number): void {
    this.trackEvent({
      eventType: 'promo_code_applied',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        promoCode,
        discountAmount,
        cartValue,
      },
    });
  }

  /**
   * Track support ticket
   */
  trackSupportTicketCreated(ticketId: string, category: string, subject: string): void {
    this.trackEvent({
      eventType: 'support_ticket_created',
      source: 'mobile_app',
      timestamp: new Date(),
      payload: {
        ticketId,
        category,
        subject,
      },
    });
  }

  // Private helpers

  private async initializeDeviceInfo(): Promise<void> {
    try {
      this.deviceInfo = {
        osName: DeviceInfo.osName,
        osVersion: DeviceInfo.osVersion,
        modelName: DeviceInfo.modelName,
        isTablet: DeviceInfo.deviceType === DeviceInfo.DeviceType.TABLET,
      };
    } catch (error) {
      console.warn('[EventTracking] Could not initialize device info:', error);
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultContext(): EventContext {
    return {
      userAgent: `Expo/${this.deviceInfo?.osName || 'Unknown'}`,
    };
  }

  private setFlushTimer(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.flushEvents();
    }, this.batchTimeout);
  }

  /**
   * Ensure events are sent before app closes
   */
  async ensureEventsFlushed(): Promise<void> {
    clearTimeout(this.batchTimer as NodeJS.Timeout);
    await this.flushEvents();
  }
}

// Export singleton instance
let instance: MobileEventTrackingService | null = null;

export function initializeEventTracking(apiUrl?: string): MobileEventTrackingService {
  if (!instance) {
    instance = new MobileEventTrackingService(apiUrl);
  }
  return instance;
}

export function getEventTracker(): MobileEventTrackingService {
  if (!instance) {
    instance = new MobileEventTrackingService();
  }
  return instance;
}
