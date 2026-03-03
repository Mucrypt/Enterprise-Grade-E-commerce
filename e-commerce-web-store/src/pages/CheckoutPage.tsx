// ============================================
// Checkout Page - Multi-Step Checkout Flow
// ============================================

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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

interface PaymentInfo {
  method: 'card' | 'paypal' | 'bank'
  cardNumber: string
  cardName: string
  expiry: string
  cvv: string
  saveCard: boolean
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
  country: 'LT',
}

const initialPayment: PaymentInfo = {
  method: 'card',
  cardNumber: '',
  cardName: '',
  expiry: '',
  cvv: '',
  saveCard: false,
}

const steps: {
  id: CheckoutStep
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'shipping', label: 'Shipping', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'review', label: 'Review', icon: Package },
]

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, getSubtotal, clearCart } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping')
  const [shipping, setShipping] = useState<ShippingAddress>(initialShipping)
  const [payment, setPayment] = useState<PaymentInfo>(initialPayment)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal = getSubtotal()
  const shippingCost = subtotal >= 50 ? 0 : 5.99
  const tax = subtotal * 0.21
  const total = subtotal + shippingCost + tax

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart')
    }
  }, [items.length, navigate])

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

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const goToStep = (step: CheckoutStep) => {
    const targetIndex = steps.findIndex((s) => s.id === step)
    if (targetIndex <= currentStepIndex) {
      setCurrentStep(step)
    }
  }

  const nextStep = () => {
    if (currentStep === 'shipping') {
      // Validate shipping
      if (
        !shipping.firstName ||
        !shipping.lastName ||
        !shipping.email ||
        !shipping.address ||
        !shipping.city ||
        !shipping.postalCode
      ) {
        setError('Please fill in all required fields')
        return
      }
      setError(null)
      setCurrentStep('payment')
    } else if (currentStep === 'payment') {
      // Validate payment
      if (
        payment.method === 'card' &&
        (!payment.cardNumber ||
          !payment.cardName ||
          !payment.expiry ||
          !payment.cvv)
      ) {
        setError('Please fill in all card details')
        return
      }
      setError(null)
      setCurrentStep('review')
    }
  }

  const prevStep = () => {
    if (currentStep === 'payment') setCurrentStep('shipping')
    else if (currentStep === 'review') setCurrentStep('payment')
  }

  const handlePlaceOrder = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      // Simulate order processing
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Clear cart and redirect to success
      clearCart()
      navigate('/order-confirmation', {
        state: {
          orderNumber: `TT-${Date.now().toString().slice(-8)}`,
          total,
          email: shipping.email,
        },
      })
    } catch (err) {
      setError('Failed to process order. Please try again.')
    } finally {
      setIsProcessing(false)
    }
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
                      isActive && 'bg-orange-500 text-white',
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
                  <MapPin className='w-5 h-5 text-orange-500' />
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                      required
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Phone Number *
                    </label>
                    <input
                      type='tel'
                      value={shipping.phone}
                      onChange={(e) =>
                        setShipping({ ...shipping, phone: e.target.value })
                      }
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                    >
                      <option value='LT'>Lithuania</option>
                      <option value='LV'>Latvia</option>
                      <option value='EE'>Estonia</option>
                      <option value='PL'>Poland</option>
                      <option value='DE'>Germany</option>
                      <option value='FR'>France</option>
                      <option value='GB'>United Kingdom</option>
                    </select>
                  </div>
                </div>

                {/* Shipping Method */}
                <div className='mt-8'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                    Shipping Method
                  </h3>
                  <div className='space-y-3'>
                    <label className='flex items-center p-4 border border-orange-500 bg-orange-50 rounded-lg cursor-pointer'>
                      <input
                        type='radio'
                        name='shipping'
                        defaultChecked
                        className='text-orange-500'
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
                        className='text-orange-500'
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
              </div>
            )}

            {/* Payment Step */}
            {currentStep === 'payment' && (
              <div className='bg-white rounded-xl p-6 shadow-sm'>
                <h2 className='text-xl font-bold text-gray-900 mb-6 flex items-center gap-2'>
                  <CreditCard className='w-5 h-5 text-orange-500' />
                  Payment Method
                </h2>

                {/* Payment Methods */}
                <div className='space-y-3 mb-6'>
                  <label
                    className={cn(
                      'flex items-center p-4 border rounded-lg cursor-pointer transition-all',
                      payment.method === 'card'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-gray-400',
                    )}
                  >
                    <input
                      type='radio'
                      name='payment'
                      checked={payment.method === 'card'}
                      onChange={() =>
                        setPayment({ ...payment, method: 'card' })
                      }
                      className='text-orange-500'
                    />
                    <div className='ml-3 flex-1'>
                      <p className='font-medium text-gray-900'>
                        Credit / Debit Card
                      </p>
                      <p className='text-sm text-gray-500'>
                        Visa, Mastercard, American Express
                      </p>
                    </div>
                    <div className='flex gap-2'>
                      <div className='w-10 h-6 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold'>
                        VISA
                      </div>
                      <div className='w-10 h-6 bg-red-500 rounded text-white text-xs flex items-center justify-center font-bold'>
                        MC
                      </div>
                    </div>
                  </label>

                  <label
                    className={cn(
                      'flex items-center p-4 border rounded-lg cursor-pointer transition-all',
                      payment.method === 'paypal'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-gray-400',
                    )}
                  >
                    <input
                      type='radio'
                      name='payment'
                      checked={payment.method === 'paypal'}
                      onChange={() =>
                        setPayment({ ...payment, method: 'paypal' })
                      }
                      className='text-orange-500'
                    />
                    <div className='ml-3 flex-1'>
                      <p className='font-medium text-gray-900'>PayPal</p>
                      <p className='text-sm text-gray-500'>
                        Fast and secure payment
                      </p>
                    </div>
                    <div className='w-16 h-6 bg-blue-700 rounded text-white text-xs flex items-center justify-center font-bold'>
                      PayPal
                    </div>
                  </label>

                  <label
                    className={cn(
                      'flex items-center p-4 border rounded-lg cursor-pointer transition-all',
                      payment.method === 'bank'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-gray-400',
                    )}
                  >
                    <input
                      type='radio'
                      name='payment'
                      checked={payment.method === 'bank'}
                      onChange={() =>
                        setPayment({ ...payment, method: 'bank' })
                      }
                      className='text-orange-500'
                    />
                    <div className='ml-3 flex-1'>
                      <p className='font-medium text-gray-900'>Bank Transfer</p>
                      <p className='text-sm text-gray-500'>
                        Direct bank payment
                      </p>
                    </div>
                  </label>
                </div>

                {/* Card Details */}
                {payment.method === 'card' && (
                  <div className='space-y-4 p-4 bg-gray-50 rounded-lg'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        Card Number
                      </label>
                      <input
                        type='text'
                        value={payment.cardNumber}
                        onChange={(e) =>
                          setPayment({ ...payment, cardNumber: e.target.value })
                        }
                        placeholder='1234 5678 9012 3456'
                        className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                        maxLength={19}
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        Name on Card
                      </label>
                      <input
                        type='text'
                        value={payment.cardName}
                        onChange={(e) =>
                          setPayment({ ...payment, cardName: e.target.value })
                        }
                        placeholder='John Doe'
                        className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                      />
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Expiry Date
                        </label>
                        <input
                          type='text'
                          value={payment.expiry}
                          onChange={(e) =>
                            setPayment({ ...payment, expiry: e.target.value })
                          }
                          placeholder='MM/YY'
                          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                          maxLength={5}
                        />
                      </div>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          CVV
                        </label>
                        <input
                          type='text'
                          value={payment.cvv}
                          onChange={(e) =>
                            setPayment({ ...payment, cvv: e.target.value })
                          }
                          placeholder='123'
                          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                          maxLength={4}
                        />
                      </div>
                    </div>
                    <label className='flex items-center gap-2 cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={payment.saveCard}
                        onChange={(e) =>
                          setPayment({ ...payment, saveCard: e.target.checked })
                        }
                        className='rounded text-orange-500'
                      />
                      <span className='text-sm text-gray-600'>
                        Save card for future purchases
                      </span>
                    </label>
                  </div>
                )}

                {/* PayPal */}
                {payment.method === 'paypal' && (
                  <div className='p-6 bg-gray-50 rounded-lg text-center'>
                    <p className='text-gray-600 mb-4'>
                      You will be redirected to PayPal to complete your payment.
                    </p>
                    <div className='w-32 h-10 bg-blue-700 rounded mx-auto text-white flex items-center justify-center font-bold'>
                      PayPal
                    </div>
                  </div>
                )}

                {/* Bank Transfer */}
                {payment.method === 'bank' && (
                  <div className='p-6 bg-gray-50 rounded-lg'>
                    <p className='text-gray-600 mb-4'>
                      Bank transfer details will be provided after order
                      placement.
                    </p>
                    <div className='text-sm text-gray-500'>
                      <p>
                        • Order will be processed after payment confirmation
                      </p>
                      <p>• Payment must be made within 48 hours</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Review Step */}
            {currentStep === 'review' && (
              <div className='space-y-6'>
                {/* Shipping Summary */}
                <div className='bg-white rounded-xl p-6 shadow-sm'>
                  <div className='flex items-center justify-between mb-4'>
                    <h3 className='text-lg font-semibold text-gray-900 flex items-center gap-2'>
                      <MapPin className='w-5 h-5 text-orange-500' />
                      Shipping Address
                    </h3>
                    <button
                      onClick={() => setCurrentStep('shipping')}
                      className='text-orange-500 hover:text-orange-600 text-sm font-medium'
                    >
                      Edit
                    </button>
                  </div>
                  <div className='text-gray-600'>
                    <p className='font-medium text-gray-900'>
                      {shipping.firstName} {shipping.lastName}
                    </p>
                    <p>
                      {shipping.address}
                      {shipping.apartment && `, ${shipping.apartment}`}
                    </p>
                    <p>
                      {shipping.city}, {shipping.state} {shipping.postalCode}
                    </p>
                    <p>{shipping.country}</p>
                    <p className='mt-2'>{shipping.email}</p>
                    <p>{shipping.phone}</p>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className='bg-white rounded-xl p-6 shadow-sm'>
                  <div className='flex items-center justify-between mb-4'>
                    <h3 className='text-lg font-semibold text-gray-900 flex items-center gap-2'>
                      <CreditCard className='w-5 h-5 text-orange-500' />
                      Payment Method
                    </h3>
                    <button
                      onClick={() => setCurrentStep('payment')}
                      className='text-orange-500 hover:text-orange-600 text-sm font-medium'
                    >
                      Edit
                    </button>
                  </div>
                  <div className='text-gray-600'>
                    {payment.method === 'card' && (
                      <p>
                        Credit Card ending in {payment.cardNumber.slice(-4)}
                      </p>
                    )}
                    {payment.method === 'paypal' && <p>PayPal</p>}
                    {payment.method === 'bank' && <p>Bank Transfer</p>}
                  </div>
                </div>

                {/* Order Items */}
                <div className='bg-white rounded-xl p-6 shadow-sm'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                    <Package className='w-5 h-5 text-orange-500' />
                    Order Items ({items.length})
                  </h3>
                  <div className='space-y-4'>
                    {items.map((item) => (
                      <div key={item.id} className='flex gap-4'>
                        <img
                          src={getProductImage(item.product, { w: 64, h: 64 })}
                          alt={item.product.name}
                          className='w-16 h-16 object-cover rounded-lg'
                        />
                        <div className='flex-1'>
                          <p className='font-medium text-gray-900 line-clamp-1'>
                            {item.product.name}
                          </p>
                          <p className='text-sm text-gray-500'>
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <p className='font-medium text-gray-900'>
                          {formatPrice(
                            Number(
                              item.product.sale_price ||
                                item.product.base_price,
                            ) * item.quantity,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className='mt-6 flex items-center justify-between'>
              {currentStep !== 'shipping' ? (
                <button
                  onClick={prevStep}
                  className='flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors'
                >
                  <ChevronLeft className='w-5 h-5' />
                  Back
                </button>
              ) : (
                <Link
                  to='/cart'
                  className='flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors'
                >
                  <ChevronLeft className='w-5 h-5' />
                  Back to Cart
                </Link>
              )}

              {currentStep !== 'review' ? (
                <button
                  onClick={nextStep}
                  className='flex items-center gap-2 px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors'
                >
                  Continue
                  <ChevronRight className='w-5 h-5' />
                </button>
              ) : (
                <button
                  onClick={handlePlaceOrder}
                  disabled={isProcessing}
                  className={cn(
                    'flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl transition-colors',
                    isProcessing
                      ? 'opacity-70 cursor-not-allowed'
                      : 'hover:bg-green-700',
                  )}
                >
                  {isProcessing ? (
                    <>
                      <div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock className='w-5 h-5' />
                      Place Order - {formatPrice(total)}
                    </>
                  )}
                </button>
              )}
            </div>
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
                      <span className='absolute -top-2 -right-2 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center'>
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
                  <span className='text-gray-600'>VAT (21%)</span>
                  <span className='font-medium'>{formatPrice(tax)}</span>
                </div>
                <div className='border-t pt-3 mt-3'>
                  <div className='flex justify-between'>
                    <span className='text-lg font-bold text-gray-900'>
                      Total
                    </span>
                    <span className='text-lg font-bold text-orange-500'>
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
                  <Truck className='w-5 h-5 text-blue-600' />
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
