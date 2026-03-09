// ============================================
// Order Confirmation Page - Success Screen
// ============================================

import { useEffect, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import {
  CheckCircle,
  Package,
  Mail,
  Truck,
  CreditCard,
  ChevronRight,
  Download,
  Share2,
  Copy,
  Home,
  ShoppingBag,
} from 'lucide-react'
import confetti from 'canvas-confetti'

interface OrderState {
  orderNumber: string
  orderId?: string
  total: number
  email: string
}

export default function OrderConfirmationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [copied, setCopied] = useState(false)

  // Support both navigation state and Stripe redirect params
  const paymentIntent = searchParams.get('payment_intent')
  const redirectStatus = searchParams.get('redirect_status')

  const orderData =
    (location.state as OrderState | null) ||
    (paymentIntent && redirectStatus === 'succeeded'
      ? {
          orderNumber: `TT-${paymentIntent.slice(-8).toUpperCase()}`,
          orderId: paymentIntent,
          total: 0, // Would need to fetch from API in production
          email: '',
        }
      : null)

  // Redirect if no order data
  useEffect(() => {
    if (!orderData) {
      navigate('/')
    }
  }, [orderData, navigate])

  // Confetti animation on mount
  useEffect(() => {
    if (orderData) {
      const duration = 3 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min
      }

      const interval: ReturnType<typeof setInterval> = setInterval(function () {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        })
      }, 250)

      return () => clearInterval(interval)
    }
  }, [orderData])

  const handleCopyOrderNumber = () => {
    if (orderData) {
      navigator.clipboard.writeText(orderData.orderNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!orderData) {
    return null
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(price)
  }

  return (
    <div className='min-h-screen bg-linear-to-br from-green-50 via-white to-orange-50 py-12'>
      <div className='max-w-2xl mx-auto px-4 sm:px-6'>
        {/* Success Card */}
        <div className='bg-white rounded-2xl shadow-xl overflow-hidden'>
          {/* Header */}
          <div className='bg-linear-to-r from-green-500 to-green-600 px-6 py-12 text-center text-white'>
            <div className='inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-6 shadow-lg'>
              <CheckCircle className='w-12 h-12 text-green-500' />
            </div>
            <h1 className='text-3xl font-bold mb-2'>Order Confirmed!</h1>
            <p className='text-green-100'>Thank you for your purchase</p>
          </div>

          {/* Order Details */}
          <div className='p-6 sm:p-8'>
            {/* Order Number */}
            <div className='bg-gray-50 rounded-xl p-4 mb-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-gray-500 mb-1'>Order Number</p>
                  <p className='text-xl font-bold text-gray-900 font-mono'>
                    {orderData.orderNumber}
                  </p>
                </div>
                <button
                  onClick={handleCopyOrderNumber}
                  className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors'
                  title='Copy order number'
                >
                  {copied ? (
                    <CheckCircle className='w-5 h-5 text-green-500' />
                  ) : (
                    <Copy className='w-5 h-5' />
                  )}
                </button>
              </div>
            </div>

            {/* Order Info Grid */}
            <div className='grid grid-cols-2 gap-4 mb-8'>
              <div className='bg-orange-50 rounded-xl p-4 text-center'>
                <CreditCard className='w-8 h-8 text-orange-500 mx-auto mb-2' />
                <p className='text-sm text-gray-600'>Total Paid</p>
                <p className='text-lg font-bold text-gray-900'>
                  {formatPrice(orderData.total)}
                </p>
              </div>
              <div className='bg-blue-50 rounded-xl p-4 text-center'>
                <Truck className='w-8 h-8 text-blue-500 mx-auto mb-2' />
                <p className='text-sm text-gray-600'>Est. Delivery</p>
                <p className='text-lg font-bold text-gray-900'>3-5 days</p>
              </div>
            </div>

            {/* Email Confirmation */}
            <div className='flex items-start gap-4 p-4 bg-green-50 rounded-xl mb-6'>
              <Mail className='w-6 h-6 text-green-600 shrink-0 mt-0.5' />
              <div>
                <p className='font-medium text-gray-900'>
                  Confirmation email sent
                </p>
                <p className='text-sm text-gray-600 mt-1'>
                  We've sent the order details to{' '}
                  <span className='font-medium'>{orderData.email}</span>
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className='mb-8'>
              <h3 className='font-semibold text-gray-900 mb-4'>
                What happens next?
              </h3>
              <div className='space-y-4'>
                <div className='flex items-start gap-4'>
                  <div className='w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0'>
                    <CheckCircle className='w-5 h-5 text-white' />
                  </div>
                  <div className='flex-1 pb-4 border-b border-gray-100'>
                    <p className='font-medium text-gray-900'>Order Placed</p>
                    <p className='text-sm text-gray-500'>Just now</p>
                  </div>
                </div>
                <div className='flex items-start gap-4'>
                  <div className='w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0'>
                    <Package className='w-5 h-5 text-gray-500' />
                  </div>
                  <div className='flex-1 pb-4 border-b border-gray-100'>
                    <p className='font-medium text-gray-900'>Processing</p>
                    <p className='text-sm text-gray-500'>
                      Your order is being prepared
                    </p>
                  </div>
                </div>
                <div className='flex items-start gap-4'>
                  <div className='w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0'>
                    <Truck className='w-5 h-5 text-gray-500' />
                  </div>
                  <div className='flex-1'>
                    <p className='font-medium text-gray-900'>On the way</p>
                    <p className='text-sm text-gray-500'>Track your delivery</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='space-y-3'>
              <Link
                to='/orders'
                className='flex items-center justify-center gap-2 w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors'
              >
                <Package className='w-5 h-5' />
                Track Your Order
                <ChevronRight className='w-5 h-5' />
              </Link>
              <Link
                to='/products'
                className='flex items-center justify-center gap-2 w-full py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors'
              >
                <ShoppingBag className='w-5 h-5' />
                Continue Shopping
              </Link>
              <Link
                to='/'
                className='flex items-center justify-center gap-2 w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors'
              >
                <Home className='w-5 h-5' />
                Back to Home
              </Link>
            </div>
          </div>
        </div>

        {/* Additional Actions */}
        <div className='mt-6 flex items-center justify-center gap-6 text-sm text-gray-500'>
          <button className='flex items-center gap-2 hover:text-gray-700 transition-colors'>
            <Download className='w-4 h-4' />
            Download Invoice
          </button>
          <button className='flex items-center gap-2 hover:text-gray-700 transition-colors'>
            <Share2 className='w-4 h-4' />
            Share Order
          </button>
        </div>

        {/* Support */}
        <div className='mt-8 text-center'>
          <p className='text-gray-500 text-sm'>
            Need help?{' '}
            <a
              href='mailto:support@tech-tools.lt'
              className='text-orange-500 hover:underline'
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
