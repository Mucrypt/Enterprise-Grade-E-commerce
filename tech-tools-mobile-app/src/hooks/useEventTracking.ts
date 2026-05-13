/**
 * useEventTracking Hook - React Native Version
 * Convenience wrapper for event tracking throughout the mobile app
 */

import { useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getEventTracker } from './event-tracking'
import type { EventPayload } from './event-tracking'

export function useEventTracking() {
  const tracker = getEventTracker()

  // Initialize user if they're logged in
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user')
        if (storedUser) {
          const user = JSON.parse(storedUser)
          tracker.setUserId(user.id)
        }
      } catch (error) {
        console.error('Failed to initialize event tracking user:', error)
      }
    }

    initializeUser()
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
        { source: 'mobile_app' },
      )
    },
    [tracker],
  )

  const trackSearch = useCallback(
    (query: string, resultsCount: number, category?: string) => {
      tracker.trackSearch(
        { query, resultsCount, category },
        { source: 'mobile_app' },
      )
    },
    [tracker],
  )

  const trackFilterApplied = useCallback(
    (filterType: string, filterValue: string, resultsCount: number) => {
      tracker.trackFilterApplied(
        { filterType, filterValue, resultsCount },
        { source: 'mobile_app' },
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
        { source: 'mobile_app' },
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
        { source: 'mobile_app' },
      )
    },
    [tracker],
  )

  const trackCheckoutStart = useCallback(
    (cartTotal: number, itemCount: number, currency: string = 'EUR') => {
      tracker.trackCheckoutStart(
        { cartTotal, itemCount, currency },
        { source: 'mobile_app' },
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
        { source: 'mobile_app' },
      )
    },
    [tracker],
  )

  const trackCategoryView = useCallback(
    (categoryId: string, categoryName: string, productsCount: number) => {
      tracker.trackCategoryView(
        { categoryId, categoryName, productsCount },
        { source: 'mobile_app' },
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
        { source: 'mobile_app' },
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
        { source: 'mobile_app' },
      )
    },
    [tracker],
  )

  const trackScreenView = useCallback(
    (screenName: string, screenParams?: Record<string, any>) => {
      tracker.trackEvent(
        {
          eventType: 'screen_view',
          payload: {
            screenName,
            screenParams,
            timestamp: Date.now(),
          },
        },
        { source: 'mobile_app' },
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
        { source: 'mobile_app' },
      )
    },
    [tracker],
  )

  const trackSupportTicket = useCallback(
    (ticketId: string, issueType: string, description: string) => {
      tracker.trackSupportTicketCreated(
        { ticketId, issueType, description },
        { source: 'mobile_app' },
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
    trackScreenView,
    trackError,
    trackSupportTicket,
    flushEvents,
  }
}
