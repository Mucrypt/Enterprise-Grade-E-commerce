import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Loader,
  RefreshCw,
  Shield,
  ShoppingBag,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react'
import { paymentsApi } from '../api'
import { useAuthStore } from '../stores'

type PaymentMethodItem = {
  id: string
  type: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  isDefault: boolean
}

type PaymentHistoryItem = {
  id: string
  orderId: string
  orderNumber: string
  amount: number
  currency: string
  status: string
  paidAt: string
  createdAt: string
}

const currencyFormatter = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`
  }
}

export default function PaymentMethodsPage() {
  const navigate = useNavigate()
  const {
    user,
    isAuthenticated,
    hasHydrated,
    isLoading: authLoading,
  } = useAuthStore()
  const [actionId, setActionId] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      navigate('/login', { state: { from: { pathname: '/payment-methods' } } })
    }
  }, [authLoading, hasHydrated, isAuthenticated, navigate])

  const {
    data: paymentMethods = [],
    isLoading: paymentMethodsLoading,
    refetch: refetchPaymentMethods,
  } = useQuery<PaymentMethodItem[]>({
    queryKey: ['payment-methods', user?.id],
    queryFn: () => paymentsApi.getPaymentMethods(),
    enabled: hasHydrated && isAuthenticated,
    retry: false,
  })

  const { data: paymentHistoryData, isLoading: paymentHistoryLoading } =
    useQuery({
      queryKey: ['payment-history', user?.id],
      queryFn: () => paymentsApi.getPaymentHistory(1, 5),
      enabled: hasHydrated && isAuthenticated,
      retry: false,
    })

  const paymentHistory = paymentHistoryData?.payments ?? []

  const defaultPaymentMethod = useMemo(
    () => paymentMethods.find((method) => method.isDefault) || null,
    [paymentMethods],
  )

  const handleSetDefault = async (methodId: string) => {
    setActionId(methodId)
    setError('')
    setSuccess('')

    try {
      await paymentsApi.setDefaultPaymentMethod(methodId)
      await refetchPaymentMethods()
      setSuccess('Default payment method updated.')
    } catch {
      setError('Unable to update the default payment method.')
    } finally {
      setActionId(null)
    }
  }

  const handleRemove = async (methodId: string) => {
    const confirmed = window.confirm(
      'Remove this payment method from your account?',
    )

    if (!confirmed) return

    setActionId(methodId)
    setError('')
    setSuccess('')

    try {
      await paymentsApi.removePaymentMethod(methodId)
      await refetchPaymentMethods()
      setSuccess('Payment method removed.')
    } catch {
      setError('Unable to remove the payment method right now.')
    } finally {
      setActionId(null)
    }
  }

  if (authLoading || !hasHydrated) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <Loader className='h-8 w-8 animate-spin text-orange-500' />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='mx-auto max-w-6xl px-4'>
        <div className='mb-6 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between'>
          <div>
            <div className='mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-600'>
              <CreditCard className='h-3.5 w-3.5' />
              Payment Methods
            </div>
            <h1 className='text-3xl font-bold text-gray-900'>
              Manage your saved cards
            </h1>
            <p className='mt-2 max-w-2xl text-sm text-gray-500'>
              Review the payment methods tied to your account, update the
              default card, and check recent payment activity.
            </p>
          </div>

          <div className='flex flex-wrap gap-3'>
            <Link
              to='/profile'
              className='inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
            >
              <ArrowLeft className='h-4 w-4' />
              Back to profile
            </Link>
            <Link
              to='/checkout'
              className='inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600'
            >
              <ShoppingBag className='h-4 w-4' />
              Go to checkout
            </Link>
          </div>
        </div>

        {success && (
          <div className='mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700'>
            {success}
          </div>
        )}

        {error && (
          <div className='mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <div className='space-y-6 lg:col-span-2'>
            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <div className='mb-6 flex items-center justify-between gap-4'>
                <div>
                  <h2 className='text-xl font-bold text-gray-900'>
                    Saved payment methods
                  </h2>
                  <p className='mt-1 text-sm text-gray-500'>
                    Cards added to your account for faster checkout.
                  </p>
                </div>
                <div className='inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600'>
                  <Shield className='h-3.5 w-3.5' />
                  Secure account data
                </div>
              </div>

              {paymentMethodsLoading ? (
                <div className='flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500'>
                  <Loader className='h-4 w-4 animate-spin text-orange-500' />
                  Loading saved methods...
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className='rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center'>
                  <Wallet className='mx-auto h-10 w-10 text-orange-500' />
                  <h3 className='mt-4 text-lg font-semibold text-gray-900'>
                    No saved payment methods
                  </h3>
                  <p className='mt-2 text-sm text-gray-500'>
                    Add a card during checkout and it will appear here for quick
                    reuse.
                  </p>
                  <Link
                    to='/checkout'
                    className='mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600'
                  >
                    <CreditCard className='h-4 w-4' />
                    Add a payment method
                  </Link>
                </div>
              ) : (
                <div className='space-y-4'>
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className='rounded-2xl border border-gray-200 p-5 transition hover:border-orange-200 hover:shadow-sm'
                    >
                      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                        <div className='flex items-start gap-4'>
                          <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500'>
                            <CreditCard className='h-6 w-6' />
                          </div>
                          <div>
                            <div className='flex flex-wrap items-center gap-2'>
                              <h3 className='text-lg font-semibold text-gray-900'>
                                {(method.brand || method.type)
                                  .replace(/_/g, ' ')
                                  .toUpperCase()}{' '}
                                ending in {method.last4 || '----'}
                              </h3>
                              {method.isDefault && (
                                <span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'>
                                  <BadgeCheck className='h-3.5 w-3.5' />
                                  Default
                                </span>
                              )}
                            </div>
                            <p className='mt-1 text-sm text-gray-500'>
                              Expires {method.expMonth || '--'}/
                              {method.expYear || '--'}
                            </p>
                            <p className='mt-1 text-xs text-gray-400'>
                              Method ID: {method.id}
                            </p>
                          </div>
                        </div>

                        <div className='flex flex-wrap gap-3'>
                          <button
                            type='button'
                            onClick={() => handleSetDefault(method.id)}
                            disabled={
                              method.isDefault || actionId === method.id
                            }
                            className='inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                          >
                            {actionId === method.id ? (
                              <Loader className='h-4 w-4 animate-spin' />
                            ) : (
                              <RefreshCw className='h-4 w-4' />
                            )}
                            Set default
                          </button>
                          <button
                            type='button'
                            onClick={() => handleRemove(method.id)}
                            disabled={actionId === method.id}
                            className='inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
                          >
                            <Trash2 className='h-4 w-4' />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <div className='mb-5 flex items-center justify-between gap-4'>
                <div>
                  <h2 className='text-xl font-bold text-gray-900'>
                    Recent payment activity
                  </h2>
                  <p className='mt-1 text-sm text-gray-500'>
                    A quick look at recent paid orders and their status.
                  </p>
                </div>
                <Star className='h-5 w-5 text-orange-500' />
              </div>

              {paymentHistoryLoading ? (
                <div className='flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500'>
                  <Loader className='h-4 w-4 animate-spin text-orange-500' />
                  Loading payment history...
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className='rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500'>
                  No payment history yet. Once you complete a checkout, recent
                  payments will appear here.
                </div>
              ) : (
                <div className='space-y-3'>
                  {paymentHistory.map((payment: PaymentHistoryItem) => (
                    <div
                      key={payment.id}
                      className='flex flex-col gap-3 rounded-2xl border border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between'
                    >
                      <div>
                        <p className='font-semibold text-gray-900'>
                          Order #{payment.orderNumber}
                        </p>
                        <p className='mt-1 text-sm text-gray-500'>
                          {new Date(
                            payment.paidAt || payment.createdAt,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div className='flex flex-col items-start gap-2 sm:items-end'>
                        <p className='font-semibold text-gray-900'>
                          {currencyFormatter(payment.amount, payment.currency)}
                        </p>
                        <span className='rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-gray-600'>
                          {payment.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className='space-y-6'>
            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-bold text-gray-900'>
                Checkout shortcut
              </h2>
              <p className='mt-2 text-sm text-gray-500'>
                Payment methods are used automatically at checkout for faster
                repeat purchases.
              </p>
              <Link
                to='/checkout'
                className='mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600'
              >
                <ShoppingBag className='h-4 w-4' />
                Continue to checkout
              </Link>
            </div>

            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-bold text-gray-900'>
                Default payment status
              </h2>
              <div className='mt-4 rounded-2xl bg-gray-50 p-4'>
                {defaultPaymentMethod ? (
                  <>
                    <p className='font-semibold text-gray-900'>
                      {(defaultPaymentMethod.brand || defaultPaymentMethod.type)
                        .replace(/_/g, ' ')
                        .toUpperCase()}{' '}
                      ending in {defaultPaymentMethod.last4 || '----'}
                    </p>
                    <p className='mt-1 text-sm text-gray-500'>
                      This card is currently marked as your default payment
                      method.
                    </p>
                  </>
                ) : (
                  <p className='text-sm text-gray-500'>
                    You do not have a default payment method set yet.
                  </p>
                )}
              </div>
            </div>

            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-bold text-gray-900'>Need help?</h2>
              <p className='mt-2 text-sm text-gray-500'>
                Contact support if you need help updating billing details or
                resolving a payment issue.
              </p>
              <div className='mt-4 space-y-3'>
                <Link
                  to='/contact?subject=billing&message=I%20need%20help%20with%20my%20payment%20methods.'
                  className='inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                >
                  <MessageCircle className='h-4 w-4' />
                  Contact support
                </Link>
                <Link
                  to='/faq'
                  className='inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                >
                  <HelpCircle className='h-4 w-4' />
                  Read the FAQ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
