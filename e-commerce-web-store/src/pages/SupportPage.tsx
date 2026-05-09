import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock3,
  Headphones,
  HelpCircle,
  MessageCircle,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'

const supportCards = [
  {
    title: 'Smart Support',
    description:
      'Open personalized live help for orders, products, and account issues.',
    icon: Sparkles,
    href: '/contact?subject=technical&message=I%20want%20live%20support.',
  },
  {
    title: 'Help Center',
    description: 'Browse FAQs, shipping details, and common account help.',
    icon: HelpCircle,
    href: '/faq',
  },
  {
    title: 'Contact Us',
    description: 'Send a message to our support team for general assistance.',
    icon: MessageCircle,
    href: '/contact',
  },
  {
    title: 'Track Order',
    description: 'Check delivery status and manage order follow-up.',
    icon: PackageSearch,
    href: '/track-order',
  },
  {
    title: 'Returns',
    description: 'Start or review returns and refunds in one place.',
    icon: RefreshCw,
    href: '/returns',
  },
  {
    title: 'Rate the App',
    description: 'Share feedback and tell us what to improve next.',
    icon: Star,
    href: '/contact?subject=feedback&message=I%20want%20to%20rate%20the%20app.',
  },
]

const supportHighlights = [
  { label: '24/7 support', icon: Clock3 },
  { label: 'Secure account help', icon: ShieldCheck },
  { label: 'Fast order resolution', icon: Headphones },
]

export default function SupportPage() {
  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='mx-auto max-w-6xl px-4'>
        <div className='mb-6 rounded-3xl bg-linear-to-r from-orange-500 via-orange-600 to-amber-500 p-8 text-white shadow-sm'>
          <div className='max-w-3xl'>
            <div className='mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide'>
              <Sparkles className='h-3.5 w-3.5' />
              Support Hub
            </div>
            <h1 className='text-4xl font-bold tracking-tight'>
              Help that stays close to your account
            </h1>
            <p className='mt-3 max-w-2xl text-sm text-white/90'>
              Access Smart Support, FAQs, contact options, order tracking, and
              returns from a single dedicated page.
            </p>

            <div className='mt-6 flex flex-wrap gap-3'>
              <Link
                to='/contact?subject=technical&message=I%20want%20live%20support.'
                className='inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-orange-600 transition hover:bg-orange-50'
              >
                Open Smart Support <ArrowRight className='h-4 w-4' />
              </Link>
              <Link
                to='/faq'
                className='inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10'
              >
                Browse FAQ <ArrowRight className='h-4 w-4' />
              </Link>
            </div>
          </div>
        </div>

        <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
          {supportHighlights.map((item) => (
            <div
              key={item.label}
              className='rounded-2xl bg-white p-5 shadow-sm'
            >
              <item.icon className='h-6 w-6 text-orange-500' />
              <p className='mt-3 font-semibold text-gray-900'>{item.label}</p>
            </div>
          ))}
        </div>

        <div className='grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'>
          {supportCards.map((card) => (
            <Link
              key={card.title}
              to={card.href}
              className='group rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md'
            >
              <div className='flex items-start justify-between gap-4'>
                <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500'>
                  <card.icon className='h-6 w-6' />
                </div>
                <ArrowRight className='h-5 w-5 text-gray-300 transition group-hover:text-orange-500' />
              </div>
              <h2 className='mt-5 text-lg font-bold text-gray-900'>
                {card.title}
              </h2>
              <p className='mt-2 text-sm text-gray-500'>{card.description}</p>
            </Link>
          ))}
        </div>

        <div className='mt-8 rounded-3xl bg-white p-6 shadow-sm'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='text-xl font-bold text-gray-900'>
                Need something account-specific?
              </h2>
              <p className='mt-2 text-sm text-gray-500'>
                Use your profile pages for payment methods, settings, and
                account details.
              </p>
            </div>

            <div className='flex flex-wrap gap-3'>
              <Link
                to='/payment-methods'
                className='inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
              >
                Payment Methods
              </Link>
              <Link
                to='/settings'
                className='inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600'
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
