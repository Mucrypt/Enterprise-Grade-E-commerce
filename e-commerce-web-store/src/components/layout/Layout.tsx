// ============================================
// Main Layout Component
// ============================================

import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import { useEffect } from 'react'
import { useAuthStore } from '../../stores'
import { NotificationToast } from '../notifications/NotificationToast'

export default function Layout() {
  const { fetchUser } = useAuthStore()

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
    </div>
  )
}
