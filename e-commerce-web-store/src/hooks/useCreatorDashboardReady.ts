// Single source of truth for "is this seller allowed into the Seller
// Center." Previously this derived `ready` itself from raw
// verification_status/is_suspended fields passed in by each caller --
// duplicated eligibility logic the founder's own spec explicitly warned
// against, and it broke outright once the backend split
// verification_status onto its own dedicated enum with uppercase values
// ('APPROVED' instead of 'approved'): every seller, including
// already-approved ones, was locked out until this was fixed.
//
// This hook now calls the server-authoritative GET /seller/capabilities
// endpoint (sellerApi.getMyCapabilities) instead of re-deriving
// eligibility from raw enum strings. It also reflects the current
// product policy: a seller can use the whole Seller Center (build
// products, manage content, see their own finances) as soon as they've
// started onboarding -- verification is only required to actually go
// public (`canOpenStorefront`). `ready` tracks `canAccessSellerCenter`,
// which the backend only refuses for a genuinely closed door
// (no profile yet, or SUSPENDED/CLOSED) -- see
// seller-lifecycle-query.service.ts's resolveSellerCapabilities for the
// exact rule.
//
// Deliberately does not take sellerProfile/creatorProfile as
// parameters anymore -- capabilities are resolved entirely server-side
// from the authenticated session, so callers that already fetch a
// seller/creator profile for their own display purposes (the Seller
// Center topbar, Seller Hub's tier cards) do so independently; this
// hook's own fetch is a separate, lightweight concern.

import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores'
import { sellerApi, type SellerCapabilities } from '../api'

export interface CreatorDashboardReadiness {
  ready: boolean
  loading: boolean
  isBusinessAccount: boolean
  verificationStatus: string
  capabilities: SellerCapabilities | null
}

export function useCreatorDashboardReady(): CreatorDashboardReadiness {
  const { isAuthenticated, hasHydrated, user, updateUser } = useAuthStore()
  const [capabilities, setCapabilities] = useState<SellerCapabilities | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated) {
      setCapabilities(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    sellerApi
      .getMyCapabilities()
      .then((result) => {
        if (!cancelled) setCapabilities(result)
      })
      .catch(() => {
        if (!cancelled) setCapabilities(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [hasHydrated, isAuthenticated])

  // Same self-healing purpose as before: the client-cached
  // is_business_account flag has no way to learn about a server-side
  // change on an already-open session, so sync it once the
  // authoritative capabilities response says otherwise.
  useEffect(() => {
    if (capabilities?.accountMode === 'BUSINESS' && !user?.is_business_account) {
      updateUser({ is_business_account: true })
    }
  }, [capabilities?.accountMode, user?.is_business_account, updateUser])

  return {
    ready: capabilities?.canAccessSellerCenter ?? false,
    loading,
    isBusinessAccount: Boolean(user?.is_business_account) || capabilities?.accountMode === 'BUSINESS',
    verificationStatus: capabilities?.verificationStatus || 'NOT_STARTED',
    capabilities,
  }
}
