// ============================================
// Mobile Menu Component (SHEIN Style Drawer)
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  X,
  ChevronRight,
  ChevronLeft,
  User,
  Heart,
  Package,
  Settings,
  HelpCircle,
  LogIn,
  LogOut,
  Home,
  Percent,
  Gift,
  Bell,
} from 'lucide-react'
import { useUIStore, useAuthStore } from '../../stores'
import { cn } from '../../utils'
import type { Category } from '../../types'

interface MobileMenuProps {
  categories: {
    id: string
    label: string
    href: string
    featured?: boolean
    color?: string
  }[]
  /** Real, DB-driven category tree (nav-eligible top level + their real
   * children) -- rendered as its own drill-down section below the static
   * pills above, since a real tree has nesting the flat list never had. */
  dynamicCategories?: Category[]
}

export default function MobileMenu({ categories, dynamicCategories = [] }: MobileMenuProps) {
  const { closeMobileMenu } = useUIStore()
  const { isAuthenticated, user, logout } = useAuthStore()
  const [drilledInto, setDrilledInto] = useState<Category | null>(null)

  const handleLogout = async () => {
    await logout()
    closeMobileMenu()
  }

  return (
    <div className='fixed inset-0 z-100 lg:hidden'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={closeMobileMenu}
      />

      {/* Menu Panel */}
      <div className='absolute left-0 top-0 bottom-0 w-[85%] max-w-sm bg-white shadow-xl animate-slide-in-left overflow-hidden'>
        {/* Header */}
        <div className='bg-linear-to-r from-orange-500 to-red-500 text-white p-6'>
          <button
            onClick={closeMobileMenu}
            className='absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors'
          >
            <X className='w-6 h-6' />
          </button>

          {isAuthenticated && user ? (
            <Link
              to='/profile'
              onClick={closeMobileMenu}
              className='flex items-center gap-4'
            >
              <div className='w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold'>
                {user.first_name?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
              <div>
                <p className='font-semibold text-lg'>
                  {user.first_name || ''} {user.last_name || ''}
                </p>
                <p className='text-white/80 text-sm'>{user.email}</p>
              </div>
            </Link>
          ) : (
            <div className='flex items-center gap-4'>
              <div className='w-14 h-14 bg-white/20 rounded-full flex items-center justify-center'>
                <User className='w-7 h-7' />
              </div>
              <div>
                <Link
                  to='/login'
                  onClick={closeMobileMenu}
                  className='font-semibold text-lg hover:underline'
                >
                  Sign In / Register
                </Link>
                <p className='text-white/80 text-sm'>Access your account</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className='grid grid-cols-4 gap-2 p-4 bg-gray-50 border-b'>
          <Link
            to='/'
            onClick={closeMobileMenu}
            className='flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white transition-colors'
          >
            <Home className='w-5 h-5 text-gray-600' />
            <span className='text-xs text-gray-600'>Home</span>
          </Link>
          <Link
            to='/deals'
            onClick={closeMobileMenu}
            className='flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white transition-colors'
          >
            <Percent className='w-5 h-5 text-red-500' />
            <span className='text-xs text-gray-600'>Deals</span>
          </Link>
          <Link
            to='/new-arrivals'
            onClick={closeMobileMenu}
            className='flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white transition-colors'
          >
            <Gift className='w-5 h-5 text-orange-500' />
            <span className='text-xs text-gray-600'>New</span>
          </Link>
          <Link
            to='/notifications'
            onClick={closeMobileMenu}
            className='flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white transition-colors relative'
          >
            <Bell className='w-5 h-5 text-gray-600' />
            <span className='text-xs text-gray-600'>Alerts</span>
            <span className='absolute top-1 right-4 w-2 h-2 bg-red-500 rounded-full' />
          </Link>
        </div>

        {/* Main Content */}
        <div className='overflow-y-auto h-[calc(100vh-280px)]'>
          {/* Categories */}
          <div className='p-4'>
            <h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3'>
              Shop by Category
            </h3>
            <nav className='space-y-1'>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={category.href}
                  onClick={closeMobileMenu}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors',
                    category.color,
                  )}
                >
                  <span
                    className={cn(
                      'font-medium',
                      category.featured && 'text-red-600',
                    )}
                  >
                    {category.label}
                  </span>
                  <ChevronRight className='w-5 h-5 text-gray-400' />
                </Link>
              ))}
            </nav>
          </div>

          {/* Dynamic, DB-driven catalog categories -- one level of
              drill-down since a real tree has nesting the static pills
              above never handled. */}
          {dynamicCategories.length > 0 && (
            <div className='p-4 border-t'>
              {drilledInto ? (
                <>
                  <button
                    onClick={() => setDrilledInto(null)}
                    className='flex items-center gap-2 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide'
                  >
                    <ChevronLeft className='w-4 h-4' /> Back
                  </button>
                  <Link
                    to={`/category/${drilledInto.slug}`}
                    onClick={closeMobileMenu}
                    className='block p-3 mb-1 font-semibold text-orange-600 rounded-lg hover:bg-orange-50'
                  >
                    All {drilledInto.name}
                  </Link>
                  <nav className='space-y-1'>
                    {(drilledInto.children || []).map((child) => (
                      <Link
                        key={child.id}
                        to={`/category/${child.slug}`}
                        onClick={closeMobileMenu}
                        className='flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors'
                      >
                        <span className='font-medium'>{child.name}</span>
                        <ChevronRight className='w-5 h-5 text-gray-400' />
                      </Link>
                    ))}
                  </nav>
                </>
              ) : (
                <>
                  <h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3'>
                    More Categories
                  </h3>
                  <nav className='space-y-1'>
                    {dynamicCategories.map((category) =>
                      category.children && category.children.length > 0 ? (
                        <button
                          key={category.id}
                          onClick={() => setDrilledInto(category)}
                          className='flex w-full items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors'
                        >
                          <span className='font-medium'>{category.name}</span>
                          <ChevronRight className='w-5 h-5 text-gray-400' />
                        </button>
                      ) : (
                        <Link
                          key={category.id}
                          to={`/category/${category.slug}`}
                          onClick={closeMobileMenu}
                          className='flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors'
                        >
                          <span className='font-medium'>{category.name}</span>
                          <ChevronRight className='w-5 h-5 text-gray-400' />
                        </Link>
                      ),
                    )}
                  </nav>
                </>
              )}
            </div>
          )}

          {/* Account Links */}
          <div className='p-4 border-t'>
            <h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3'>
              My Account
            </h3>
            <nav className='space-y-1'>
              <Link
                to='/orders'
                onClick={closeMobileMenu}
                className='flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors'
              >
                <Package className='w-5 h-5 text-gray-500' />
                <span>My Orders</span>
              </Link>
              <Link
                to='/wishlist'
                onClick={closeMobileMenu}
                className='flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors'
              >
                <Heart className='w-5 h-5 text-gray-500' />
                <span>Wishlist</span>
              </Link>
              <Link
                to='/profile'
                onClick={closeMobileMenu}
                className='flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors'
              >
                <Settings className='w-5 h-5 text-gray-500' />
                <span>Settings</span>
              </Link>
              <Link
                to='/support'
                onClick={closeMobileMenu}
                className='flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors'
              >
                <HelpCircle className='w-5 h-5 text-gray-500' />
                <span>Help & Support</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Footer */}
        <div className='absolute bottom-0 left-0 right-0 p-4 bg-white border-t'>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className='flex items-center justify-center gap-2 w-full p-3 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors'
            >
              <LogOut className='w-5 h-5' />
              Sign Out
            </button>
          ) : (
            <Link
              to='/login'
              onClick={closeMobileMenu}
              className='flex items-center justify-center gap-2 w-full p-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors'
            >
              <LogIn className='w-5 h-5' />
              Sign In
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
