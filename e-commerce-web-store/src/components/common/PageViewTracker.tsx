// ============================================
// PageViewTracker Component
// Fires a page_view analytics event on every route change
// ============================================

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useEventTracking } from '../../hooks/useEventTracking'

export default function PageViewTracker() {
  const { pathname } = useLocation()
  const { trackPageView } = useEventTracking()

  useEffect(() => {
    const [, section] = pathname.split('/')
    trackPageView(pathname, section || 'home')
  }, [pathname])

  return null
}
