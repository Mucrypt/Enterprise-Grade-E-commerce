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
import { ordersApiNew, affiliatesApi } from '../api'
import { StripeElementsWrapper } from '../contexts/StripeContext'
import StripePaymentForm from '../components/checkout/StripePaymentForm'
import { countriesSortedByName } from '../data/countries'
import { useEventTracking } from '../hooks/useEventTracking'
import { getReferralCode } from '../utils/referral-cookie'

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
  const { trackPaymentSuccess } = useEventTracking()

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping')
  const [shipping, setShipping] = useState<ShippingAddress>(initialShipping)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGuestCheckout, setIsGuestCheckout] = useState(!isAuthenticated)
  const [guestEmail, setGuestEmail] = useState('')

  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [_paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)

  // Set once the order draft + PaymentIntent are created together on the
  // server (before payment is confirmed) -- the order already exists by the
  // time the shopper reaches the payment step, so handlePaymentSuccess just
  // finalizes the UI instead of creating the order after the fact.
  const [orderDraft, setOrderDraft] = useState<{
    orderId: string
    orderNumber: string
    checkoutToken?: string
    taxAmount: number
    shippingAmount: number
    grandTotal: number
    storeCreditApplied: number
  } | null>(null)

  // Store credit -- authenticated shoppers only (a guest has no account to
  // hold a balance). Fetched once on mount; the actual redemption amount
  // is computed and clamped server-side against the real, up-to-date
  // balance when the order draft is created, so this is just what's shown
  // as the toggle's available amount.
  const [storeCreditBalance, setStoreCreditBalance] = useState(0)
  const [useStoreCredit, setUseStoreCredit] = useState(false)
  useEffect(() => {
    if (!isAuthenticated) return
    affiliatesApi
      .getMyStoreCredit()
      .then((res) => setStoreCreditBalance(res.balance))
      .catch(() => setStoreCreditBalance(0))
  }, [isAuthenticated])

  const subtotal = getSubtotal()
  // Client-side estimate shown before the order draft exists; once it does,
  // the server-computed totals below are authoritative and take over.
  const shippingCost = subtotal >= 50 ? 0 : 5.99
  const tax = subtotal * 0.08 // 8% tax
  const total = subtotal + shippingCost + tax

  const displayShippingCost = orderDraft?.shippingAmount ?? shippingCost
  const displayTax = orderDraft?.taxAmount ?? tax
  // grandTotal itself is always the real, undiscounted order value (kept
  // that way for refund/commission math) -- storeCreditApplied is
  // subtracted here only for what's actually shown as due/charged.
  const displayTotal = orderDraft
    ? orderDraft.grandTotal - orderDraft.storeCreditApplied
    : total

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

  // Create the order (pending payment) + PaymentIntent together when moving
  // to the payment step -- server prices everything from the database, so
  // the order and the amount Stripe will charge can never disagree, and the
  // order exists before any money can be captured.
  const createCheckoutSession = useCallback(async () => {
    try {
      setError(null)

      const orderItems = items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))
      const shippingAddressPayload = {
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
      }

      const referralCode = getReferralCode() || undefined

      let checkoutToken: string | undefined
      let result: {
        clientSecret: string
        paymentIntentId: string
        orderId: string
        orderNumber: string
        taxAmount: number
        shippingAmount: number
        grandTotal: number
        storeCreditApplied?: number
      }

      if (isGuestCheckout) {
        const guestResult = await ordersApiNew.guestCheckoutSession({
          items: orderItems,
          shippingAddress: shippingAddressPayload,
          guestEmail: guestEmail || shipping.email,
          guestPhone: shipping.phone,
          referralCode,
        })
        result = guestResult
        checkoutToken = guestResult.checkoutToken
      } else {
        result = await ordersApiNew.checkoutSession({
          items: orderItems,
          shippingAddress: shippingAddressPayload,
          referralCode,
          useStoreCredit: useStoreCredit && storeCreditBalance > 0,
        })
      }

      setClientSecret(result.clientSecret)
      setPaymentIntentId(result.paymentIntentId)
      setOrderDraft({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        checkoutToken,
        taxAmount: result.taxAmount,
        shippingAmount: result.shippingAmount,
        grandTotal: result.grandTotal,
        storeCreditApplied: result.storeCreditApplied || 0,
      })
    } catch (err) {
      console.error('Failed to start checkout:', err)
      setError('Failed to initialize payment. Please try again.')
    }
  }, [items, shipping, isGuestCheckout, guestEmail, useStoreCredit, storeCreditBalance])

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

      // Create the order draft + PaymentIntent before moving to payment step
      await createCheckoutSession()
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

  // Handle successful payment. The order already exists (created in
  // createCheckoutSession before payment was attempted) -- final
  // confirmation (payment_status -> paid) happens server-side via the
  // Stripe webhook, so this just finalizes the UI.
  const handlePaymentSuccess = async (_completedPaymentIntentId: string) => {
    setIsProcessing(true)
    setError(null)

    try {
      if (!orderDraft) {
        throw new Error('Missing order details for this payment')
      }

      trackPaymentSuccess(
        orderDraft.orderId,
        orderDraft.grandTotal,
        items.length,
        'EUR',
      )

      setPaymentComplete(true)

      // Clear cart and redirect to success
      clearCart()
      navigate('/order-confirmation', {
        state: {
          orderNumber: orderDraft.orderNumber,
          orderId: orderDraft.orderId,
          total: orderDraft.grandTotal,
          email: guestEmail || shipping.email,
          checkoutToken: orderDraft.checkoutToken,
          isGuest: isGuestCheckout,
        },
      })
    } catch (err: unknown) {
      console.error('Failed to finalize order confirmation:', err)
      setError(
        'Payment was successful, but we could not finalize your confirmation. Please check your email or contact support.',
      )
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
                {/* Guest vs Login Toggle */}
                {!isAuthenticated && (
                  <div className='mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='font-medium text-gray-900'>
                          {isGuestCheckout
                            ? 'Guest Checkout'
                            : 'Have an Account?'}
                        </p>
                        <p className='text-sm text-gray-600 mt-1'>
                          {isGuestCheckout
                            ? 'Checkout as a guest - no account needed'
                            : 'Sign in to your account to access saved addresses'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (isGuestCheckout) {
                            // Switch to login
                            setIsGuestCheckout(false)
                          } else {
                            // Switch to guest
                            setIsGuestCheckout(true)
                            setGuestEmail('')
                          }
                        }}
                        className='px-4 py-2 text-blue-600 hover:text-blue-700 font-medium border border-blue-600 rounded-lg hover:bg-blue-50 transition'
                      >
                        {isGuestCheckout ? 'Sign In' : 'Guest Checkout'}
                      </button>
                    </div>
                  </div>
                )}

                <h2 className='text-xl font-bold text-gray-900 mb-6 flex items-center gap-2'>
                  <MapPin className='w-5 h-5 text-blue-600' />
                  Shipping Address
                </h2>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  {isGuestCheckout && (
                    <div className='sm:col-span-2'>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        Email Address * (for order updates)
                      </label>
                      <input
                        type='email'
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                        placeholder='your.email@example.com'
                        required
                      />
                    </div>
                  )}
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
                {isAuthenticated && storeCreditBalance > 0 && (
                  <div className='flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2'>
                    <label className='flex items-center gap-2 text-sm text-emerald-800'>
                      <input
                        type='checkbox'
                        checked={useStoreCredit}
                        disabled={!!orderDraft}
                        onChange={(e) => setUseStoreCredit(e.target.checked)}
                        className='h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500'
                      />
                      Use store credit ({formatPrice(storeCreditBalance)} available)
                    </label>
                  </div>
                )}
                {orderDraft && orderDraft.storeCreditApplied > 0 && (
                  <div className='flex justify-between text-emerald-600'>
                    <span>Store credit applied</span>
                    <span className='font-medium'>-{formatPrice(orderDraft.storeCreditApplied)}</span>
                  </div>
                )}
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Shipping</span>
                  <span
                    className={cn(
                      'font-medium',
                      displayShippingCost === 0 && 'text-green-600',
                    )}
                  >
                    {displayShippingCost === 0
                      ? 'FREE'
                      : formatPrice(displayShippingCost)}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Tax (8%)</span>
                  <span className='font-medium'>{formatPrice(displayTax)}</span>
                </div>
                <div className='border-t pt-3 mt-3'>
                  <div className='flex justify-between'>
                    <span className='text-lg font-bold text-gray-900'>
                      Total
                    </span>
                    <span className='text-lg font-bold text-blue-600'>
                      {formatPrice(displayTotal)}
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
