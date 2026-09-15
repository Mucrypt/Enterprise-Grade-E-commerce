// ============================================
// Download the App
// ============================================
// Real marketing/download page for the TechTools mobile app. The Google
// Play link/QR both encode the actual live, public listing (see app.json's
// android.playStoreUrl) -- not a placeholder. iOS has no App Store listing
// yet (no submission config exists in eas.json), so it's shown honestly as
// "Coming soon" rather than a dead or fabricated link, per explicit
// instruction: ship Android now, iOS once it's really live.
//
// Every feature called out below is something this app actually ships
// today (push alerts for back-in-stock/price-drop, server-synced
// wishlist, order tracking, refer & earn) -- no aspirational copy.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  Bell,
  Heart,
  Zap,
  PackageSearch,
  Gift,
  Star,
  Check,
  Copy,
  Apple,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '../utils'

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.mucrypt.techtools'

const PAGE_TITLE = 'Get the TechTools App | Faster Shopping, Real-Time Alerts'
const PAGE_DESCRIPTION =
  'Download the TechTools app on Google Play for faster checkout, order tracking, and instant back-in-stock & price-drop alerts on your wishlist.'

// Real screens from the app, not mockups.
const SCREENSHOTS = [
  {
    src: '/app-screenshot-home.webp',
    alt: 'TechTools app home screen showing categories and featured tools',
    caption: 'Everything you need, in one app',
  },
  {
    src: '/app-screenshot-search.webp',
    alt: 'TechTools app search results with sort and filter options',
    caption: 'Find the right tool, fast',
  },
  {
    src: '/app-screenshot-product.webp',
    alt: 'TechTools app product page with pricing and stock',
    caption: 'Clear pricing and details before you buy',
  },
  {
    src: '/app-screenshot-collection.webp',
    alt: 'TechTools app best sellers collection',
    caption: 'Discover customer favorites',
  },
  {
    src: '/app-screenshot-checkout.webp',
    alt: 'TechTools app checkout screen with delivery and returns info',
    caption: 'Secure checkout, easy returns',
  },
]

