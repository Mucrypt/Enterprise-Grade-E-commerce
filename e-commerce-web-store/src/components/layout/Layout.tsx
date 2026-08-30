// ============================================
// Main Layout Component
// ============================================

import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Header from './Header'
import Footer from './Footer'
import { DriftChat } from './DriftChat'
import HomepageNewsletter from '../home/HomepageNewsletter'
import { useEffect, lazy, Suspense } from 'react'
import { useAuthStore, useConsentStore } from '../../stores'
import { supportApi } from '../../api'
import { NotificationToast } from '../notifications/NotificationToast'
import { CompareTray } from '../product/CompareTray'

// Lazy: pulls in GSAP, which is otherwise sizeable enough to blow the
// entry-bundle performance budget if imported eagerly here (Layout wraps
// every route, so anything imported directly at the top of this file
// ships in the critical, non-code-split entry chunk). The drawer is a
// progressive-enhancement promo surface, not above-the-fold content, so
// deferring it costs nothing visible.
const PromoDrawer = lazy(() => import('../promo/PromoDrawer'))

export default function Layout() {
  const { fetchUser, user, isAuthenticated, hasHydrated } = useAuthStore()
  const functionalConsent = useConsentStore((state) => state.functional)

  const { data: supportProfile } = useQuery({
    queryKey: ['support-profile', user?.id],
    queryFn: () => supportApi.getProfile(),
    enabled: hasHydrated && isAuthenticated,
    retry: false,
  })

  // Fetch user on app load
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return (
    <div className='min-h-screen flex flex-col bg-gray-50'>
      <Header />
      <main className='flex-1'>
        <Outlet />
      </main>
      <HomepageNewsletter />
      <Footer />
      <NotificationToast />
      <CompareTray />
      <Suspense fallback={null}>
        <PromoDrawer />
      </Suspense>
      <DriftChat
        enabled={hasHydrated && isAuthenticated && functionalConsent}
        supportProfile={supportProfile || null}
      />
    </div>
  )
}
