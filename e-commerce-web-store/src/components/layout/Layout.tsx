// ============================================
// Main Layout Component
// ============================================

import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Header from './Header'
import Footer from './Footer'
import { DriftChat } from './DriftChat'
import HomepageNewsletter from '../home/HomepageNewsletter'
import { useEffect } from 'react'
import { useAuthStore, useConsentStore } from '../../stores'
import { supportApi } from '../../api'
import { NotificationToast } from '../notifications/NotificationToast'
import { CompareTray } from '../product/CompareTray'
import PromoDrawer from '../promo/PromoDrawer'

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
      <PromoDrawer />
      <DriftChat
        enabled={hasHydrated && isAuthenticated && functionalConsent}
        supportProfile={supportProfile || null}
      />
    </div>
  )
}
