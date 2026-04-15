import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bot,
  CalendarDays,
  Gift,
  MessageCircleMore,
  PackageSearch,
  Sparkles,
  Star,
  Video,
  X,
} from 'lucide-react'
import type { SupportProfile, User } from '../../types'

interface SupportConciergeProps {
  user: User | null
  supportProfile: SupportProfile | null
}

const routeCopy: Record<
  string,
  { title: string; body: string; cta: string; href: string }
> = {
  '/checkout': {
    title: 'Checkout confidence',
    body: 'Need payment, shipping, or coupon help before you place the order?',
    cta: 'Get checkout help',
    href: '/contact?subject=billing&message=I%20need%20help%20with%20checkout.',
  },
  '/orders': {
    title: 'Order concierge',
    body: 'Track, expedite, or troubleshoot an order directly from support.',
    cta: 'Track my order',
    href: '/track-order',
  },
  '/product/': {
    title: 'Expert product guidance',
    body: 'Ask for fitment, compatibility, or a live product walkthrough.',
    cta: 'Request expert help',
    href: '/contact?subject=product&message=I%20need%20expert%20product%20guidance.',
  },
}

export function SupportConcierge({
  user,
  supportProfile,
}: SupportConciergeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  const routeInsight = useMemo(() => {
    const matchedKey = Object.keys(routeCopy).find((key) =>
      location.pathname.startsWith(key),
    )

    return matchedKey ? routeCopy[matchedKey] : null
  }, [location.pathname])

  const openChat = () => {
    if (window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
      window.Tawk_API.maximize()
      return
    }

    window.location.href =
      '/contact?subject=technical&message=I%20want%20live%20support.'
  }

  const greeting = supportProfile
    ? `Welcome back, ${supportProfile.customer.firstName}.`
    : user
    ? `Welcome back, ${user.first_name}.`
    : 'Need smarter support?'

  return (
    <div className='fixed bottom-6 left-6 z-40 max-w-sm'>
      {isOpen ? (
        <div className='w-[22rem] overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-2xl'>
          <div className='bg-linear-to-br from-orange-500 via-orange-600 to-amber-500 px-5 py-4 text-white'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <div className='mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide'>
                  <Sparkles className='h-3.5 w-3.5' />
                  Smart Support
                </div>
                <h3 className='text-lg font-bold'>{greeting}</h3>
                <p className='mt-1 text-sm text-white/90'>
                  Premium support with order context, verified proof, and faster
                  escalation paths.
                </p>
              </div>
              <button
                type='button'
                onClick={() => setIsOpen(false)}
                className='rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20'
                aria-label='Close support concierge'
              >
                <X className='h-4 w-4' />
              </button>
            </div>
          </div>

          <div className='max-h-[70vh] space-y-5 overflow-y-auto p-5'>
            {routeInsight && (
              <div className='rounded-2xl border border-orange-100 bg-orange-50 p-4'>
                <p className='text-sm font-semibold text-slate-900'>
                  {routeInsight.title}
                </p>
                <p className='mt-1 text-sm text-slate-600'>
                  {routeInsight.body}
                </p>
                <a
                  href={routeInsight.href}
                  className='mt-3 inline-flex items-center gap-2 text-sm font-semibold text-orange-700'
                >
                  {routeInsight.cta}
                </a>
              </div>
            )}

            {supportProfile && (
              <div className='grid grid-cols-2 gap-3'>
                <div className='rounded-2xl bg-slate-950 p-4 text-white'>
                  <p className='text-xs uppercase tracking-wide text-slate-400'>
                    Loyalty Tier
                  </p>
                  <p className='mt-2 text-xl font-bold'>
                    {supportProfile.loyalty.tier}
                  </p>
                  <p className='mt-1 text-xs text-slate-300'>
                    {supportProfile.loyalty.points} points
                  </p>
                </div>
                <div className='rounded-2xl border border-slate-200 p-4'>
                  <p className='text-xs uppercase tracking-wide text-slate-500'>
                    Active Orders
                  </p>
                  <p className='mt-2 text-xl font-bold text-slate-900'>
                    {supportProfile.orderSummary.activeOrders}
                  </p>
                  <p className='mt-1 text-xs text-slate-500'>
                    {supportProfile.orderSummary.totalOrders} total purchases
                  </p>
                </div>
              </div>
            )}

            <div>
              <div className='mb-3 flex items-center gap-2'>
                <Bot className='h-4 w-4 text-orange-600' />
                <p className='text-sm font-semibold text-slate-900'>
                  AI-style suggestions
                </p>
              </div>
              <div className='space-y-2'>
                {(
                  supportProfile?.smartSuggestions || [
                    'Use live chat for real-time support and faster troubleshooting.',
                    'Book a video consult for high-value or hard-to-install products.',
                    'Use the contact form to request guided co-browsing help.',
                  ]
                ).map((suggestion) => (
                  <div
                    key={suggestion}
                    className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700'
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className='mb-3 flex items-center gap-2'>
                <MessageCircleMore className='h-4 w-4 text-orange-600' />
                <p className='text-sm font-semibold text-slate-900'>
                  Premium support actions
                </p>
              </div>
              <div className='grid gap-2'>
                {(supportProfile?.quickActions || []).map((action) => (
                  <a
                    key={action.type}
                    href={action.href}
                    className='rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-orange-300 hover:bg-orange-50'
                  >
                    <p className='text-sm font-semibold text-slate-900'>
                      {action.label}
                    </p>
                    <p className='mt-1 text-xs text-slate-600'>
                      {action.description}
                    </p>
                  </a>
                ))}
                <button
                  type='button'
                  onClick={openChat}
                  className='rounded-2xl bg-slate-950 px-4 py-3 text-left text-white transition hover:bg-slate-800'
                >
                  <p className='text-sm font-semibold'>
                    Open live concierge chat
                  </p>
                  <p className='mt-1 text-xs text-slate-300'>
                    Personalized support with your order and loyalty context
                    attached.
                  </p>
                </button>
              </div>
            </div>

            {supportProfile?.verifiedReviews?.length ? (
              <div>
                <div className='mb-3 flex items-center gap-2'>
                  <Star className='h-4 w-4 text-orange-600' />
                  <p className='text-sm font-semibold text-slate-900'>
                    Verified proof in chat
                  </p>
                </div>
                <div className='space-y-2'>
                  {supportProfile.verifiedReviews.slice(0, 2).map((review) => (
                    <Link
                      key={review.id}
                      to={`/product/${review.productSlug}`}
                      className='block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-orange-300'
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <p className='text-sm font-semibold text-slate-900'>
                          {review.productName}
                        </p>
                        <span className='rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700'>
                          Verified
                        </span>
                      </div>
                      <p className='mt-1 text-xs text-slate-600'>
                        {review.rating}/5 stars
                        {review.title ? ` • ${review.title}` : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {supportProfile?.recommendations?.length ? (
              <div>
                <div className='mb-3 flex items-center gap-2'>
                  <Gift className='h-4 w-4 text-orange-600' />
                  <p className='text-sm font-semibold text-slate-900'>
                    Concierge picks
                  </p>
                </div>
                <div className='space-y-2'>
                  {supportProfile.recommendations.slice(0, 2).map((item) => (
                    <Link
                      key={item.id}
                      to={`/product/${item.slug}`}
                      className='flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-orange-300'
                    >
                      <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700'>
                        {item.primaryImage ? (
                          <img
                            src={item.primaryImage}
                            alt={item.name}
                            className='h-12 w-12 rounded-2xl object-cover'
                          />
                        ) : (
                          <PackageSearch className='h-5 w-5' />
                        )}
                      </div>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-slate-900'>
                          {item.name}
                        </p>
                        <p className='mt-1 text-xs text-slate-600'>
                          {item.reason}
                        </p>
                        <p className='mt-1 text-xs font-semibold text-orange-700'>
                          ${item.price.toFixed(2)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className='grid grid-cols-3 gap-2'>
              <a
                href='/contact?subject=technical&message=I%20need%20video%20support.'
                className='rounded-2xl border border-slate-200 px-3 py-3 text-center text-xs font-semibold text-slate-700'
              >
                <Video className='mx-auto mb-2 h-4 w-4 text-orange-600' />
                Video
              </a>
              <a
                href='/contact?subject=product&message=I%20want%20to%20book%20an%20appointment.'
                className='rounded-2xl border border-slate-200 px-3 py-3 text-center text-xs font-semibold text-slate-700'
              >
                <CalendarDays className='mx-auto mb-2 h-4 w-4 text-orange-600' />
                Appointment
              </a>
              <a
                href='/contact?subject=technical&message=I%20need%20co-browsing%20support.'
                className='rounded-2xl border border-slate-200 px-3 py-3 text-center text-xs font-semibold text-slate-700'
              >
                <PackageSearch className='mx-auto mb-2 h-4 w-4 text-orange-600' />
                Co-browse
              </a>
            </div>
          </div>
        </div>
      ) : (
        <button
          type='button'
          onClick={() => setIsOpen(true)}
          className='inline-flex items-center gap-3 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-slate-800'
        >
          <Sparkles className='h-4 w-4 text-orange-400' />
          Open Smart Support
        </button>
      )}
    </div>
  )
}

declare global {
  interface Window {
    Tawk_API?: {
      maximize?: () => void
      [key: string]: unknown
    }
  }
}
