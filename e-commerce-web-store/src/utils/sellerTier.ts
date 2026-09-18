// Shared seller-tier presentation -- single source of truth for how a
// tier is labeled and colored, reused across SellerHubPage, the Creator
// Dashboard, and the Profile page's live seller card so a "Trusted"
// seller looks the same everywhere.

import type { SellerTier } from '../types'

export const SELLER_TIER_ORDER: SellerTier[] = [
  'unverified',
  'basic',
  'trusted',
  'pro',
]

export const formatTier = (tier: string) =>
  tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, ' ')

export interface TierStyle {
  badgeClass: string
  gradient: string
  ring: string
}

const TIER_STYLES: Record<SellerTier, TierStyle> = {
  unverified: {
    badgeClass: 'bg-slate-100 text-slate-600',
    gradient: 'from-slate-500 to-slate-700',
    ring: 'ring-slate-200',
  },
  basic: {
    badgeClass: 'bg-blue-100 text-blue-700',
    gradient: 'from-blue-500 to-blue-700',
    ring: 'ring-blue-200',
  },
  trusted: {
    badgeClass: 'bg-violet-100 text-violet-700',
    gradient: 'from-violet-500 to-fuchsia-600',
    ring: 'ring-violet-200',
  },
  pro: {
    badgeClass: 'bg-amber-100 text-amber-700',
    gradient: 'from-amber-400 to-orange-600',
    ring: 'ring-amber-200',
  },
}

export const getTierStyle = (tier: string): TierStyle =>
  TIER_STYLES[tier as SellerTier] || TIER_STYLES.unverified
