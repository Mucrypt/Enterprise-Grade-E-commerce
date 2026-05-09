import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  CreditCard,
  HelpCircle,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Shield,
  Settings,
  Smartphone,
  UserCircle2,
} from 'lucide-react'
import { useAuthStore } from '../stores'

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type='button'
      onClick={onToggle}
      className='flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-200 px-4 py-4 text-left transition hover:border-orange-200 hover:bg-orange-50/40'
    >
      <div>
        <p className='font-semibold text-gray-900'>{label}</p>
        <p className='mt-1 text-sm text-gray-500'>{description}</p>
      </div>
      <div
        className={`relative h-7 w-12 rounded-full transition ${
          enabled ? 'bg-orange-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition ${
            enabled ? 'left-5' : 'left-0.5'
          }`}
        />
      </div>
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const {
    user,
    isAuthenticated,
    hasHydrated,
    isLoading: authLoading,
    logout,
  } = useAuthStore()
  const [emailOffers, setEmailOffers] = useState(true)
  const [orderUpdates, setOrderUpdates] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(false)
  const [twoFactor, setTwoFactor] = useState(true)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      navigate('/login', { state: { from: { pathname: '/settings' } } })
    }
  }, [authLoading, hasHydrated, isAuthenticated, navigate])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (authLoading || !hasHydrated) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <Settings className='h-8 w-8 animate-spin text-orange-500' />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='mx-auto max-w-6xl px-4'>
        <div className='mb-6 rounded-2xl bg-white p-6 shadow-sm'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <div className='mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-600'>
                <Settings className='h-3.5 w-3.5' />
                Settings
              </div>
              <h1 className='text-3xl font-bold text-gray-900'>
                Account preferences
              </h1>
              <p className='mt-2 max-w-2xl text-sm text-gray-500'>
                Control profile shortcuts, communication preferences, and
                account security from one place.
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
              <button
                type='button'
                onClick={handleLogout}
                className='inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50'
              >
                <LogOut className='h-4 w-4' />
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <div className='space-y-6 lg:col-span-2'>
            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <h2 className='text-xl font-bold text-gray-900'>
                Communication preferences
              </h2>
              <p className='mt-1 text-sm text-gray-500'>
                Choose how TechTools can contact you about orders and offers.
              </p>

              <div className='mt-5 space-y-3'>
                <ToggleRow
                  label='Order and delivery updates'
                  description='Receive emails when your order status changes.'
                  enabled={orderUpdates}
                  onToggle={() => setOrderUpdates((value) => !value)}
                />
                <ToggleRow
                  label='Promotional emails'
                  description='Hear about sales, new arrivals, and special offers.'
                  enabled={emailOffers}
                  onToggle={() => setEmailOffers((value) => !value)}
                />
                <ToggleRow
                  label='SMS alerts'
                  description='Get text messages for urgent delivery updates.'
                  enabled={smsAlerts}
                  onToggle={() => setSmsAlerts((value) => !value)}
                />
              </div>
            </div>

            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <h2 className='text-xl font-bold text-gray-900'>
                Security and access
              </h2>
              <p className='mt-1 text-sm text-gray-500'>
                Review the core account areas you manage most often.
              </p>

              <div className='mt-5 grid grid-cols-1 gap-4 md:grid-cols-2'>
                <Link
                  to='/profile'
                  className='rounded-2xl border border-gray-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/40'
                >
                  <div className='flex items-center gap-3'>
                    <UserCircle2 className='h-5 w-5 text-orange-500' />
                    <div>
                      <p className='font-semibold text-gray-900'>
                        Profile info
                      </p>
                      <p className='text-sm text-gray-500'>
                        Update your name, email, and phone.
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to='/payment-methods'
                  className='rounded-2xl border border-gray-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/40'
                >
                  <div className='flex items-center gap-3'>
                    <CreditCard className='h-5 w-5 text-orange-500' />
                    <div>
                      <p className='font-semibold text-gray-900'>
                        Payment methods
                      </p>
                      <p className='text-sm text-gray-500'>
                        Manage saved cards and billing defaults.
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to='/profile#security'
                  className='rounded-2xl border border-gray-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/40'
                >
                  <div className='flex items-center gap-3'>
                    <Lock className='h-5 w-5 text-orange-500' />
                    <div>
                      <p className='font-semibold text-gray-900'>
                        Password & security
                      </p>
                      <p className='text-sm text-gray-500'>
                        Review authentication and login safety.
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to='/support'
                  className='rounded-2xl border border-gray-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/40'
                >
                  <div className='flex items-center gap-3'>
                    <Shield className='h-5 w-5 text-orange-500' />
                    <div>
                      <p className='font-semibold text-gray-900'>Support hub</p>
                      <p className='text-sm text-gray-500'>
                        Open Smart Support, FAQ, and contact options.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <h2 className='text-xl font-bold text-gray-900'>
                Device and privacy
              </h2>
              <div className='mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <div className='rounded-2xl bg-gray-50 p-4'>
                  <Smartphone className='h-5 w-5 text-orange-500' />
                  <p className='mt-3 font-semibold text-gray-900'>
                    Current device
                  </p>
                  <p className='mt-1 text-sm text-gray-500'>
                    You are signed in on the current browser session.
                  </p>
                </div>

                <div className='rounded-2xl bg-gray-50 p-4'>
                  <Mail className='h-5 w-5 text-orange-500' />
                  <p className='mt-3 font-semibold text-gray-900'>
                    Email delivery
                  </p>
                  <p className='mt-1 text-sm text-gray-500'>
                    Messages are sent to {user.email}.
                  </p>
                </div>

                <div className='rounded-2xl bg-gray-50 p-4'>
                  <MapPin className='h-5 w-5 text-orange-500' />
                  <p className='mt-3 font-semibold text-gray-900'>Addresses</p>
                  <p className='mt-1 text-sm text-gray-500'>
                    Manage shipping and billing addresses from your profile.
                  </p>
                </div>

                <div className='rounded-2xl bg-gray-50 p-4'>
                  <Bell className='h-5 w-5 text-orange-500' />
                  <p className='mt-3 font-semibold text-gray-900'>
                    Two-step access
                  </p>
                  <p className='mt-1 text-sm text-gray-500'>
                    {twoFactor
                      ? 'Two-factor protection is enabled.'
                      : 'Two-factor protection is disabled.'}
                  </p>
                </div>
              </div>

              <button
                type='button'
                onClick={() => setTwoFactor((value) => !value)}
                className='mt-5 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
              >
                <Shield className='h-4 w-4' />
                Toggle two-factor note
              </button>
            </div>
          </div>

          <div className='space-y-6'>
            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-bold text-gray-900'>
                Settings summary
              </h2>
              <div className='mt-4 space-y-3 text-sm text-gray-500'>
                <p>
                  <span className='font-semibold text-gray-900'>
                    Email offers:
                  </span>{' '}
                  {emailOffers ? 'On' : 'Off'}
                </p>
                <p>
                  <span className='font-semibold text-gray-900'>
                    Order updates:
                  </span>{' '}
                  {orderUpdates ? 'On' : 'Off'}
                </p>
                <p>
                  <span className='font-semibold text-gray-900'>
                    SMS alerts:
                  </span>{' '}
                  {smsAlerts ? 'On' : 'Off'}
                </p>
                <p>
                  <span className='font-semibold text-gray-900'>
                    Two-factor note:
                  </span>{' '}
                  {twoFactor ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>

            <div className='rounded-2xl bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-bold text-gray-900'>
                Helpful shortcuts
              </h2>
              <div className='mt-4 space-y-3'>
                <Link
                  to='/faq'
                  className='inline-flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                >
                  <span className='inline-flex items-center gap-2'>
                    <HelpCircle className='h-4 w-4' />
                    Open FAQ
                  </span>
                  <ArrowLeft className='h-4 w-4 rotate-180 text-gray-400' />
                </Link>
                <Link
                  to='/contact'
                  className='inline-flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                >
                  <span className='inline-flex items-center gap-2'>
                    <Mail className='h-4 w-4' />
                    Contact support
                  </span>
                  <ArrowLeft className='h-4 w-4 rotate-180 text-gray-400' />
                </Link>
                <Link
                  to='/payment-methods'
                  className='inline-flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                >
                  <span className='inline-flex items-center gap-2'>
                    <CreditCard className='h-4 w-4' />
                    Payment methods
                  </span>
                  <ArrowLeft className='h-4 w-4 rotate-180 text-gray-400' />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
