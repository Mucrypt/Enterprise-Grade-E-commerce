// ============================================
// ReferralCapture -- ?ref=CODE attribution (mobile)
// ============================================
// Mirrors e-commerce-web-store's src/components/common/ReferralCapture.tsx,
// adapted for Expo Router: instead of watching window.location.search, it
// watches useGlobalSearchParams(), which reactively carries the query
// params of whatever route a deep link resolved to, anywhere in the app.
//
// Real, honest scope: this only fires when the OS actually opens this app
// via a link -- either this app's own techtools:// custom scheme (already
// registered, works today for any techtools://...?ref=CODE link tapped
// while the app is installed) or, if Universal/App Links to
// techtoolstore.com are configured later, a plain https link. A share
// recipient without the app installed still lands on the web storefront
// instead, where the existing web ReferralCapture already handles it --
// that fallback is not this component's job.
//
// Never routed through the consent-gated analytics tracker (this app has
// no cookie-consent banner at all, so there's nothing to gate against
// anyway) -- referral attribution is treated as core/necessary, same as
// the web version.

import { useEffect } from 'react'
import { useGlobalSearchParams, usePathname } from 'expo-router'
import { affiliatesApi } from '@/api'
import { getOrCreateVisitorId, setReferralCode } from '@/utils/referral-storage'

export default function ReferralCapture() {
  const params = useGlobalSearchParams()
  const pathname = usePathname()
  const code = typeof params.ref === 'string' ? params.ref : undefined

  useEffect(() => {
    if (!code) return // plain navigation never touches storage -- only an explicit ref param does

    let cancelled = false
    ;(async () => {
      await setReferralCode(code)
      const visitorId = await getOrCreateVisitorId()
      if (cancelled) return
      void affiliatesApi.trackClick({ code, path: pathname, visitorId })
    })()

    return () => {
      cancelled = true
    }
  }, [code, pathname])

  return null
}
