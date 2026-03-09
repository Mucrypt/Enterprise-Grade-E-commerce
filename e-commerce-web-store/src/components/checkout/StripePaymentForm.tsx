// ============================================
// TechTools Web Store - Stripe Payment Form
// Handles card payment with Stripe Elements
// ============================================

import { useState } from 'react'
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CreditCard, Lock, AlertCircle, CheckCircle } from 'lucide-react'

interface StripePaymentFormProps {
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  isProcessing: boolean
  setIsProcessing: (value: boolean) => void
  returnUrl: string
  billingDetails?: {
    name: string
    email: string
    address?: {
      line1: string
      line2?: string
      city: string
      state: string
      postal_code: string
      country: string
    }
  }
}

export default function StripePaymentForm({
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
  returnUrl,
  billingDetails,
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: billingDetails
            ? {
                billing_details: billingDetails,
              }
            : undefined,
        },
        redirect: 'if_required',
      })

      if (error) {
        // Payment failed
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setErrorMessage(error.message || 'Payment failed')
          onError(error.message || 'Payment failed')
        } else {
          setErrorMessage('An unexpected error occurred')
          onError('An unexpected error occurred')
        }
      } else if (paymentIntent) {
        // Payment succeeded
        if (paymentIntent.status === 'succeeded') {
          onSuccess(paymentIntent.id)
        } else if (paymentIntent.status === 'requires_action') {
          // Handle 3D Secure or other authentication
          setErrorMessage('Additional authentication required')
        } else {
          setErrorMessage(`Payment status: ${paymentIntent.status}`)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed'
      setErrorMessage(message)
      onError(message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      {/* Security Badge */}
      <div className='flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg'>
        <Lock className='w-5 h-5 text-green-600' />
        <span className='text-sm text-green-700'>
          Your payment is secured with 256-bit SSL encryption
        </span>
      </div>

      {/* Stripe Payment Element */}
      <div className='bg-white border border-gray-200 rounded-lg p-4'>
        <div className='flex items-center gap-2 mb-4'>
          <CreditCard className='w-5 h-5 text-gray-600' />
          <span className='font-medium text-gray-900'>Payment Details</span>
        </div>

        <PaymentElement
          options={{
            layout: 'tabs',
            wallets: {
              applePay: 'auto',
              googlePay: 'auto',
            },
          }}
          onReady={() => setIsReady(true)}
          onChange={(event: { complete: boolean }) => {
            if (event.complete) {
              setErrorMessage(null)
            }
          }}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className='flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg'>
          <AlertCircle className='w-5 h-5 text-red-600 shrink-0' />
          <span className='text-sm text-red-700'>{errorMessage}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type='submit'
        disabled={!stripe || !elements || isProcessing || !isReady}
        className={`
          w-full flex items-center justify-center gap-2 py-4 px-6 rounded-lg
          font-semibold text-white transition-all
          ${
            isProcessing || !stripe || !isReady
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }
        `}
      >
        {isProcessing ? (
          <>
            <svg className='animate-spin h-5 w-5' viewBox='0 0 24 24'>
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
                fill='none'
              />
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              />
            </svg>
            Processing Payment...
          </>
        ) : (
          <>
            <Lock className='w-5 h-5' />
            Pay Securely
          </>
        )}
      </button>

      {/* Accepted Cards */}
      <div className='flex items-center justify-center gap-4 pt-4 border-t border-gray-100'>
        <span className='text-xs text-gray-500'>Accepted:</span>
        <div className='flex gap-2'>
          {['Visa', 'Mastercard', 'Amex', 'Discover'].map((card) => (
            <div
              key={card}
              className='px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600'
            >
              {card}
            </div>
          ))}
        </div>
      </div>
    </form>
  )
}

// Simple payment status display component
export function PaymentStatus({
  status,
}: {
  status: 'success' | 'failed' | 'processing'
}) {
  if (status === 'success') {
    return (
      <div className='flex flex-col items-center gap-4 p-8 text-center'>
        <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center'>
          <CheckCircle className='w-8 h-8 text-green-600' />
        </div>
        <div>
          <h3 className='text-lg font-semibold text-gray-900'>
            Payment Successful!
          </h3>
          <p className='text-gray-600 mt-1'>
            Your order has been placed successfully.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className='flex flex-col items-center gap-4 p-8 text-center'>
        <div className='w-16 h-16 bg-red-100 rounded-full flex items-center justify-center'>
          <AlertCircle className='w-8 h-8 text-red-600' />
        </div>
        <div>
          <h3 className='text-lg font-semibold text-gray-900'>
            Payment Failed
          </h3>
          <p className='text-gray-600 mt-1'>
            Please try again or use a different payment method.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col items-center gap-4 p-8 text-center'>
      <svg className='animate-spin h-12 w-12 text-blue-600' viewBox='0 0 24 24'>
        <circle
          className='opacity-25'
          cx='12'
          cy='12'
          r='10'
          stroke='currentColor'
          strokeWidth='4'
          fill='none'
        />
        <path
          className='opacity-75'
          fill='currentColor'
          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
        />
      </svg>
      <div>
        <h3 className='text-lg font-semibold text-gray-900'>
          Processing Payment
        </h3>
        <p className='text-gray-600 mt-1'>
          Please wait while we process your payment...
        </p>
      </div>
    </div>
  )
}
