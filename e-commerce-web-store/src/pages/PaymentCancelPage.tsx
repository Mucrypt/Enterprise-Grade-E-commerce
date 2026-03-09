// ============================================
// Payment Cancelled Page - User-friendly Error Recovery
// Premium UX with helpful recovery options
// ============================================

import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  XCircle,
  RefreshCcw,
  ShoppingCart,
  CreditCard,
  MessageCircle,
  HelpCircle,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Mail,
  Home,
  ChevronRight,
} from 'lucide-react'

type CancelReason = 'user_cancelled' | 'payment_failed' | 'expired' | 'unknown'

interface ReasonContent {
  title: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
}

const reasonContent: Record<CancelReason, ReasonContent> = {
  user_cancelled: {
    title: 'Payment Cancelled',
    description: "You've cancelled the payment. Your items are still in your cart.",
    icon: <XCircle className="w-12 h-12" />,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100',
  },
  payment_failed: {
    title: 'Payment Failed',
    description: 'We could not process your payment. Please try again with a different payment method.',
    icon: <ShieldAlert className="w-12 h-12" />,
    color: 'text-red-500',
    bgColor: 'bg-red-100',
  },
  expired: {
    title: 'Session Expired',
    description: 'Your checkout session has expired. Please start the checkout process again.',
    icon: <Clock className="w-12 h-12" />,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100',
  },
  unknown: {
    title: 'Something Went Wrong',
    description: "We couldn't complete your order. Don't worry - no payment was processed.",
    icon: <AlertTriangle className="w-12 h-12" />,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
}

const troubleshootingTips = [
  {
    icon: <CreditCard className="w-5 h-5" />,
    title: 'Check your card details',
    description: 'Ensure your card number, expiry date, and CVV are correct',
  },
  {
    icon: <ShieldAlert className="w-5 h-5" />,
    title: 'Verify card authorization',
    description: 'Contact your bank if you see a declined message',
  },
  {
    icon: <RefreshCcw className="w-5 h-5" />,
    title: 'Try a different payment method',
    description: 'We accept Visa, Mastercard, American Express, and more',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'Wait and retry',
    description: 'Sometimes banks need a moment to process',
  },
]

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(30)

  // Determine the reason for cancellation
  const redirectStatus = searchParams.get('redirect_status')
  const errorType = searchParams.get('error')
  
  let reason: CancelReason = 'unknown'
  if (redirectStatus === 'failed') {
    reason = 'payment_failed'
  } else if (errorType === 'cancelled' || redirectStatus === 'canceled') {
    reason = 'user_cancelled'
  } else if (errorType === 'expired') {
    reason = 'expired'
  }

  const content = reasonContent[reason]

  // Auto-redirect countdown for user cancellation
  useEffect(() => {
    if (reason === 'user_cancelled') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            navigate('/cart')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [reason, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className={`px-6 py-12 text-center ${content.bgColor}`}>
            <div className={`inline-flex items-center justify-center w-24 h-24 bg-white rounded-full mb-6 shadow-lg ${content.color}`}>
              {content.icon}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              {content.title}
            </h1>
            <p className="text-gray-600 max-w-md mx-auto">
              {content.description}
            </p>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {/* Reassurance Message */}
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
              <div className="shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">
                  No payment has been taken
                </p>
                <p className="text-sm text-green-600">
                  Your card has not been charged. You can safely try again.
                </p>
              </div>
            </div>

            {/* Cart Status - for user cancellation */}
            {reason === 'user_cancelled' && (
              <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
                <div className="shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-blue-800">
                    Your cart is saved
                  </p>
                  <p className="text-sm text-blue-600">
                    Redirecting to cart in {countdown} seconds...
                  </p>
                </div>
              </div>
            )}

            {/* Troubleshooting Tips - for payment failures */}
            {reason === 'payment_failed' && (
              <div className="mb-8">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-gray-400" />
                  Troubleshooting Tips
                </h3>
                <div className="space-y-3">
                  {troubleshootingTips.map((tip, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="shrink-0 text-gray-400 mt-0.5">
                        {tip.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">
                          {tip.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tip.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Actions */}
            <div className="space-y-3 mb-8">
              <Link
                to="/checkout"
                className="flex items-center justify-center gap-2 w-full py-4 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/25 active:scale-[0.98]"
              >
                <RefreshCcw className="w-5 h-5" />
                Try Payment Again
                <ChevronRight className="w-5 h-5" />
              </Link>

              <Link
                to="/cart"
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
                Return to Cart
              </Link>

              <Link
                to="/"
                className="flex items-center justify-center gap-2 w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </Link>
            </div>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">
                  Need assistance?
                </span>
              </div>
            </div>

            {/* Support Options */}
            <div className="grid grid-cols-2 gap-4">
              <a
                href="mailto:support@techtoolstore.com"
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:shadow transition-shadow">
                  <Mail className="w-6 h-6 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  Email Support
                </span>
                <span className="text-xs text-gray-500">
                  24hr response
                </span>
              </a>

              <Link
                to="/contact"
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:shadow transition-shadow">
                  <MessageCircle className="w-6 h-6 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  Live Chat
                </span>
                <span className="text-xs text-gray-500">
                  Mon-Fri 9-6
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Secure Payments</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span>Powered by Stripe</span>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Order ID: {searchParams.get('payment_intent')?.slice(-12) || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  )
}
