// ============================================
// TechTools Web Store - Stripe Payment Context
// Provides Stripe Elements throughout the app
// ============================================

import React, { createContext, useContext, useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import type { Stripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { paymentsApi } from '../api'

interface StripeContextType {
  isLoading: boolean
  isConfigured: boolean
  error: string | null
}

const StripeContext = createContext<StripeContextType>({
  isLoading: true,
  isConfigured: false,
  error: null,
})

export const useStripeContext = () => useContext(StripeContext)

interface StripeProviderProps {
  children: React.ReactNode
}

let stripePromise: Promise<Stripe | null> | null = null

export function StripeProvider({ children }: StripeProviderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initStripe = async () => {
      try {
        const config = await paymentsApi.getConfig()
        if (config.publishableKey) {
          stripePromise = loadStripe(config.publishableKey)
          setIsConfigured(true)
        } else {
          setError('Payment service not configured')
        }
      } catch (err) {
        console.error('Failed to load Stripe config:', err)
        setError('Failed to initialize payment service')
      } finally {
        setIsLoading(false)
      }
    }

    initStripe()
  }, [])

  return (
    <StripeContext.Provider value={{ isLoading, isConfigured, error }}>
      {children}
    </StripeContext.Provider>
  )
}

// HOC to wrap components that need Stripe Elements
interface WithStripeElementsProps {
  clientSecret: string
  children: React.ReactNode
}

export function StripeElementsWrapper({
  clientSecret,
  children,
}: WithStripeElementsProps) {
  const { isConfigured } = useStripeContext()

  if (!isConfigured || !stripePromise || !clientSecret) {
    return null
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#2563eb',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#ef4444',
            fontFamily: 'Inter, system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
          rules: {
            '.Input': {
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            },
            '.Input:focus': {
              border: '1px solid #2563eb',
              boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
            },
            '.Label': {
              fontWeight: '500',
              marginBottom: '4px',
            },
          },
        },
      }}
    >
      {children}
    </Elements>
  )
}

export { stripePromise }
