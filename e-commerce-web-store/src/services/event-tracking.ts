/**
 * WEB STORE - EVENT TRACKING SERVICE
 * Client-side event tracking for e-commerce-web-store
 * Emits events to the backend analytics API
 */

type EventSource = 'web_store' | 'mobile_app' | 'admin_dashboard' | 'api'

interface EventContext {
  userAgent?: string
  referrer?: string
  source?: EventSource
  [key: string]: unknown
}

interface AnyEvent {
  eventType: string
  source?: EventSource
  timestamp?: Date
  sessionId?: string
  payload?: Record<string, unknown>
  [key: string]: unknown
}

interface EventQueueItem {
  event: AnyEvent
  context?: EventContext
  retries: number
}

export class EventTrackingService {
  private apiUrl: string
  private sessionId: string
  private userId: string | null = null
  private eventQueue: EventQueueItem[] = []
  private isOnline: boolean = navigator.onLine
  private batchSize: number = 10
  private batchTimeout: number = 5000 // 5 seconds
  private batchTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    apiUrl: string = (import.meta.env.VITE_API_URL as string | undefined) ||
      'http://localhost:9000',
  ) {
    this.apiUrl = apiUrl
    this.sessionId = this.generateSessionId()
    this.initializeOnlineListeners()
  }

  /**
   * Track a single event
   */
  trackEvent(event: AnyEvent, context?: EventContext): void {
    // Add session info to event if not present
    if (!event.sessionId) {
      event.sessionId = this.sessionId
    }
    if (!event.source) {
      event.source = 'web_store' as EventSource
    }
    if (!event.timestamp) {
      event.timestamp = new Date()
    }

    // Add context if not provided
    if (!context) {
      context = this.getDefaultContext()
    }

    // Queue the event
    this.eventQueue.push({
      event,
      context,
      retries: 0,
    })

    // Flush queue if batch size reached
    if (this.eventQueue.length >= this.batchSize) {
      this.flushEvents()
    } else {
      // Set timer to flush if no more events come in
      this.setFlushTimer()
    }
  }

  /**
   * Set user ID for tracking logged-in users
   */
  setUserId(userId: string): void {
    this.userId = userId
  }

  /**
   * Clear user ID for logout
   */
  clearUserId(): void {
    this.userId = null
  }

  /**
   * Manually flush events to server
   */
  async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return
    }

    if (!this.isOnline) {
      console.warn('Offline: Events will be sent when connection is restored')
      return
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    // Take a copy of the queue
    const eventsToSend = [...this.eventQueue]
    this.eventQueue = []

    try {
      const response = await fetch(`${this.apiUrl}/api/v1/events/batch`, {
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
      })

      if (!response.ok) {
        throw new Error(`Failed to send events: ${response.status}`)
      }

      console.debug(`Sent ${eventsToSend.length} events to analytics`)
    } catch (error) {
      console.error('Error sending events:', error)
      // Re-queue events with retry logic
      eventsToSend.forEach((item) => {
        if (item.retries < 3) {
          item.retries++
          this.eventQueue.push(item)
        }
      })
    }
  }

  /**
   * Track product view
   */
  trackProductView(
    productId: string,
    productName: string,
    sku?: string,
    price?: number,
  ): void {
    this.trackEvent({
      eventType: 'product_view',
      source: 'web_store',
      timestamp: new Date(),
      payload: {
        productId,
        productName,
        sku,
        price,
      },
    })
  }

  /**
   * Track search
   */
  trackSearch(
    searchQuery: string,
    resultsCount: number,
    filters?: Record<string, any>,
  ): void {
    this.trackEvent({
      eventType: 'search',
      source: 'web_store',
      timestamp: new Date(),
      payload: {
        searchQuery,
        resultsCount,
        filters,
      },
    })
  }

  /**
   * Track add to cart
   */
  trackAddToCart(
    productId: string,
    productName: string,
    price: number,
    quantity: number,
    cartValue?: number,
  ): void {
    this.trackEvent({
      eventType: 'add_to_cart',
      source: 'web_store',
      timestamp: new Date(),
      payload: {
        productId,
        productName,
        price,
        quantity,
        cartValue,
      },
    })
  }

  /**
   * Track remove from cart
   */
  trackRemoveFromCart(
    productId: string,
    productName: string,
    price: number,
    quantity: number,
    reason?: 'user_action' | 'expiry' | 'out_of_stock',
  ): void {
    this.trackEvent({
      eventType: 'remove_from_cart',
      source: 'web_store',
      timestamp: new Date(),
      payload: {
        productId,
        productName,
        price,
        quantity,
        reason,
      },
    })
  }

  /**
   * Track checkout start
   */
  trackCheckoutStart(
    cartValue: number,
    itemCount: number,
    items: Array<{ productId: string; quantity: number; price: number }>,
  ): void {
    this.trackEvent({
      eventType: 'checkout_start',
      source: 'web_store',
      timestamp: new Date(),
      payload: {
        cartValue,
        itemCount,
        items,
      },
    })
  }

  /**
   * Track payment success
   */
  trackPaymentSuccess(
    orderId: string,
    orderValue: number,
    itemCount: number,
    paymentMethod: 'card' | 'wallet' | 'bank_transfer' | 'other',
  ): void {
    this.trackEvent({
      eventType: 'payment_success',
      source: 'web_store',
      timestamp: new Date(),
      payload: {
        orderId,
        orderValue,
        itemCount,
        paymentMethod,
      },
    })
  }

  /**
   * Track category view
   */
  trackCategoryView(
    categoryId: string,
    categoryName: string,
    parentCategoryId?: string,
  ): void {
    this.trackEvent({
      eventType: 'category_view',
      source: 'web_store',
      timestamp: new Date(),
      payload: {
        categoryId,
        categoryName,
        parentCategoryId,
      },
    })
  }

  /**
   * Track promo code applied
   */
  trackPromoCodeApplied(
    promoCode: string,
    discountAmount: number,
    cartValue: number,
  ): void {
    this.trackEvent({
      eventType: 'promo_code_applied',
      source: 'web_store',
      timestamp: new Date(),
      payload: {
        promoCode,
        discountAmount,
        cartValue,
      },
    })
  }

  // Private helpers

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getDefaultContext(): EventContext {
    return {
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      ...this.getUtmParams(),
    }
  }

  /**
   * UTM params are typically only present on the landing URL, so capture them
   * once and persist for the lifetime of this browser session (sessionStorage),
   * falling back to whatever was captured earlier if the current URL has none.
   */
  private getUtmParams(): Partial<EventContext> {
    const STORAGE_KEY = 'analytics_utm'
    const params = new URLSearchParams(window.location.search)
    const fromUrl = {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined,
    }

    if (fromUrl.utmSource) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl))
      } catch {
        // sessionStorage unavailable (e.g. private mode) -- fine, just won't persist
      }
      return fromUrl
    }

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {
      // ignore malformed/unavailable storage
    }

    return {}
  }

  private setFlushTimer(): void {
    if (this.batchTimer) return

    this.batchTimer = setTimeout(() => {
      this.flushEvents()
    }, this.batchTimeout)
  }

  private initializeOnlineListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      // Flush any queued events when coming back online
      if (this.eventQueue.length > 0) {
        this.flushEvents()
      }
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }
}

// Export singleton instance
let instance: EventTrackingService | null = null

export function initializeEventTracking(apiUrl?: string): EventTrackingService {
  if (!instance) {
    instance = new EventTrackingService(apiUrl)
  }
  return instance
}

export function getEventTracker(): EventTrackingService {
  if (!instance) {
    instance = new EventTrackingService()
  }
  return instance
}
