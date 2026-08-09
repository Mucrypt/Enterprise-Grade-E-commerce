'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  BookOpen,
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
  FileText,
  Hash,
  UserCircle,
  TrendingUp,
  MessageSquare,
  Mail,
  Newspaper,
  Inbox,
  Send,
  Megaphone,
  Bot,
  UserCheck,
  Building2,
  Activity,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStaffAccess } from '@/contexts/StaffAccessContext'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  children?: NavItem[]
  /**
   * When set, this item (and its children) is hidden unless the current
   * user has this permission -- legacy admin/super_admin always pass,
   * matching their existing unrestricted access (see
   * StaffAccessContext.hasPermission). Items with no `permission` remain
   * visible to anyone who can reach the dashboard shell at all, same as
   * before the staff system existed. This is a rendering convenience only
   * -- every route behind a gated item must also enforce the same
   * permission server-side; hiding a link is never itself authorization.
   */
  permission?: string
}

const navigation: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    // New in ADMIN-PLATFORM-2A -- a separate page from /dashboard so the
    // current default landing experience is unchanged this phase. See
    // docs/ADMIN-PLATFORM-2-ROADMAP.md Part K.
    title: 'Command Center',
    href: '/command-center',
    icon: Activity,
    badge: 'New',
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
      {
        title: 'Suppliers',
        href: '/suppliers',
        icon: Truck,
      },
    ],
  },
  {
    title: 'Books',
    href: '/books',
    icon: BookOpen,
    badge: 'New',
  },
  {
    title: 'Sellers',
    href: '/sellers',
    icon: UserCheck,
    badge: 'New',
  },
  {
    title: 'Media Library',
    href: '/dashboard/media',
    icon: Images,
  },
  {
    title: 'Blog',
    href: '/blog',
    icon: FileText,
    children: [
      {
        title: 'All Posts',
        href: '/blog',
        icon: FileText,
      },
      {
        title: 'New Post',
        href: '/blog/new',
        icon: FileText,
      },
      {
        title: 'Categories',
        href: '/blog/categories',
        icon: FolderTree,
      },
      {
        title: 'Tags',
        href: '/blog/tags',
        icon: Hash,
      },
      {
        title: 'Authors',
        href: '/blog/authors',
        icon: UserCircle,
      },
    ],
  },
  {
    title: 'Trending',
    href: '/trending',
    icon: TrendingUp,
    badge: 'New',
  },
  {
    title: 'Sales',
    href: '/dashboard/orders',
    icon: ShoppingCart,
    children: [
      {
        title: 'Orders',
        href: '/dashboard/orders',
        icon: ShoppingCart,
      },
      {
        title: 'Customers',
        href: '/dashboard/customers',
        icon: Users,
      },
      {
        title: 'Shipping',
        href: '/dashboard/shipping',
        icon: Truck,
      },
    ],
  },
  {
    title: 'Communication',
    href: '/email',
    icon: Send,
    badge: 'New',
    children: [
      {
        title: 'AI Hub',
        href: '/ai-hub',
        icon: Bot,
        badge: 'AI',
      },
      {
        title: 'Email',
        href: '/email',
        icon: Mail,
      },
      {
        title: 'WhatsApp',
        href: '/whatsapp',
        icon: MessageSquare,
      },
      {
        title: 'Newsletter',
        href: '/newsletter',
        icon: Newspaper,
      },
      {
        title: 'Contact Messages',
        href: '/contact',
        icon: Inbox,
      },
    ],
  },
  {
    title: 'Marketing',
    href: '/dashboard/marketing',
    icon: Megaphone,
    children: [
      {
        title: 'Promotions',
        href: '/dashboard/promotions',
        icon: Ticket,
      },
      {
        title: 'Coupons',
        href: '/dashboard/coupons',
        icon: Tag,
      },
    ],
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
    // Additive -- the legacy "Admins" link above is untouched. This is the
    // new staff_memberships-based Organization area (see
    // docs/041-STAFF-MEMBERSHIPS-IMPLEMENTATION-REPORT.md).
    title: 'Organization',
    href: '/organization/staff',
    icon: Building2,
    permission: 'staff.view',
    children: [
      {
        title: 'Staff',
        href: '/organization/staff',
        icon: Building2,
        permission: 'staff.view',
      },
    ],
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    // Concrete proof point for "a SUPPORT_AGENT must not see Stripe
    // configuration simply because the sidebar contains that link" --
    // Settings holds payment/carrier/security configuration. Every other
    // existing nav item is intentionally left ungated in this phase (see
    // the ADMIN-PLATFORM-2 roadmap's Part J note on incremental rollout);
    // this is the one item worth gating immediately given what it exposes.
    permission: 'settings.view',
  },
]

function filterNavByPermission(
  items: NavItem[],
  hasPermission: (permission: string) => boolean,
): NavItem[] {
  return items
    .filter((item) => !item.permission || hasPermission(item.permission))
    .map((item) =>
      item.children
        ? { ...item, children: filterNavByPermission(item.children, hasPermission) }
        : item,
    )
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { hasPermission, isLoading: staffLoading } = useStaffAccess()
  const [expandedItems, setExpandedItems] = React.useState<string[]>([])

  // While /staff/me is still resolving, show only ungated items -- avoids
  // a flash of a permission-gated link (e.g. Organization/Settings)
  // followed by it disappearing a moment later for someone who turns out
  // not to have that permission.
  const visibleNavigation = React.useMemo(
    () =>
      staffLoading
        ? navigation.filter((item) => !item.permission)
        : filterNavByPermission(navigation, hasPermission),
    [staffLoading, hasPermission],
  )

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
        {visibleNavigation.map((item) => (
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
                    {item.badge && (
                      <span className='rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground'>
                        {item.badge}
                      </span>
                    )}
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
