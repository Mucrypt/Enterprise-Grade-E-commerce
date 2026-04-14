'use client'

import { useEffect } from 'react'

/**
 * Drift Live Chat Integration
 * Initializes Drift chat widget for customer support
 */
export function DriftChat() {
  useEffect(() => {
    // Initialize Drift
    if (window.drift) {
      window.drift.load('APPLICATION_ID') // Replace with your Drift ID
      return
    }

    // Load Drift script
    const script = document.createElement('script')
    script.src = 'https://js.driftt.com/js/drift.js'
    script.async = true
    script.onload = () => {
      if (window.drift) {
        window.drift.load('APPLICATION_ID') // Replace with your Drift ID
      }
    }
    document.body.appendChild(script)

    return () => {
      // Drift cleanup (optional)
    }
  }, [])

  return null
}

// Extend Window type to include Drift
declare global {
  interface Window {
    drift?: {
      load: (id: string) => void
      [key: string]: any
    }
  }
}
