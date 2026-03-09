// ============================================
// Checkout Page - Multi-Step Checkout with Stripe
// Enterprise-grade payment integration
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ChevronLeft,
  MapPin,
  CreditCard,
  Package,
  CheckCircle,
  Truck,
  ShieldCheck,
  Lock,
  AlertCircle,
} from 'lucide-react'
import { useCartStore, useAuthStore } from '../stores'
import { formatPrice, getProductImage, cn } from '../utils'
import { paymentsApi, ordersApiNew } from '../api'
import { StripeElementsWrapper } from '../contexts/StripeContext'
import StripePaymentForm from '../components/checkout/StripePaymentForm'
import { countriesSortedByName } from '../data/countries'

// Step types
type CheckoutStep = 'shipping' | 'payment' | 'review'

interface ShippingAddress {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  apartment: string
  city: string
  state: string
  postalCode: string
  country: string
}

const initialShipping: ShippingAddress = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  apartment: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
}

const steps: {
  id: CheckoutStep
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'shipping', label: 'Shipping', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'review', label: 'Confirm', icon: Package },
]

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, getSubtotal, clearCart } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping')
  const [shipping, setShipping] = useState<ShippingAddress>(initialShipping)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [_paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)

  const subtotal = getSubtotal()
  const shippingCost = subtotal >= 50 ? 0 : 5.99
  const tax = subtotal * 0.08 // 8% tax
  const total = subtotal + shippingCost + tax

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !paymentComplete) {
      navigate('/cart')
    }
  }, [items.length, navigate, paymentComplete])

  // Pre-fill user data if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setShipping((prev) => ({
        ...prev,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
      }))
    }
  }, [isAuthenticated, user])

  // Create payment intent when moving to payment step
  const createPaymentIntent = useCallback(async () => {
    try {
      setError(null)

      const paymentItems = items.map((item) => ({
        productId: item.product.id,
        price: Number(item.product.sale_price || item.product.base_price),
        quantity: item.quantity,
      }))

      const result = await paymentsApi.createPaymentIntent({
        items: paymentItems,
        shippingAddress: {
          name: `${shipping.firstName} ${shipping.lastName}`,
          address: shipping.address,
          apartment: shipping.apartment,
          city: shipping.city,
          state: shipping.state,
          postalCode: shipping.postalCode,
          country: shipping.country,
        },
        currency: 'usd',
      })

      setClientSecret(result.clientSecret)
      setPaymentIntentId(result.paymentIntentId)
    } catch (err) {
      console.error('Failed to create payment intent:', err)
      setError('Failed to initialize payment. Please try again.')
    }
  }, [items, shipping])

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const goToStep = (step: CheckoutStep) => {
    const targetIndex = steps.findIndex((s) => s.id === step)
    if (targetIndex <= currentStepIndex) {
      setCurrentStep(step)
    }
  }

  const validateShipping = (): boolean => {
    if (
      !shipping.firstName ||
      !shipping.lastName ||
      !shipping.email ||
      !shipping.address ||
      !shipping.city ||
      !shipping.postalCode
    ) {
      setError('Please fill in all required fields')
      return false
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(shipping.email)) {
      setError('Please enter a valid email address')
      return false
    }

    return true
  }

  const nextStep = async () => {
    setError(null)

    if (currentStep === 'shipping') {
      if (!validateShipping()) return

      // Create payment intent before moving to payment step
      await createPaymentIntent()
      setCurrentStep('payment')
    } else if (currentStep === 'payment') {
      // Payment step is handled by Stripe form
      // This button won't be shown in payment step
    }
  }

  const prevStep = () => {
    if (currentStep === 'payment') setCurrentStep('shipping')
    else if (currentStep === 'review') setCurrentStep('payment')
  }

  // Handle successful payment
  const handlePaymentSuccess = async (completedPaymentIntentId: string) => {
    setIsProcessing(true)
    setError(null)

    try {
      // Create the order
      const order = await ordersApiNew.create({
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        shippingAddress: {
          firstName: shipping.firstName,
          lastName: shipping.lastName,
          email: shipping.email,
          phone: shipping.phone,
          address: shipping.address,
          apartment: shipping.apartment,
          city: shipping.city,
          state: shipping.state,
          postalCode: shipping.postalCode,
          country: shipping.country,
        },
        paymentIntentId: completedPaymentIntentId,
        paymentMethod: 'card',
      })

      setPaymentComplete(true)

      // Clear cart and redirect to success
      clearCart()
      navigate('/order-confirmation', {
        state: {
          orderNumber: order.order_number,
          orderId: order.id,
          total: order.grand_total,
          email: shipping.email,
        },
      })
    } catch (err: unknown) {
      console.error('Failed to create order:', err)
      // Extract the actual error message from the API response
      let errorMessage =
        'Payment successful but failed to create order. Please contact support.'
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as {
          response?: { data?: { error?: string; message?: string } }
        }
        const apiError =
          axiosError.response?.data?.error || axiosError.response?.data?.message
        if (apiError) {
          errorMessage = `Payment successful but order creation failed: ${apiError}`
          console.error('API Error Details:', axiosError.response?.data)
        }
      }
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage)
    setIsProcessing(false)
  }

  return (
    <div className='bg-gray-50 min-h-screen py-8'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>Checkout</h1>
          <p className='text-gray-600 mt-1'>Complete your order securely</p>
        </div>

        {/* Progress Steps */}
        <div className='mb-8'>
          <div className='flex items-center justify-center'>
            {steps.map((step, index) => {
              const isActive = step.id === currentStep
              const isCompleted = currentStepIndex > index
              const Icon = step.icon

              return (
                <div key={step.id} className='flex items-center'>
                  <button
                    onClick={() => goToStep(step.id)}
                    disabled={index > currentStepIndex}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full transition-all',
                      isActive && 'bg-blue-600 text-white',
                      isCompleted && 'bg-green-500 text-white cursor-pointer',
                      !isActive && !isCompleted && 'bg-gray-200 text-gray-500',
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className='w-5 h-5' />
                    ) : (
                      <Icon className='w-5 h-5' />
                    )}
                    <span className='font-medium hidden sm:inline'>
                      {step.label}
                    </span>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'w-12 sm:w-24 h-1 mx-2',
                        isCompleted ? 'bg-green-500' : 'bg-gray-200',
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700'>
            <AlertCircle className='w-5 h-5 shrink-0' />
            {error}
          </div>
        )}

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Main Content */}
          <div className='lg:col-span-2'>
            {/* Shipping Step */}
            {currentStep === 'shipping' && (
              <div className='bg-white rounded-xl p-6 shadow-sm'>
                <h2 className='text-xl font-bold text-gray-900 mb-6 flex items-center gap-2'>
                  <MapPin className='w-5 h-5 text-blue-600' />
                  Shipping Address
                </h2>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      First Name *
                    </label>
                    <input
                      type='text'
                      value={shipping.firstName}
                      onChange={(e) =>
                        setShipping({ ...shipping, firstName: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      required
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Last Name *
                    </label>
                    <input
                      type='text'
                      value={shipping.lastName}
                      onChange={(e) =>
                        setShipping({ ...shipping, lastName: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      required
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Email *
                    </label>
                    <input
                      type='email'
                      value={shipping.email}
                      onChange={(e) =>
                        setShipping({ ...shipping, email: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      required
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Phone Number
                    </label>
                    <input
                      type='tel'
                      value={shipping.phone}
                      onChange={(e) =>
                        setShipping({ ...shipping, phone: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                  </div>
                  <div className='sm:col-span-2'>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Street Address *
                    </label>
                    <input
                      type='text'
                      value={shipping.address}
                      onChange={(e) =>
                        setShipping({ ...shipping, address: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      placeholder='123 Main St'
                      required
                    />
                  </div>
                  <div className='sm:col-span-2'>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Apartment, suite, etc. (optional)
                    </label>
                    <input
                      type='text'
                      value={shipping.apartment}
                      onChange={(e) =>
                        setShipping({ ...shipping, apartment: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      City *
                    </label>
                    <input
                      type='text'
                      value={shipping.city}
                      onChange={(e) =>
                        setShipping({ ...shipping, city: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      required
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      State / Region
                    </label>
                    <input
                      type='text'
                      value={shipping.state}
                      onChange={(e) =>
                        setShipping({ ...shipping, state: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Postal Code *
                    </label>
                    <input
                      type='text'
                      value={shipping.postalCode}
                      onChange={(e) =>
                        setShipping({ ...shipping, postalCode: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      required
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Country *
                    </label>
                    <select
                      value={shipping.country}
                      onChange={(e) =>
                        setShipping({ ...shipping, country: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    >
                      <option value=''>Select Country</option>
                      {countriesSortedByName.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Shipping Method */}
                <div className='mt-8'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                    Shipping Method
                  </h3>
                  <div className='space-y-3'>
                    <label className='flex items-center p-4 border border-blue-500 bg-blue-50 rounded-lg cursor-pointer'>
                      <input
                        type='radio'
                        name='shipping'
                        defaultChecked
                        className='text-blue-600'
                      />
                      <div className='ml-3 flex-1'>
                        <p className='font-medium text-gray-900'>
                          Standard Shipping
                        </p>
                        <p className='text-sm text-gray-500'>
                          3-5 business days
                        </p>
                      </div>
                      <span className='font-semibold text-gray-900'>
                        {shippingCost === 0
                          ? 'FREE'
                          : formatPrice(shippingCost)}
                      </span>
                    </label>
                    <label className='flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:border-gray-400'>
                      <input
                        type='radio'
                        name='shipping'
                        className='text-blue-600'
                      />
                      <div className='ml-3 flex-1'>
                        <p className='font-medium text-gray-900'>
                          Express Shipping
                        </p>
                        <p className='text-sm text-gray-500'>
                          1-2 business days
                        </p>
                      </div>
                      <span className='font-semibold text-gray-900'>
                        {formatPrice(14.99)}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Continue Button */}
                <div className='mt-8 flex justify-end'>
                  <button
                    onClick={nextStep}
                    className='flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors'
                  >
                    Continue to Payment
                    <ChevronRight className='w-5 h-5' />
                  </button>
                </div>
              </div>
            )}

            {/* Payment Step */}
            {currentStep === 'payment' && (
              <div className='bg-white rounded-xl p-6 shadow-sm'>
                <h2 className='text-xl font-bold text-gray-900 mb-6 flex items-center gap-2'>
                  <CreditCard className='w-5 h-5 text-blue-600' />
                  Payment
                </h2>

                {/* Shipping Summary */}
                <div className='mb-6 p-4 bg-gray-50 rounded-lg'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-sm text-gray-500'>Shipping to</p>
                      <p className='font-medium text-gray-900'>
                        {shipping.firstName} {shipping.lastName}
                      </p>
                      <p className='text-sm text-gray-600'>
                        {shipping.address}, {shipping.city},{' '}
                        {shipping.postalCode}
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentStep('shipping')}
                      className='text-blue-600 hover:text-blue-700 text-sm font-medium'
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Stripe Payment Form */}
                {clientSecret ? (
                  <StripeElementsWrapper clientSecret={clientSecret}>
                    <StripePaymentForm
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      isProcessing={isProcessing}
                      setIsProcessing={setIsProcessing}
                      returnUrl={`${window.location.origin}/order-confirmation`}
                      billingDetails={{
                        name: `${shipping.firstName} ${shipping.lastName}`,
                        email: shipping.email,
                        address: {
                          line1: shipping.address,
                          line2: shipping.apartment,
                          city: shipping.city,
                          state: shipping.state,
                          postal_code: shipping.postalCode,
                          country: shipping.country,
                        },
                      }}
                    />
                  </StripeElementsWrapper>
                ) : (
                  <div className='flex items-center justify-center py-12'>
                    <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600'></div>
                    <span className='ml-3 text-gray-600'>
                      Loading payment form...
                    </span>
                  </div>
                )}

                {/* Back Button */}
                <div className='mt-6 pt-6 border-t'>
                  <button
                    onClick={prevStep}
                    className='flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors'
                  >
                    <ChevronLeft className='w-5 h-5' />
                    Back to Shipping
                  </button>
                </div>
              </div>
            )}

            {/* Review Step (shown after successful payment) */}
            {currentStep === 'review' && (
              <div className='space-y-6'>
                <div className='bg-green-50 border border-green-200 rounded-xl p-6'>
                  <div className='flex items-center gap-3'>
                    <CheckCircle className='w-8 h-8 text-green-600' />
                    <div>
                      <h3 className='text-lg font-semibold text-green-800'>
                        Payment Successful!
                      </h3>
                      <p className='text-green-700'>
                        Your order is being processed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className='lg:col-span-1'>
            <div className='bg-white rounded-xl p-6 shadow-sm sticky top-24'>
              <h2 className='text-lg font-bold text-gray-900 mb-4'>
                Order Summary
              </h2>

              {/* Items Preview */}
              <div className='space-y-3 mb-6'>
                {items.slice(0, 3).map((item) => (
                  <div key={item.id} className='flex gap-3'>
                    <div className='relative w-14 h-14 shrink-0'>
                      <img
                        src={getProductImage(item.product, { w: 56, h: 56 })}
                        alt={item.product.name}
                        className='w-full h-full object-cover rounded-lg'
                      />
                      <span className='absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center'>
                        {item.quantity}
                      </span>
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-gray-900 line-clamp-1'>
                        {item.product.name}
                      </p>
                      <p className='text-sm text-gray-500'>
                        {formatPrice(
                          item.product.sale_price || item.product.base_price,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                {items.length > 3 && (
                  <p className='text-sm text-gray-500 text-center'>
                    +{items.length - 3} more items
                  </p>
                )}
              </div>

              {/* Totals */}
              <div className='space-y-3 text-sm border-t pt-4'>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Subtotal</span>
                  <span className='font-medium'>{formatPrice(subtotal)}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Shipping</span>
                  <span
                    className={cn(
                      'font-medium',
                      shippingCost === 0 && 'text-green-600',
                    )}
                  >
                    {shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Tax (8%)</span>
                  <span className='font-medium'>{formatPrice(tax)}</span>
                </div>
                <div className='border-t pt-3 mt-3'>
                  <div className='flex justify-between'>
                    <span className='text-lg font-bold text-gray-900'>
                      Total
                    </span>
                    <span className='text-lg font-bold text-blue-600'>
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className='mt-6 pt-6 border-t space-y-3'>
                <div className='flex items-center gap-2 text-sm text-gray-600'>
                  <ShieldCheck className='w-5 h-5 text-green-600' />
                  <span>Secure SSL Encryption</span>
                </div>
                <div className='flex items-center gap-2 text-sm text-gray-600'>
                  <Lock className='w-5 h-5 text-blue-600' />
                  <span>Powered by Stripe</span>
                </div>
                <div className='flex items-center gap-2 text-sm text-gray-600'>
                  <Truck className='w-5 h-5 text-gray-600' />
                  <span>Estimated delivery: 3-5 days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
