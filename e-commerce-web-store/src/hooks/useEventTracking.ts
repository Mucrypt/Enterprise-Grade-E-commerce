/**
 * useEventTracking Hook
 * Convenience wrapper for event tracking throughout the app
 */

import { useEffect, useCallback } from 'react'
import { getEventTracker } from '../services/event-tracking'
import type { EventPayload, EventSource } from '../services/event-tracking'

export function useEventTracking() {
  const tracker = getEventTracker()

  // Initialize user if they're logged in
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        tracker.setUserId(user.id)
      } catch (error) {
        console.error('Failed to parse stored user:', error)
      }
    }
  }, [])

  const trackProductView = useCallback(
    (
      productId: string,
      productName: string,
      sku: string,
      categoryId: string,
      price: number,
      discount?: number,
    ) => {
      tracker.trackProductView(
        { productId, productName, sku, categoryId, price, discount },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackSearch = useCallback(
    (query: string, resultsCount: number, category?: string) => {
      tracker.trackSearch(
        { query, resultsCount, category },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackFilterApplied = useCallback(
    (filterType: string, filterValue: string, resultsCount: number) => {
      tracker.trackFilterApplied(
        { filterType, filterValue, resultsCount },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackAddToCart = useCallback(
    (
      productId: string,
      productName: string,
      sku: string,
      price: number,
      quantity: number,
    ) => {
      tracker.trackAddToCart(
        { productId, productName, sku, price, quantity },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackRemoveFromCart = useCallback(
    (
      productId: string,
      productName: string,
      sku: string,
      price: number,
      quantity: number,
    ) => {
      tracker.trackRemoveFromCart(
        { productId, productName, sku, price, quantity },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackCheckoutStart = useCallback(
    (cartTotal: number, itemCount: number, currency: string = 'EUR') => {
      tracker.trackCheckoutStart(
        { cartTotal, itemCount, currency },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackPaymentSuccess = useCallback(
    (
      orderId: string,
      cartTotal: number,
      itemCount: number,
      currency: string = 'EUR',
    ) => {
      tracker.trackPaymentSuccess(
        { orderId, cartTotal, itemCount, currency },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackCategoryView = useCallback(
    (categoryId: string, categoryName: string, productsCount: number) => {
      tracker.trackCategoryView(
        { categoryId, categoryName, productsCount },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackPromoCodeApplied = useCallback(
    (
      promoCode: string,
      discountAmount: number,
      discountPercentage?: number,
    ) => {
      tracker.trackPromoCodeApplied(
        { promoCode, discountAmount, discountPercentage },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackProductFavorite = useCallback(
    (productId: string, productName: string, isFavorited: boolean) => {
      tracker.trackEvent(
        {
          eventType: 'product_favorite',
          payload: {
            productId,
            productName,
            action: isFavorited ? 'added' : 'removed',
          },
        },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackPageView = useCallback(
    (pageName: string, pageCategory?: string) => {
      tracker.trackEvent(
        {
          eventType: 'page_view',
          payload: {
            pageName,
            pageCategory: pageCategory || 'general',
            timestamp: Date.now(),
          },
        },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const trackError = useCallback(
    (
      errorMessage: string,
      errorType: string,
      context?: Record<string, any>,
    ) => {
      tracker.trackEvent(
        {
          eventType: 'error',
          payload: {
            errorMessage,
            errorType,
            context,
            timestamp: Date.now(),
          },
        },
        { source: 'web_store' },
      )
    },
    [tracker],
  )

  const flushEvents = useCallback(() => {
    tracker.flushEvents()
  }, [tracker])

  return {
    trackProductView,
    trackSearch,
    trackFilterApplied,
    trackAddToCart,
    trackRemoveFromCart,
    trackCheckoutStart,
    trackPaymentSuccess,
    trackCategoryView,
    trackPromoCodeApplied,
    trackProductFavorite,
    trackPageView,
    trackError,
    flushEvents,
  }
}
