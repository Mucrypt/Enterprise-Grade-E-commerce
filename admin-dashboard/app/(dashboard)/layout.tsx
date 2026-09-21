'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const token = authService.getToken()
    if (!token) {
      router.push('/login')
    }
  }, [router])

  // Below md, the sidebar was previously rendered unconditionally at a
  // fixed 256px width alongside the content -- on a ~375px phone that
  // left ~100px for `main`, minus its own p-6 padding, on every single
  // page. Header already renders a wired-up-looking hamburger button
  // (`md:hidden`, taking an onMenuClick prop) but this layout never
  // passed one, so tapping it was a silent no-op. This closes that gap:
  // sidebar hides below md, reappears as an overlay drawer when opened.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className='flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900'>
      <aside className='hidden md:block'>
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <>
          <div
            className='fixed inset-0 z-40 bg-black/50 md:hidden'
            onClick={() => setSidebarOpen(false)}
            aria-hidden='true'
          />
          <aside className='fixed inset-y-0 left-0 z-50 md:hidden'>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      <div className='flex flex-col flex-1 overflow-hidden'>
        <Header onMenuClick={() => setSidebarOpen((open) => !open)} />
        <main className='flex-1 overflow-y-auto p-4 sm:p-6'>{children}</main>
      </div>
    </div>
  )
}
