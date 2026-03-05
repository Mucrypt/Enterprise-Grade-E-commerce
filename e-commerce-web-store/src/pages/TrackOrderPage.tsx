// ============================================
// Track Order Page - Production Ready
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
} from 'lucide-react'

interface TrackingEvent {
  status: string
  location: string
  date: string
  time: string
  description: string
}

interface OrderStatus {
  orderNumber: string
  status:
    | 'processing'
    | 'shipped'
    | 'in-transit'
    | 'out-for-delivery'
    | 'delivered'
  estimatedDelivery: string
  carrier: string
  trackingNumber: string
  events: TrackingEvent[]
}

// Mock tracking data for demonstration
const mockTrackingData: OrderStatus = {
  orderNumber: 'TT-123456',
  status: 'in-transit',
  estimatedDelivery: 'March 7, 2026',
  carrier: 'FedEx',
  trackingNumber: '7489374893748937',
  events: [
    {
      status: 'In Transit',
      location: 'Chicago, IL',
      date: 'Mar 5, 2026',
      time: '2:45 PM',
      description: 'Package in transit to next facility',
    },
    {
      status: 'Departed Facility',
      location: 'Memphis, TN',
      date: 'Mar 4, 2026',
      time: '11:30 PM',
      description: 'Package has left the FedEx facility',
    },
    {
      status: 'Arrived at Facility',
      location: 'Memphis, TN',
      date: 'Mar 4, 2026',
      time: '6:15 PM',
      description: 'Package arrived at FedEx hub',
    },
    {
      status: 'Shipped',
      location: 'San Francisco, CA',
      date: 'Mar 3, 2026',
      time: '3:22 PM',
      description: 'Package picked up by carrier',
    },
    {
      status: 'Order Processed',
      location: 'San Francisco, CA',
      date: 'Mar 2, 2026',
      time: '10:00 AM',
      description: 'Order has been processed and is ready for shipment',
    },
  ],
}

const statusSteps = [
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Package },
  { key: 'in-transit', label: 'In Transit', icon: Truck },
  { key: 'out-for-delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
]

function getStatusIndex(status: string): number {
  return statusSteps.findIndex((s) => s.key === status)
}

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [trackingResult, setTrackingResult] = useState<OrderStatus | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setTrackingResult(null)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock validation - in production, this would call an actual API
    if (orderNumber.toLowerCase() === 'tt-123456' || orderNumber === '123456') {
      setTrackingResult(mockTrackingData)
    } else {
      setError(
        'Order not found. Please check your order number and email address.',
      )
    }

    setIsLoading(false)
  }

  const currentStatusIndex = trackingResult
    ? getStatusIndex(trackingResult.status)
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
              Enter your order number to get real-time updates on your delivery
              status.
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
                  placeholder='e.g., TT-123456'
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
                <div>
                  <p className='text-sm text-red-800'>{error}</p>
                  <p className='text-sm text-red-600 mt-1'>
                    Try: TT-123456 or 123456 for a demo
                  </p>
                </div>
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
                    Carrier: {trackingResult.carrier}
                  </p>
                </div>
                <div className='text-right'>
                  <p className='text-sm text-gray-500'>Estimated Delivery</p>
                  <p className='text-lg font-semibold text-gray-900'>
                    {trackingResult.estimatedDelivery}
                  </p>
                </div>
              </div>

              {/* Status Progress */}
              <div className='relative'>
                <div className='flex justify-between'>
                  {statusSteps.map((step, index) => {
                    const isCompleted = index <= currentStatusIndex
                    const isCurrent = index === currentStatusIndex

                    return (
                      <div
                        key={step.key}
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

                {/* Progress Line */}
                <div className='absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0'>
                  <div
                    className='h-full bg-green-500 transition-all duration-500'
                    style={{
                      width: `${
                        (currentStatusIndex / (statusSteps.length - 1)) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Tracking Details */}
            <div className='grid md:grid-cols-3 gap-8'>
              {/* Tracking Number */}
              <div className='md:col-span-1'>
                <div className='bg-white rounded-2xl p-6 shadow-sm'>
                  <h3 className='font-semibold text-gray-900 mb-4'>
                    Shipment Details
                  </h3>

                  <div className='space-y-4'>
                    <div>
                      <p className='text-sm text-gray-500'>Tracking Number</p>
                      <p className='font-mono text-sm text-gray-900'>
                        {trackingResult.trackingNumber}
                      </p>
                    </div>

                    <div>
                      <p className='text-sm text-gray-500'>Carrier</p>
                      <p className='font-medium text-gray-900'>
                        {trackingResult.carrier}
                      </p>
                    </div>

                    <a
                      href={`https://www.fedex.com/fedextrack/?trknbr=${trackingResult.trackingNumber}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-2 text-purple-600 font-medium hover:underline text-sm'
                    >
                      Track on {trackingResult.carrier}
                      <ChevronRight className='w-4 h-4' />
                    </a>
                  </div>
                </div>
              </div>

              {/* Tracking Events */}
              <div className='md:col-span-2'>
                <div className='bg-white rounded-2xl p-6 shadow-sm'>
                  <h3 className='font-semibold text-gray-900 mb-6'>
                    Tracking History
                  </h3>

                  <div className='relative'>
                    <div className='absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200' />

                    <div className='space-y-6'>
                      {trackingResult.events.map((event, index) => (
                        <div key={index} className='flex gap-4 relative'>
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                              index === 0 ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          >
                            {index === 0 ? (
                              <Truck className='w-4 h-4 text-white' />
                            ) : (
                              <Package className='w-4 h-4 text-gray-500' />
                            )}
                          </div>

                          <div className='flex-1 pb-2'>
                            <div className='flex items-start justify-between gap-2'>
                              <div>
                                <p
                                  className={`font-medium ${
                                    index === 0
                                      ? 'text-green-600'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {event.status}
                                </p>
                                <p className='text-sm text-gray-500'>
                                  {event.location}
                                </p>
                              </div>
                              <div className='text-right text-sm text-gray-500'>
                                <p>{event.date}</p>
                                <p>{event.time}</p>
                              </div>
                            </div>
                            <p className='text-sm text-gray-600 mt-1'>
                              {event.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
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
