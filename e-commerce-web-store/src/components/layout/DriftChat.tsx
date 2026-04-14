import { useEffect } from 'react'

/**
 * Drift Live Chat Widget for React
 * Initializes Drift chat for customer support in e-commerce store
 */
export function DriftChat() {
  useEffect(() => {
    // Check if Drift is already loaded
    if (window.drift) {
      return
    }

    // Load Drift script dynamically
    const script = document.createElement('script')
    script.src = 'https://js.driftt.com/js/drift.js'
    script.async = true

    script.onload = () => {
      // Initialize Drift with your App ID
      // Get your App ID from https://dash.driftt.com/
      if (window.drift) {
        window.drift.load('APPLICATION_ID')

        // Optional: Set user attributes if authenticated
        // window.drift.identify({
        //   userId: 'user-id',
        //   email: 'user@example.com',
        //   attributes: {
        //     firstName: 'User',
        //     lastName: 'Name'
        //   }
        // })

        // Optional: Set custom callbacks
        // window.drift.on('ready', () => {
        //   console.log('Drift chat is ready')
        // })
      }
    }

    script.onerror = () => {
      console.warn('Failed to load Drift chat widget')
    }

    document.body.appendChild(script)

    return () => {
      // Cleanup is handled by Drift
    }
  }, [])

  return null
}

// Extend Window type to include Drift
declare global {
  interface Window {
    drift?: {
      load: (id: string) => void
      identify: (userId: {
        userId?: string
        email?: string
        [key: string]: any
      }) => void
      on: (event: string, callback: () => void) => void
      [key: string]: any
    }
  }
}
