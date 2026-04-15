import { useEffect, useRef } from 'react'
import type { SupportProfile } from '../../types'

interface DriftChatProps {
  supportProfile?: SupportProfile | null
}

/**
 * Tawk.to Live Chat Widget for React
 * Initializes Tawk.to chat for customer support in e-commerce store
 */
export function DriftChat({ supportProfile }: DriftChatProps) {
  const appliedProfileRef = useRef<string | null>(null)

  useEffect(() => {
    // Get Tawk.to Site ID from environment variable
    const tawkSiteId = import.meta.env.VITE_TAWK_SITE_ID
    const tawkWidgetId = import.meta.env.VITE_TAWK_WIDGET_ID || '1jm6uk6rp'

    // Skip if no Tawk Site ID configured
    if (!tawkSiteId || tawkSiteId === 'YOUR_TAWK_SITE_ID') {
      console.warn(
        'Tawk.to chat not configured. Set VITE_TAWK_SITE_ID environment variable.',
      )
      return
    }

    // Check if Tawk is already loaded
    if (window.Tawk_API) {
      return
    }

    // Load Tawk.to script
    const script = document.createElement('script')
    script.async = true
    script.src = `https://embed.tawk.to/${tawkSiteId}/${tawkWidgetId}`
    script.charset = 'UTF-8'
    script.setAttribute('crossorigin', '*')

    script.onerror = () => {
      console.warn('Failed to load Tawk.to chat widget')
    }

    document.body.appendChild(script)

    return () => {
      // Cleanup is handled by Tawk
    }
  }, [])

  useEffect(() => {
    if (!supportProfile || !window.Tawk_API) {
      return
    }

    if (appliedProfileRef.current === supportProfile.customer.id) {
      return
    }

    const tawkApi = window.Tawk_API
    const attributes = {
      name: supportProfile.customer.fullName,
      email: supportProfile.customer.email,
      customerTier: supportProfile.loyalty.tier,
      loyaltyPoints: String(supportProfile.loyalty.points),
      totalOrders: String(supportProfile.orderSummary.totalOrders),
      activeOrders: String(supportProfile.orderSummary.activeOrders),
      recentOrderNumber: supportProfile.recentOrder?.order_number || 'none',
      verifiedReviewCount: String(supportProfile.verifiedReviews.length),
    }

    try {
      if (typeof tawkApi.setAttributes === 'function') {
        tawkApi.setAttributes(attributes)
      }

      if (typeof tawkApi.addTags === 'function') {
        tawkApi.addTags([
          'techtools-customer',
          supportProfile.loyalty.tier.toLowerCase(),
        ])
      }

      appliedProfileRef.current = supportProfile.customer.id
    } catch (error) {
      console.warn('Failed to apply Tawk customer context', error)
    }
  }, [supportProfile])

  return null
}

// Extend Window type to include Tawk
declare global {
  interface Window {
    Tawk_API?: {
      setAttributes?: (attributes: Record<string, string>) => void
      addTags?: (tags: string[]) => void
      maximize?: () => void
      [key: string]: any
    }
    Tawk_LoadStart?: Date
  }
}
