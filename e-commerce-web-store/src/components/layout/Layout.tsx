// ============================================
// Main Layout Component
// ============================================

import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Header from './Header'
import Footer from './Footer'
import { DriftChat } from './DriftChat'
import { SupportConcierge } from './SupportConcierge'
import { useEffect } from 'react'
import { useAuthStore } from '../../stores'
import { supportApi } from '../../api'
import { NotificationToast } from '../notifications/NotificationToast'

export default function Layout() {
  const { fetchUser, user, isAuthenticated, hasHydrated } = useAuthStore()

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
      <Footer />
      <NotificationToast />
      <SupportConcierge user={user} supportProfile={supportProfile || null} />
      <DriftChat supportProfile={supportProfile || null} />
    </div>
  )
}
