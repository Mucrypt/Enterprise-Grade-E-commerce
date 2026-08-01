// ============================================
// ScreenViewTracker
// Fires a page_view analytics event on every screen change -- mirrors
// e-commerce-web-store's PageViewTracker. trackScreenView existed on the
// tracking hook already but was never actually called anywhere.
// ============================================

import { useEffect } from 'react'
import { usePathname } from 'expo-router'
import { useEventTracking } from '@/hooks/useEventTracking'

export default function ScreenViewTracker() {
  const pathname = usePathname()
  const { trackScreenView } = useEventTracking()

  useEffect(() => {
    const [, section] = pathname.split('/')
    trackScreenView(pathname, { section: section || 'home' })
  }, [pathname])

  return null
}
