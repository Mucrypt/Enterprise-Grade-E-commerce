'use client'

import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className='flex h-screen overflow-hidden'>
      {/* Sidebar - Desktop */}
      <aside className='hidden md:block'>
        <Sidebar />
      </aside>

      {/* Sidebar - Mobile */}
      {sidebarOpen && (
        <>
          <div
            className='fixed inset-0 z-40 bg-black/50 md:hidden'
            onClick={() => setSidebarOpen(false)}
          />
          <aside className='fixed inset-y-0 left-0 z-50 md:hidden'>
            <Sidebar />
          </aside>
        </>
      )}

      {/* Main Content */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className='flex-1 overflow-y-auto bg-muted/10 p-6'>
          {children}
        </main>
      </div>
    </div>
  )
}
