// ============================================
// Refer & Earn
// ============================================
// The real, self-serve affiliate dashboard: an instant referral link (no
// application step -- every signed-in customer already has one, created
// on first visit here), live stats, one-tap sharing, and a QR code. Every
// number on this page comes from a real query -- no placeholder/fabricated
// stats, matching this codebase's badge/attribute/pricing discipline
// elsewhere. Store credit balance IS the payout: instant, no bank/PayPal
// integration, credited automatically by a backend worker once a referred
// order is safely past its return window.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import {
  Gift,
  Copy,
  Check,
  Share2,
  QrCode,
  Wallet,
  MousePointerClick,
  ShoppingBag,
  Clock,
  ArrowLeft,
} from 'lucide-react'
import { useAuthStore } from '../stores'
import { affiliatesApi } from '../api'
import { useAffiliateStats } from '../hooks/useAffiliateProfile'
import { formatPrice, cn } from '../utils'

const WHATSAPP_ICON_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z'

export default function ReferAndEarnPage() {
  const navigate = useNavigate()
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/refer' } } })
    }
  }, [hasHydrated, isAuthenticated, navigate])

  const { data: stats, isLoading } = useAffiliateStats()

  const { data: publicSettings } = useQuery({
    queryKey: ['affiliate-public-settings'],
    queryFn: () => affiliatesApi.getPublicSettings(),
    staleTime: 5 * 60_000,
  })

  const referralLink = stats?.referralCode
    ? `${window.location.origin}/?ref=${stats.referralCode}`
    : ''

  const handleCopy = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be denied/unavailable -- the link is still
      // selectable text in the input below, so this is a soft failure.
    }
  }

  const handleNativeShare = async () => {
    if (!referralLink) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TechTools',
          text: 'Check out TechTools -- here is my referral link:',
          url: referralLink,
        })
      } catch {
        // User cancelled the share sheet -- not an error.
      }
    } else {
      handleCopy()
    }
  }

  const shareText = encodeURIComponent('Check out TechTools -- great tools, fast shipping:')
  const encodedLink = encodeURIComponent(referralLink)

  if (!hasHydrated || !isAuthenticated) {
    return null
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/profile" className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Gift className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refer & Earn</h1>
          <p className="text-sm text-gray-500">
            {publicSettings?.commissionRatePercent
              ? `Earn ${publicSettings.commissionRatePercent}% store credit on every order made through your link.`
              : 'Share your link, earn store credit on every referred order.'}
          </p>
        </div>
      </div>

      {/* Referral link hero */}
      <div className="mt-6 rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-emerald-50/90">Your referral link</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 truncate rounded-xl bg-white/15 px-4 py-3 font-mono text-sm">
            {referralLink || 'Loading your link…'}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!referralLink}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={!referralLink}
            className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/25 disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          <a
            href={referralLink ? `https://wa.me/?text=${shareText}%20${encodedLink}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!referralLink}
            className={cn(
              'flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/25',
              !referralLink && 'pointer-events-none opacity-50',
            )}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d={WHATSAPP_ICON_PATH} />
            </svg>
            WhatsApp
          </a>
          <a
            href={referralLink ? `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedLink}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!referralLink}
            className={cn(
              'flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/25',
              !referralLink && 'pointer-events-none opacity-50',
            )}
          >
            𝕏
          </a>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            disabled={!referralLink}
            className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/25 disabled:opacity-50"
          >
            <QrCode className="h-4 w-4" /> {showQr ? 'Hide QR' : 'QR code'}
          </button>
        </div>

        {showQr && referralLink && (
          <div className="mt-4 inline-block rounded-xl bg-white p-4">
            <QRCodeSVG value={referralLink} size={140} />
          </div>
        )}
      </div>

      {/* Live stats -- every number here is real, never a placeholder */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<MousePointerClick className="h-5 w-5" />}
          label="Clicks"
          value={isLoading ? '—' : String(stats?.totalClicks ?? 0)}
        />
        <StatCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Referred orders"
          value={isLoading ? '—' : String((stats?.pendingCount ?? 0) + (stats?.confirmedCount ?? 0))}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending"
          value={isLoading ? '—' : formatPrice(stats?.pendingEarnings ?? 0)}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Store credit"
          value={isLoading ? '—' : formatPrice(stats?.storeCreditBalance ?? 0)}
          highlight
        />
      </div>

      {/* Recent referrals -- zero PII of the referred buyer, ever. */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-gray-900">Recent referrals</h2>
        {isLoading ? (
          <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-400">Loading…</div>
        ) : stats && stats.recentReferrals.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.recentReferrals.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatPrice(r.commissionAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No referrals yet -- share your link above to get started.
          </div>
        )}
      </div>

      {/* How it works -- honest, no fake numbers */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <HowItWorksStep
          step={1}
          title="Share your link"
          description="Send your unique link to friends, or post it anywhere you like."
        />
        <HowItWorksStep
          step={2}
          title="They shop"
          description="When someone buys through your link within 30 days, it's tracked automatically."
        />
        <HowItWorksStep
          step={3}
          title="You earn store credit"
          description="Once the order is safely past its return window, your commission lands as store credit -- ready to spend instantly."
        />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        highlight ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-white',
      )}
    >
      <div className={cn('mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg', highlight ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500')}>
        {icon}
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: 'pending' | 'confirmed' | 'cancelled' | 'paid' }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    paid: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  const label: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    paid: 'Paid',
    cancelled: 'Cancelled',
  }
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', map[status] || map.pending)}>
      {label[status] || status}
    </span>
  )
}

function HowItWorksStep({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
        {step}
      </span>
      <p className="mt-3 font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}
