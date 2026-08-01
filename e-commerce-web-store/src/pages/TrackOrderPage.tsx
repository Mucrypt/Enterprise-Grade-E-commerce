// ============================================
// Track Order Page - real backend lookup by order number + email
// ============================================

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react'
import { ordersApiNew } from '../api'

interface TrackedItem {
  productName: string
  quantity: number
  itemStatus: string
  trackingNumber: string | null
  carrier: string | null
  shippedAt: string | null
  deliveredAt: string | null
}

interface TrackedOrder {
  orderNumber: string
  orderStatus: string
  paymentStatus: string
  createdAt: string
  estimatedDelivery: string | null
  items: TrackedItem[]
}

const statusSteps = [
  { keys: ['pending', 'confirmed'], label: 'Processing', icon: Package },
  { keys: ['processing', 'ready_to_ship'], label: 'Preparing', icon: Package },
  { keys: ['shipped'], label: 'Shipped', icon: Truck },
  { keys: ['delivered'], label: 'Delivered', icon: CheckCircle },
]

function getStatusIndex(status: string): number {
  return statusSteps.findIndex((s) => s.keys.includes(status))
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function TrackOrderPage() {
  const [searchParams] = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(
    searchParams.get('orderNumber') || '',
  )
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [trackingResult, setTrackingResult] = useState<TrackedOrder | null>(
    null,
  )
  const [error, setError] = useState('')

  const runLookup = async (orderNum: string, emailValue: string) => {
    setIsLoading(true)
    setError('')
    setTrackingResult(null)
    try {
      const result = await ordersApiNew.track(orderNum, emailValue)
      setTrackingResult(result)
    } catch (err) {
      console.error('Order tracking lookup failed:', err)
      setError(
        'Order not found. Please check your order number and email address.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  // If arriving from "Track Package" on the Orders page with ?orderNumber=,
  // the shopper is already logged in there but this page is public/guest-
  // facing, so we still need their email before we can look anything up.
  useEffect(() => {
    const fromQuery = searchParams.get('orderNumber')
    if (fromQuery) setOrderNumber(fromQuery)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await runLookup(orderNumber, email)
  }

  const isCancelledOrRefunded =
    trackingResult?.orderStatus === 'cancelled' ||
    trackingResult?.orderStatus === 'refunded'
  const currentStatusIndex = trackingResult
    ? getStatusIndex(trackingResult.orderStatus)
    : -1

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-purple-600 via-indigo-600 to-blue-600 text-white'>
        <div className='container mx-auto px-4 py-16'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <MapPin className='w-8 h-8 text-white' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>
              Track Your Order
            </h1>
            <p className='text-white/90 text-lg max-w-2xl mx-auto'>
              Enter your order number and the email used at checkout to get
              the latest status.
            </p>
          </div>
        </div>
      </div>

      {/* Tracking Form */}
      <div className='container mx-auto px-4 -mt-8'>
        <div className='max-w-2xl mx-auto'>
          <div className='bg-white rounded-2xl p-8 shadow-lg'>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div>
                <label
                  htmlFor='orderNumber'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Order Number
                </label>
                <input
                  type='text'
                  id='orderNumber'
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors'
                  placeholder='e.g., TT-12345678-ABCD'
                />
              </div>

              <div>
                <label
                  htmlFor='email'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Email Address
                </label>
                <input
                  type='email'
                  id='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors'
                  placeholder='Email used for the order'
                />
              </div>

              <button
                type='submit'
                disabled={isLoading}
                className='w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition-colors'
              >
                {isLoading ? (
                  <>
                    <svg
                      className='animate-spin w-5 h-5'
                      fill='none'
                      viewBox='0 0 24 24'
                    >
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                      />
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                      />
                    </svg>
                    Tracking...
                  </>
                ) : (
                  <>
                    <Search className='w-5 h-5' />
                    Track Order
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className='mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3'>
                <AlertTriangle className='w-5 h-5 text-red-500 shrink-0 mt-0.5' />
                <p className='text-sm text-red-800'>{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tracking Results */}
      {trackingResult && (
        <div className='container mx-auto px-4 py-12'>
          <div className='max-w-4xl mx-auto'>
            {/* Order Summary */}
            <div className='bg-white rounded-2xl p-6 shadow-sm mb-8'>
              <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
                <div>
                  <h2 className='text-xl font-bold text-gray-900'>
                    Order {trackingResult.orderNumber}
                  </h2>
                  <p className='text-gray-600'>
                    Placed {formatDate(trackingResult.createdAt)}
                  </p>
                </div>
                {trackingResult.estimatedDelivery && !isCancelledOrRefunded && (
                  <div className='text-right'>
                    <p className='text-sm text-gray-500'>Estimated Delivery</p>
                    <p className='text-lg font-semibold text-gray-900'>
                      {formatDate(trackingResult.estimatedDelivery)}
                    </p>
                  </div>
                )}
              </div>

              {isCancelledOrRefunded ? (
                <div className='flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl'>
                  <XCircle className='w-6 h-6 text-red-500 shrink-0' />
                  <p className='font-medium text-red-800'>
                    This order was{' '}
                    {trackingResult.orderStatus === 'cancelled'
                      ? 'cancelled'
                      : 'refunded'}
                    .
                  </p>
                </div>
              ) : (
                <div className='relative'>
                  <div className='flex justify-between'>
                    {statusSteps.map((step, index) => {
                      const isCompleted = index <= currentStatusIndex
                      const isCurrent = index === currentStatusIndex

                      return (
                        <div
                          key={step.label}
                          className='flex flex-col items-center relative z-10'
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-400'
                            } ${isCurrent ? 'ring-4 ring-green-100' : ''}`}
                          >
                            <step.icon className='w-5 h-5' />
                          </div>
                          <span
                            className={`text-xs mt-2 text-center ${
                              isCompleted
                                ? 'text-green-600 font-medium'
                                : 'text-gray-400'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className='absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0'>
                    <div
                      className='h-full bg-green-500 transition-all duration-500'
                      style={{
                        width: `${Math.max(
                          0,
                          (currentStatusIndex / (statusSteps.length - 1)) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Items + per-item shipment info (only what we actually know) */}
            <div className='bg-white rounded-2xl p-6 shadow-sm'>
              <h3 className='font-semibold text-gray-900 mb-6'>Items</h3>
              <div className='space-y-4'>
                {trackingResult.items.map((item, index) => (
                  <div
                    key={index}
                    className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-gray-50 rounded-xl'
                  >
                    <div>
                      <p className='font-medium text-gray-900'>
                        {item.productName}
                      </p>
                      <p className='text-sm text-gray-500'>
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <div className='text-sm text-gray-600 sm:text-right'>
                      {item.trackingNumber ? (
                        <>
                          <p>
                            {item.carrier || 'Carrier'} ·{' '}
                            <span className='font-mono'>
                              {item.trackingNumber}
                            </span>
                          </p>
                          {item.shippedAt && (
                            <p className='text-gray-500'>
                              Shipped {formatDate(item.shippedAt)}
                            </p>
                          )}
                          {item.deliveredAt && (
                            <p className='text-gray-500'>
                              Delivered {formatDate(item.deliveredAt)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className='text-gray-400'>
                          Tracking not yet available
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className='container mx-auto px-4 py-16'>
        <div className='max-w-5xl mx-auto'>
          <div className='flex items-center gap-3 mb-8'>
            <HelpCircle className='w-6 h-6 text-purple-600' />
            <h2 className='text-2xl font-bold text-gray-900'>Need Help?</h2>
          </div>

          <div className='grid md:grid-cols-3 gap-6'>
            <div className='bg-white rounded-xl p-6 shadow-sm'>
              <div className='w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4'>
                <Clock className='w-6 h-6 text-blue-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>
                Tracking Not Updating?
              </h3>
              <p className='text-sm text-gray-600'>
                Tracking information may take 24-48 hours to update after
                shipping. Check back later or contact support.
              </p>
            </div>

            <div className='bg-white rounded-xl p-6 shadow-sm'>
              <div className='w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4'>
                <Package className='w-6 h-6 text-orange-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>
                Package Delayed?
              </h3>
              <p className='text-sm text-gray-600'>
                Delays can occur due to weather or carrier issues. If delayed
                more than 5 days past estimate, contact us.
              </p>
            </div>

            <div className='bg-white rounded-xl p-6 shadow-sm'>
              <div className='w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4'>
                <AlertTriangle className='w-6 h-6 text-red-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>
                Lost Package?
              </h3>
              <p className='text-sm text-gray-600'>
                If your package shows delivered but you haven't received it,
                check around your property and with neighbors.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Other Ways to Track */}
      <div className='bg-gray-100 py-12'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto'>
            <h2 className='text-xl font-bold text-gray-900 text-center mb-8'>
              Other Ways to Track
            </h2>

            <div className='grid md:grid-cols-2 gap-6'>
              <div className='bg-white rounded-xl p-6'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  Track via Email
                </h3>
                <p className='text-sm text-gray-600 mb-4'>
                  Check your order confirmation email for tracking links and
                  updates.
                </p>
                <span className='text-purple-600 text-sm font-medium'>
                  Check your inbox
                </span>
              </div>

              <div className='bg-white rounded-xl p-6'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  Track in Your Account
                </h3>
                <p className='text-sm text-gray-600 mb-4'>
                  Log into your account to see all orders and their tracking
                  status.
                </p>
                <Link
                  to='/orders'
                  className='text-purple-600 text-sm font-medium hover:underline'
                >
                  View My Orders →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact CTA */}
      <div className='container mx-auto px-4 py-12'>
        <div className='max-w-4xl mx-auto text-center'>
          <h2 className='text-xl font-bold text-gray-900 mb-2'>
            Still Have Questions?
          </h2>
          <p className='text-gray-600 mb-6'>
            Our support team is ready to help you with any delivery concerns.
          </p>
          <Link
            to='/contact'
            className='inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors'
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  )
}