export default function DownloadAppPage() {
  const [copied, setCopied] = useState(false)
  const galleryRef = useRef<HTMLDivElement>(null)

  const scrollGallery = (direction: 'left' | 'right') => {
    const el = galleryRef.current
    if (!el) return
    const amount = el.clientWidth * 0.8 * (direction === 'left' ? -1 : 1)
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  useEffect(() => {
    const previousTitle = document.title
    const metaDescription = document.querySelector('meta[name="description"]')
    const previousDescription = metaDescription?.getAttribute('content') ?? null

    document.title = PAGE_TITLE
    metaDescription?.setAttribute('content', PAGE_DESCRIPTION)

    return () => {
      document.title = previousTitle
      if (previousDescription !== null) {
        metaDescription?.setAttribute('content', previousDescription)
      }
    }
  }, [])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(PLAY_STORE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be denied/unavailable -- the link is still
      // reachable via the button itself, so this is a soft failure.
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>

      {/* Hero */}
      <div className="mt-6 overflow-hidden rounded-3xl bg-linear-to-br from-gray-900 via-gray-900 to-orange-950 text-white shadow-sm">
        <div className="grid grid-cols-1 items-center gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-12 lg:p-14">
          {/* Copy + CTAs */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-orange-300">
              <Zap className="h-3.5 w-3.5" /> TechTools Mobile
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Shop TechTools faster.
              <br />
              Never miss a deal.
            </h1>
            <p className="mt-4 max-w-md text-gray-300">
              Get instant alerts the moment a wishlisted item is back in
              stock or drops in price, track orders in real time, and check
              out in a tap -- all from your phone.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl shadow-sm transition hover:opacity-90"
              >
                <img
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                  alt="Get it on Google Play"
                  className="h-14 w-auto"
                />
              </a>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-gray-400">
                <Apple className="h-7 w-7 shrink-0" />
                <div className="text-left leading-tight">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Coming soon to the</p>
                  <p className="text-lg font-semibold text-gray-300">App Store</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-sm text-gray-400">
              <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
              <span>Free to download &middot; Available now on Android</span>
            </div>
          </div>

          {/* QR + icon card */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center text-gray-900 shadow-lg">
              <img
                src="/app-icon.webp"
                alt="TechTools app icon"
                className="mx-auto h-16 w-16 rounded-2xl shadow-sm"
              />
              <p className="mt-3 font-semibold">Scan to download</p>
              <p className="text-xs text-gray-500">Point your phone camera at the code</p>
              <div className="mx-auto mt-4 inline-block rounded-xl border border-gray-100 p-3">
                <QRCodeSVG value={PLAY_STORE_URL} size={160} />
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mx-auto mt-4 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-orange-500"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Link copied' : 'Copy Play Store link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshots -- real screens from the app, not mockups */}
      <div className="mt-12">
        <h2 className="text-center text-2xl font-bold text-gray-900">
          See TechTools in action
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Real screens from the app -- no staged mockups.
        </p>
        <div className="relative mt-6">
          <div
            ref={galleryRef}
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:mx-0 sm:justify-center sm:px-0"
          >
            {SCREENSHOTS.map((shot) => (
              <figure
                key={shot.src}
                className="w-55 shrink-0 snap-center sm:w-60"
              >
                <img
                  src={shot.src}
                  alt={shot.alt}
                  loading="lazy"
                  className="w-full rounded-2xl shadow-lg"
                />
                <figcaption className="mt-3 text-center text-sm text-gray-600">
                  {shot.caption}
                </figcaption>
              </figure>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollGallery('left')}
            aria-label="Scroll screenshots left"
            className="absolute left-0 top-1/3 hidden -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-md transition hover:bg-gray-50 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollGallery('right')}
            aria-label="Scroll screenshots right"
            className="absolute right-0 top-1/3 hidden translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-md transition hover:bg-gray-50 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Features -- every one of these is a real, shipped feature */}
      <div className="mt-12">
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Everything you love about TechTools, built for your pocket
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Bell className="h-5 w-5" />}
            color="bg-orange-100 text-orange-600"
            title="Back-in-stock & price alerts"
            description="Wishlist an item and get a push notification the instant it's back in stock or the price drops."
          />
          <FeatureCard
            icon={<Heart className="h-5 w-5" />}
            color="bg-rose-100 text-rose-600"
            title="Wishlist, synced everywhere"
            description="Save items on your phone or the website -- your wishlist stays in sync across every device."
          />
          <FeatureCard
            icon={<Zap className="h-5 w-5" />}
            color="bg-amber-100 text-amber-600"
            title="Faster checkout"
            description="Saved addresses and payment methods mean a full checkout in seconds, not minutes."
          />
          <FeatureCard
            icon={<PackageSearch className="h-5 w-5" />}
            color="bg-sky-100 text-sky-600"
            title="Real-time order tracking"
            description="Follow every order from confirmation to delivery without leaving the app."
          />
          <FeatureCard
            icon={<Gift className="h-5 w-5" />}
            color="bg-emerald-100 text-emerald-600"
            title="Refer & earn on the go"
            description="Share your referral link and track clicks, orders, and store credit in real time."
          />
          <FeatureCard
            icon={<Star className="h-5 w-5" />}
            color="bg-purple-100 text-purple-600"
            title="Personalized for you"
            description="Recently viewed items, trending products, and recommendations tailored to your browsing."
          />
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center">
        <p className="text-lg font-semibold text-gray-900">
          Ready to shop smarter?
        </p>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white',
            'transition hover:bg-gray-800',
          )}
        >
          Download on Google Play
        </a>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  color,
  title,
  description,
}: {
  icon: React.ReactNode
  color: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className={cn('mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg', color)}>
        {icon}
      </div>
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}
