'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Bell, Search, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname()

  // Get page title from pathname
  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 1) return 'Dashboard'
    return segments[segments.length - 1]
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <header className='sticky top-0 z-10 flex h-16 items-center border-b bg-background px-6'>
      {/* Mobile Menu Button */}
      <Button
        variant='ghost'
        size='icon'
        className='mr-4 md:hidden'
        onClick={onMenuClick}
      >
        <Menu className='h-5 w-5' />
      </Button>

      {/* Page Title */}
      <h1 className='text-2xl font-bold'>{getPageTitle()}</h1>

      {/* Search Bar */}
      <div className='mx-auto hidden w-full max-w-md md:block'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            type='search'
            placeholder='Search products, orders, customers...'
            className='pl-10'
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className='ml-auto flex items-center space-x-2'>
        {/* Notifications */}
        <Button variant='ghost' size='icon' className='relative'>
          <Bell className='h-5 w-5' />
          <span className='absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive' />
        </Button>
      </div>
    </header>
  )
}
