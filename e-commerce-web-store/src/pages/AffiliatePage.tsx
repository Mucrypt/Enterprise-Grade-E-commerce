// ============================================
// Affiliate Program - Marketing/Explainer Page
// ============================================
// Rewritten to describe the real program instead of a fake tiered-
// commission structure and a signup form with no backend behind it (the
// previous version promised "up to 10%" across 5 fake tiers and a
// non-functional setTimeout-based application form -- no API call, no
// persistence). Enrollment is now instant and automatic for any signed-in
// customer via /refer -- there's no application to review, so there's
// nothing here to submit. The commission rate shown is the real,
// admin-configured flat rate, fetched live -- never hardcoded.

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Gift, Clock, Wallet, Share2, TrendingUp } from 'lucide-react'
import { useAuthStore } from '../stores'
import { affiliatesApi } from '../api'

const benefits = [
  {
    icon: TrendingUp,
    title: 'Instant enrollment',
    description: 'No application, no approval wait -- every signed-in customer already has a referral link.',
  },
  {
    icon: Clock,
    title: '30-day cookie window',
    description: 'Get credited for a sale made up to 30 days after someone clicks your link.',
  },
  {
    icon: Wallet,
    title: 'Instant store credit',
    description: 'Commission lands as store credit automatically -- no minimum, no waiting for a monthly payout run.',
  },
  {
    icon: Share2,
    title: 'Share anywhere',
    description: 'One link, a QR code, and one-tap sharing to WhatsApp, X, or anywhere else you already post.',
  },
]

export default function AffiliatePage() {
  const { isAuthenticated } = useAuthStore()

  const { data: settings } = useQuery({
    queryKey: ['affiliate-public-settings'],
    queryFn: () => affiliatesApi.getPublicSettings(),
    staleTime: 5 * 60_000,
  })

  const ctaHref = isAuthenticated ? '/refer' : '/login?redirect=/refer'

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white'>
        <div className='container mx-auto px-4 py-20'>
          <div className='mx-auto max-w-3xl text-center'>
            <div className='mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20'>
              <Gift className='h-8 w-8 text-white' />
            </div>
            <h1 className='mb-4 text-4xl font-bold md:text-5xl'>Refer & Earn</h1>
            <p className='mx-auto mb-8 max-w-2xl text-lg text-white/90'>
              {settings?.commissionRatePercent
                ? `Share your link. Earn ${settings.commissionRatePercent}% store credit on every order made through it.`
                : 'Share your link. Earn store credit on every order made through it.'}
            </p>
            <Link
              to={ctaHref}
              className='inline-block rounded-lg bg-white px-8 py-4 font-semibold text-emerald-600 transition-colors hover:bg-emerald-50'
            >
              {isAuthenticated ? 'Get my referral link' : 'Sign in to get started'}
            </Link>
          </div>
        </div>
      </div>

      <div className='container mx-auto px-4 py-16'>
        <div className='mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2'>
          {benefits.map((benefit) => (
            <div key={benefit.title} className='rounded-2xl bg-white p-6 shadow-sm'>
              <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100'>
                <benefit.icon className='h-6 w-6 text-emerald-600' />
              </div>
              <h3 className='mb-2 text-lg font-semibold text-gray-900'>{benefit.title}</h3>
              <p className='text-sm text-gray-600'>{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className='container mx-auto px-4 pb-20'>
        <div className='mx-auto max-w-3xl text-center'>
          <h2 className='mb-4 text-2xl font-bold text-gray-900'>How it works</h2>
          <p className='text-gray-600'>
            Sign in, visit{' '}
            <Link to='/refer' className='text-emerald-600 hover:underline'>
              Refer &amp; Earn
            </Link>{' '}
            from your profile, and copy your link. When someone buys through it within 30 days, the
            commission is tracked automatically and lands as store credit once the order is safely past its
            return window -- ready to spend on your next order.
          </p>
        </div>
      </div>
    </div>
  )
}
