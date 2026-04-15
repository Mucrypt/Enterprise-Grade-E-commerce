import { useEffect } from 'react'

/**
 * Tawk.to Live Chat Widget for React
 * Initializes Tawk.to chat for customer support in e-commerce store
 */
export function DriftChat() {
  useEffect(() => {
    // Get Tawk.to Site ID from environment variable
    const tawkSiteId = import.meta.env.VITE_TAWK_SITE_ID

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
    script.src = `https://embed.tawk.to/${tawkSiteId}/1`
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
