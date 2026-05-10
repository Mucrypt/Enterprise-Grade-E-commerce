'use client'

import { useEffect } from 'react'

/**
 * Tawk.to Live Chat Integration
 * Initializes Tawk.to chat widget for customer support
 */
export function DriftChat() {
  useEffect(() => {
    // Get Tawk.to Site ID from environment variable
    const tawkSiteId = process.env.NEXT_PUBLIC_TAWK_SITE_ID
    const tawkWidgetId = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || '1jm6uk6rp'

    // Skip if no Tawk Site ID configured.
    // Warn only in development to avoid noisy production consoles.
    if (!tawkSiteId || tawkSiteId === 'YOUR_TAWK_SITE_ID') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'Tawk.to chat not configured. Set NEXT_PUBLIC_TAWK_SITE_ID environment variable.',
        )
      }
      return
    }

    // Tawk site id should be a 24-char hex string.
    const isValidSiteId = /^[a-f0-9]{24}$/i.test(tawkSiteId)
    const isValidWidgetId = /^[a-z0-9]{6,}$/i.test(tawkWidgetId)
    if (!isValidSiteId || !isValidWidgetId) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `Skipping Tawk.to load due to invalid ids (siteId=${tawkSiteId}, widgetId=${tawkWidgetId}).`,
        )
      }
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
      // Tawk cleanup (optional)
    }
  }, [])

  return null
}

// Extend Window type to include Tawk
declare global {
  interface Window {
    Tawk_API?: {
      [key: string]: any
    }
    Tawk_LoadStart?: Date
  }
}
