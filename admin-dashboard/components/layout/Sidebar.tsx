'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Images,
  Layers,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  BarChart3,
  Tag,
  Truck,
  Ticket,
  Star,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  children?: NavItem[]
}

const navigation: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Products',
    href: '/products',
    icon: Package,
    children: [
      {
        title: 'All Products',
        href: '/products',
        icon: Package,
      },
      {
        title: 'Add Product',
        href: '/products/new',
        icon: Package,
      },
      {
        title: 'Categories',
        href: '/categories',
        icon: FolderTree,
      },
      {
        title: 'Collections',
        href: '/collections',
        icon: Layers,
      },
      {
        title: 'Brands',
        href: '/brands',
        icon: Tag,
      },
    ],
  },
  {
    title: 'Media Library',
    href: '/dashboard/media',
    icon: Images,
  },
  {
    title: 'Orders',
    href: '/dashboard/orders',
    icon: ShoppingCart,
    badge: 'New',
  },
  {
    title: 'Shipping',
    href: '/dashboard/shipping',
    icon: Truck,
  },
  {
    title: 'Customers',
    href: '/dashboard/customers',
    icon: Users,
  },
  {
    title: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    title: 'Admins',
    href: '/dashboard/admins',
    icon: Shield,
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [expandedItems, setExpandedItems] = React.useState<string[]>([])

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title],
    )
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className='flex h-screen w-64 flex-col border-r bg-card'>
      {/* Logo/Brand */}
      <div className='flex h-16 items-center border-b px-6'>
        <Link href='/dashboard' className='flex items-center space-x-2'>
          <div className='h-8 w-8 rounded-lg bg-linear-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold'>
            TT
          </div>
          <span className='text-xl font-bold'>TechTools</span>
        </Link>
      </div>

      {/* User Info */}
      <div className='border-b p-4'>
        <div className='flex items-center space-x-3'>
          <div className='h-10 w-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold'>
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-medium truncate'>
              {user?.firstName} {user?.lastName}
            </p>
            <p className='text-xs text-muted-foreground truncate'>
              {user?.email}
            </p>
          </div>
        </div>
        {user?.userType === 'super_admin' && (
          <div className='mt-2 inline-flex items-center rounded-full bg-linear-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-xs font-semibold text-white'>
            <Shield className='mr-1 h-3 w-3' />
            Super Admin
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className='flex-1 overflow-y-auto p-4 space-y-1'>
        {navigation.map((item) => (
          <div key={item.title}>
            {item.children ? (
              <div>
                <button
                  onClick={() => toggleExpand(item.title)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive(item.href) && 'bg-accent text-accent-foreground',
                  )}
                >
                  <div className='flex items-center space-x-3'>
                    <item.icon className='h-5 w-5' />
                    <span>{item.title}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      expandedItems.includes(item.title) && 'rotate-180',
                    )}
                  />
                </button>
                {expandedItems.includes(item.title) && (
                  <div className='ml-4 mt-1 space-y-1 border-l pl-2'>
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                          isActive(child.href) &&
                            'bg-accent text-accent-foreground',
                        )}
                      >
                        <child.icon className='h-4 w-4' />
                        <span>{child.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive(item.href) && 'bg-accent text-accent-foreground',
                )}
              >
                <div className='flex items-center space-x-3'>
                  <item.icon className='h-5 w-5' />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span className='rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground'>
                    {item.badge}
                  </span>
                )}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Logout Button */}
      <div className='border-t p-4'>
        <button
          onClick={logout}
          className='flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors'
        >
          <LogOut className='h-5 w-5' />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
