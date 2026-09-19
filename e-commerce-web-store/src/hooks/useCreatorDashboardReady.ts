// Single source of truth for "is this seller allowed into the creator
// dashboard." Previously SellerHubPage and CreatorDashboardPage each
// computed this with slightly different conditions (SellerHubPage only
// checked verification_status; CreatorDashboardPage also checked
// is_business_account and !is_suspended), which let one page's "open
// dashboard" link dead-end into the other's locked screen. Both pages
// (plus the Profile page's live seller card) now share this hook.
//
// `ready` deliberately does NOT gate on the store's `is_business_account`
// flag. That flag is cached in the browser at login and only ever
// updated by an explicit client-side action (e.g. the self-service
// "Activate business mode" button) -- it has no way to learn about an
// admin approving a seller server-side (grantSellerAccess/setSellerTier/
// setSellerCreatorAccess all flip users.is_business_account=true as part
// of approval). `verification_status` is fetched fresh on every load, so
// 'approved' is already an authoritative signal on its own -- every
// backend path that sets it also guarantees is_business_account=true at
// the same time. Gating on the stale client flag on top of that only
// risked a real seller staying locked out of their own dashboard until
// they happened to log out and back in, which is exactly what happened.
// A self-healing effect still syncs the store below, so the rest of the
// app (e.g. SellerHubPage's "Business mode: Active/Customer" tile and
// its activation-flow step 1) stops showing stale info too.

import { useEffect, useMemo } from 'react'
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
  const updateUser = useAuthStore((s) => s.updateUser)

  const verificationStatus =
    sellerProfile?.verification_status ||
    creatorProfile?.verification_status ||
    'none'

  useEffect(() => {
    if (verificationStatus === 'approved' && !isBusinessAccount) {
      updateUser({ is_business_account: true })
    }
  }, [verificationStatus, isBusinessAccount, updateUser])

  return useMemo(() => {
    const effectiveIsBusinessAccount = isBusinessAccount || verificationStatus === 'approved'

    return {
      ready: verificationStatus === 'approved' && !sellerProfile?.is_suspended,
      isBusinessAccount: effectiveIsBusinessAccount,
      verificationStatus,
    }
  }, [isBusinessAccount, verificationStatus, sellerProfile?.is_suspended])
}
