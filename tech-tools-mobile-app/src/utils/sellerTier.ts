// Mobile mirror of the web store's src/utils/sellerTier.ts -- same tier
// order, labels, and per-tier gradient so a "Trusted" seller looks the
// same on both platforms.

import type { SellerTier } from '@/types'

export const SELLER_TIER_ORDER: SellerTier[] = [
  'unverified',
  'basic',
  'trusted',
  'pro',
]

export const formatTier = (tier: string) =>
  tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, ' ')

export interface TierStyle {
  gradient: [string, string]
  badgeBg: string
  badgeText: string
}

const TIER_STYLES: Record<SellerTier, TierStyle> = {
  unverified: { gradient: ['#475569', '#334155'], badgeBg: '#E2E8F0', badgeText: '#334155' },
  basic: { gradient: ['#3B82F6', '#1D4ED8'], badgeBg: '#DBEAFE', badgeText: '#1D4ED8' },
  trusted: { gradient: ['#8B5CF6', '#C026D3'], badgeBg: '#EDE9FE', badgeText: '#7C3AED' },
  pro: { gradient: ['#FBBF24', '#EA580C'], badgeBg: '#FEF3C7', badgeText: '#B45309' },
}

export const getTierStyle = (tier: string): TierStyle =>
  TIER_STYLES[tier as SellerTier] || TIER_STYLES.unverified
