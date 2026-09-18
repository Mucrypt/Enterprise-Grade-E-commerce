// Single source of truth for "is this seller allowed into the creator
// dashboard." Previously SellerHubPage and CreatorDashboardPage each
// computed this with slightly different conditions (SellerHubPage only
// checked verification_status; CreatorDashboardPage also checked
// is_business_account and !is_suspended), which let one page's "open
// dashboard" link dead-end into the other's locked screen. Both pages
// (plus the Profile page's live seller card) now share this hook.

import { useMemo } from 'react'
import { useAuthStore } from '../stores'
import type { CreatorProfile, SellerProfile } from '../types'

export interface CreatorDashboardReadiness {
  ready: boolean
  isBusinessAccount: boolean
  verificationStatus: string
}

export function useCreatorDashboardReady(
  sellerProfile: SellerProfile | null,
  creatorProfile?: CreatorProfile | null,
): CreatorDashboardReadiness {
  const isBusinessAccount = useAuthStore((s) =>
    Boolean(s.user?.is_business_account),
  )

  return useMemo(() => {
    const verificationStatus =
      sellerProfile?.verification_status ||
      creatorProfile?.verification_status ||
      'none'

    return {
      ready:
        isBusinessAccount &&
        verificationStatus === 'approved' &&
        !sellerProfile?.is_suspended,
      isBusinessAccount,
      verificationStatus,
    }
  }, [
    isBusinessAccount,
    sellerProfile?.verification_status,
    sellerProfile?.is_suspended,
    creatorProfile?.verification_status,
  ])
}
