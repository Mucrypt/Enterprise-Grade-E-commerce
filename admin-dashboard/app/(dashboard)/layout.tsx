'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    const token = authService.getToken()
    if (!token) {
      router.push('/login')
    }
  }, [router])

  return (
    <div className='flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900'>
      <Sidebar />
      <div className='flex flex-col flex-1 overflow-hidden'>
        <Header />
        <main className='flex-1 overflow-y-auto p-6'>{children}</main>
      </div>
    </div>
  )
}
