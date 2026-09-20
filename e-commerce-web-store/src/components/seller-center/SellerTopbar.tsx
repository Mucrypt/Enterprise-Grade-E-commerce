// A restrained, professional topbar -- deliberately not another
// gradient marketing banner (SellerIdentityHeader stays on SellerHubPage,
// where a bigger identity moment still makes sense during onboarding).
// This is closer to Stripe Dashboard/Shopify Admin: store name + status,
// search, notifications, account menu.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Menu, Search, Settings, Store, User } from 'lucide-react'
import { NotificationBell } from '../notifications/NotificationBell'
import SellerStatusBadge from './SellerStatusBadge'
import { useAuthStore } from '../../stores'
import type { SellerProfile } from '../../types'

export default function SellerTopbar({
  sellerProfile,
  fallbackName,
  onOpenMobileNav,
  onOpenCommandPalette,
}: {
  sellerProfile: SellerProfile | null
  fallbackName: string
  onOpenMobileNav: () => void
  onOpenCommandPalette: () => void
}) {
  const { logout } = useAuthStore()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = sellerProfile?.display_name || fallbackName

  useEffect(() => {
    if (!accountMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [accountMenuOpen])

  return (
    <header className='flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3'>
      <div className='flex min-w-0 items-center gap-3'>
        <button
          type='button'
          onClick={onOpenMobileNav}
          aria-label='Open navigation'
          className='rounded-lg p-2 text-slate-600 hover:bg-gray-100 lg:hidden'
        >
          <Menu className='h-5 w-5' />
        </button>
        <div className='min-w-0'>
          <p className='truncate text-sm font-bold text-slate-900'>{displayName}</p>
          {sellerProfile && (
            <SellerStatusBadge
              verificationStatus={sellerProfile.verification_status}
              isSuspended={sellerProfile.is_suspended}
            />
          )}
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={onOpenCommandPalette}
          className='hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50 sm:flex'
        >
          <Search className='h-4 w-4' />
          <span>Search...</span>
          <kbd className='rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold'>
            &#8984;K
          </kbd>
        </button>
        <button
          type='button'
          onClick={onOpenCommandPalette}
          aria-label='Search Seller Center'
          className='rounded-lg p-2 text-slate-600 hover:bg-gray-100 sm:hidden'
        >
          <Search className='h-5 w-5' />
        </button>

        {sellerProfile?.handle && (
          <Link
            to={`/seller/${sellerProfile.handle}`}
            target='_blank'
            rel='noreferrer'
            className='hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-gray-50 md:flex'
          >
            <Store className='h-4 w-4' /> View store
          </Link>
        )}

        <NotificationBell />

        <div className='relative' ref={menuRef}>
          <button
            type='button'
            onClick={() => setAccountMenuOpen((v) => !v)}
            aria-haspopup='menu'
            aria-expanded={accountMenuOpen}
            className='flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white'
          >
            {displayName.charAt(0).toUpperCase()}
          </button>
          {accountMenuOpen && (
            <div
              role='menu'
              className='absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg'
            >
              <Link
                to='/seller-hub'
                role='menuitem'
                className='flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-gray-50'
                onClick={() => setAccountMenuOpen(false)}
              >
                <User className='h-4 w-4' /> Seller profile
              </Link>
              <Link
                to='/seller-center/settings'
                role='menuitem'
                className='flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-gray-50'
                onClick={() => setAccountMenuOpen(false)}
              >
                <Settings className='h-4 w-4' /> Settings
              </Link>
              <Link
                to='/'
                role='menuitem'
                className='flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-gray-50'
                onClick={() => setAccountMenuOpen(false)}
              >
                &larr; Return to TechTools
              </Link>
              <button
                type='button'
                role='menuitem'
                onClick={() => logout()}
                className='flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50'
              >
                <LogOut className='h-4 w-4' /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
