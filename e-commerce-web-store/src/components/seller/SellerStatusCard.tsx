// Profile page's live seller-status card. Previously ProfilePage never
// called sellerApi.getMyProfile() at all -- an approved seller with real
// pending earnings had zero visibility of that on their own account
// page, just a generic "Seller Hub" promo identical to every other menu
// card. This shows the seller's real tier/identity and (once approved)
// their real "owed to you" balance, or the original generic CTA for
// anyone who isn't a seller yet.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Store, Wallet } from 'lucide-react'
import { sellerEarningsApi, type SellerEarningsSummary } from '../../api'
import type { SellerProfile } from '../../types'
import { useCreatorDashboardReady } from '../../hooks/useCreatorDashboardReady'
import { formatTier, getTierStyle } from '../../utils/sellerTier'
import { formatPrice } from '../../utils'

interface SellerStatusCardProps {
  sellerProfile: SellerProfile | null
  fallbackName: string
}

export default function SellerStatusCard({
  sellerProfile,
  fallbackName,
}: SellerStatusCardProps) {
  const { ready } = useCreatorDashboardReady()
  const [earnings, setEarnings] = useState<SellerEarningsSummary | null>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    sellerEarningsApi
      .getSummary()
      .then((data) => {
        if (!cancelled) setEarnings(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [ready])

  if (!sellerProfile) {
    return (
      <Link
        to='/seller-hub'
        className='block rounded-2xl bg-linear-to-br from-orange-500 to-red-600 p-5 text-white shadow-sm transition hover:opacity-95'
      >
        <Store className='h-6 w-6' />
        <h3 className='mt-3 font-bold'>Become a seller</h3>
        <p className='mt-1 text-sm text-orange-50/90'>
          Activate business mode and start listing products.
        </p>
      </Link>
    )
  }

  const tierStyle = getTierStyle(sellerProfile.tier)
  const displayName = sellerProfile.display_name || fallbackName

  return (
    <Link
      to={ready ? '/seller-center' : '/seller-hub'}
      className='block rounded-2xl bg-slate-950 p-5 text-white shadow-sm transition hover:bg-slate-900'
    >
      <div className='flex items-center gap-3'>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold ${tierStyle.gradient}`}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-bold'>{displayName}</p>
          <span
            className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tierStyle.badgeClass}`}
          >
            {formatTier(sellerProfile.tier)}
          </span>
        </div>
        <ArrowRight className='h-4 w-4 shrink-0 text-slate-500' />
      </div>

      {ready && earnings ? (
        <div className='mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10'>
          <Wallet className='h-4 w-4 text-emerald-400' />
          <p className='text-sm'>
            <span className='font-bold text-emerald-400'>
              {formatPrice(earnings.confirmedUnpaidBalance)}
            </span>{' '}
            <span className='text-slate-400'>owed to you</span>
          </p>
        </div>
      ) : (
        <p className='mt-4 text-sm text-slate-400'>
          {sellerProfile.verification_status === 'PENDING_REVIEW'
            ? 'Verification pending review.'
            : 'Open your seller dashboard.'}
        </p>
      )}
    </Link>
  )
}
