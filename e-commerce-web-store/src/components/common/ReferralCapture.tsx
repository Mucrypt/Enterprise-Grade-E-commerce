// ============================================
// ReferralCapture -- ?ref=CODE attribution
// ============================================
// Mounted once, alongside PageViewTracker, but deliberately NOT routed
// through useEventTracking/trackPageView: that path is gated behind
// analytics cookie consent (hasAnalyticsConsent() in event-tracking.ts),
// and referral attribution is treated as "necessary" the same way the
// cart is (see utils/referral-cookie.ts's doc comment) -- it must never
// be silently dropped because a visitor hasn't made a consent choice yet.

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { affiliatesApi } from '../../api'
import { getOrCreateVisitorId, setReferralCode } from '../../utils/referral-cookie'

export default function ReferralCapture() {
  const { search, pathname } = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(search)
    const code = params.get('ref')
    if (!code) return // plain navigation never touches the cookie -- only an explicit ?ref= click does

    setReferralCode(code)
    const visitorId = getOrCreateVisitorId()
    void affiliatesApi.trackClick({ code, path: pathname, visitorId })
  }, [search, pathname])

  return null
}
