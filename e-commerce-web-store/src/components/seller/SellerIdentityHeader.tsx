// Reuses the exact visual identity already proven on the public
// /seller/:handle storefront (SellerProfilePage.tsx) -- banner, avatar,
// handle, real follower/post count -- but for the seller's OWN dashboard
// surfaces (Seller Hub, Creator Dashboard). Sellers previously never saw
// their own brand identity anywhere except through their followers' eyes.
// Fetches the public profile itself (only once a handle exists) so every
// caller gets real numbers without re-implementing the fetch.

import { useEffect, useState } from 'react'
import { BadgeCheck, Clock3, ShieldAlert } from 'lucide-react'
import { sellerApi, type PublicSellerProfile } from '../../api'
import type { SellerProfile } from '../../types'
import { formatTier, getTierStyle } from '../../utils/sellerTier'

interface SellerIdentityHeaderProps {
  sellerProfile: SellerProfile | null
  fallbackName: string
}

// Keys match the `seller_profile_verification_status` Postgres enum
// exactly (uppercase) -- see types/index.ts's SellerVerificationStatus.
const VERIFICATION_BADGE: Record<
  string,
  { label: string; className: string; icon: typeof BadgeCheck }
> = {
  APPROVED: {
    label: 'Verified seller',
    className: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/30',
    icon: BadgeCheck,
  },
  PENDING_REVIEW: {
    label: 'Verification pending',
    className: 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/30',
    icon: Clock3,
  },
  MORE_INFORMATION_REQUIRED: {
    label: 'More info needed',
    className: 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/30',
    icon: Clock3,
  },
  REJECTED: {
    label: 'Verification rejected',
    className: 'bg-red-500/15 text-red-100 ring-1 ring-red-400/30',
    icon: ShieldAlert,
  },
}

export default function SellerIdentityHeader({
  sellerProfile,
  fallbackName,
}: SellerIdentityHeaderProps) {
  const [publicProfile, setPublicProfile] = useState<PublicSellerProfile | null>(null)

  useEffect(() => {
    const handle = sellerProfile?.handle
    if (!handle) return

    let cancelled = false
    sellerApi
      .getPublicProfile(handle)
      .then((data) => {
        if (!cancelled) setPublicProfile(data)
      })
      .catch(() => {
        if (!cancelled) setPublicProfile(null)
      })
    return () => {
      cancelled = true
    }
  }, [sellerProfile?.handle])

  const displayName = sellerProfile?.display_name || fallbackName
  const tier = sellerProfile?.tier || 'unverified'
  const tierStyle = getTierStyle(tier)
  const verification =
    VERIFICATION_BADGE[sellerProfile?.verification_status || ''] || null

  return (
    <div className='overflow-hidden rounded-[28px] bg-slate-950 shadow-xl'>
      <div
        className='h-24 w-full bg-linear-to-br sm:h-32'
        style={
          publicProfile?.banner_url
            ? {
                backgroundImage: `url(${publicProfile.banner_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className={`h-full w-full bg-linear-to-br ${tierStyle.gradient} opacity-90`} />
      </div>

      <div className='-mt-10 flex flex-col gap-4 px-6 pb-6 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between'>
        <div className='flex items-end gap-4'>
          <div
            className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-slate-950 bg-linear-to-br shadow-lg sm:h-24 sm:w-24 ${tierStyle.gradient}`}
          >
            {publicProfile?.avatar_url ? (
              <img
                src={publicProfile.avatar_url}
                alt={displayName}
                className='h-full w-full object-cover'
              />
            ) : (
              <span className='text-2xl font-bold text-white sm:text-3xl'>
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className='pb-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-xl font-black text-white sm:text-2xl'>
                {displayName}
              </h1>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tierStyle.badgeClass}`}
              >
                {formatTier(tier)}
              </span>
            </div>
            {sellerProfile?.handle ? (
              <p className='mt-0.5 text-sm text-slate-400'>@{sellerProfile.handle}</p>
            ) : (
              <p className='mt-0.5 text-sm text-slate-400'>Finish setup to claim a handle</p>
            )}
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-3 pb-1'>
          {publicProfile ? (
            <div className='flex items-center gap-4 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10'>
              <div className='text-center'>
                <p className='text-sm font-bold text-white'>{publicProfile.followerCount}</p>
                <p className='text-[10px] uppercase tracking-wide text-slate-400'>Followers</p>
              </div>
              <div className='h-6 w-px bg-white/10' />
              <div className='text-center'>
                <p className='text-sm font-bold text-white'>{publicProfile.postCount}</p>
                <p className='text-[10px] uppercase tracking-wide text-slate-400'>Posts</p>
              </div>
            </div>
          ) : null}

          {verification ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${verification.className}`}
            >
              <verification.icon className='h-3.5 w-3.5' /> {verification.label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
