// The Seller Center's application shell -- sidebar + topbar + <Outlet/>,
// evolved from the old CreatorDashboardLayout (same identity fetch, same
// useCreatorDashboardReady() gate, same locked-state screen -- all of
// that was already correct). What changed is purely presentational: the
// old pill-tab strip + big gradient identity banner are replaced with a
// real sidebar-based workspace shell, matching a Stripe Dashboard/
// Shopify Admin register rather than another marketing page.

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Loader2, Store } from 'lucide-react'
import { creatorApi, sellerApi, userApi } from '../../api'
import type { CreatorProfile, SellerProfile } from '../../types'
import { useAuthStore } from '../../stores'
import { useCreatorDashboardReady } from '../../hooks/useCreatorDashboardReady'
import SellerSidebar from '../../components/seller-center/SellerSidebar'
import SellerMobileNav from '../../components/seller-center/SellerMobileNav'
import SellerTopbar from '../../components/seller-center/SellerTopbar'
import SellerCommandPalette from '../../components/seller-center/SellerCommandPalette'

export default function SellerCenterShell() {
  const navigate = useNavigate()
  const { user, isAuthenticated, hasHydrated, isLoading: authLoading, updateUser } =
    useAuthStore()

  const [loading, setLoading] = useState(true)
  const [isActivating, setIsActivating] = useState(false)
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      navigate('/login', { state: { from: { pathname: '/seller-center' } } })
    }
  }, [authLoading, hasHydrated, isAuthenticated, navigate])

  useEffect(() => {
    const load = async () => {
      if (!hasHydrated || !isAuthenticated) return
      setLoading(true)
      try {
        const [sellerResult, creatorResult] = await Promise.all([
          sellerApi.getMyProfile().catch(() => ({ sellerProfile: null, eligible: false })),
          creatorApi.getMyProfile().catch(() => null),
        ])
        setSellerProfile(sellerResult.sellerProfile)
        setCreatorProfile(creatorResult)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [hasHydrated, isAuthenticated])

  // Real, global Cmd/Ctrl+K -- the "⌘K" hint in the customer store's own
  // Header.tsx has never had a listener behind it; this is the first one.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const { ready, isBusinessAccount, verificationStatus } = useCreatorDashboardReady(
    sellerProfile,
    creatorProfile,
  )

  const handleActivateBusiness = async () => {
    setIsActivating(true)
    try {
      const result = await userApi.activateBusinessMode({ source: 'web_seller_center' })
      updateUser({
        is_business_account: result.user.isBusinessAccount,
        user_type: result.user.userType,
        business_mode_activated_at: result.user.businessModeActivatedAt || null,
      })
    } finally {
      setIsActivating(false)
    }
  }

  if (authLoading || !hasHydrated || loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50'>
        <Loader2 className='h-8 w-8 animate-spin text-orange-500' />
      </div>
    )
  }

  if (!user) return null

  const fallbackName =
    `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email

  if (!ready) {
    return (
      <div className='min-h-screen bg-slate-50 py-8'>
        <div className='mx-auto max-w-3xl px-4'>
          <div className='rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5'>
            <h2 className='text-xl font-bold text-slate-900'>
              {!isBusinessAccount
                ? 'Activate business mode first'
                : verificationStatus === 'pending'
                ? 'Waiting for admin verification'
                : verificationStatus === 'rejected'
                ? 'Verification was rejected'
                : sellerProfile?.is_suspended
                ? 'Seller Center access suspended'
                : 'Seller Center locked'}
            </h2>
            <p className='mt-2 text-sm text-gray-600'>
              {!isBusinessAccount
                ? 'Seller Center is available to verified seller accounts only. Activate business mode, then request admin verification from Seller Hub.'
                : verificationStatus === 'pending'
                ? 'Your verification request is pending review. Once an admin approves it, Seller Center will unlock.'
                : verificationStatus === 'rejected'
                ? 'Your verification request was rejected. Return to Seller Hub to update your verification details and resubmit.'
                : sellerProfile?.is_suspended
                ? 'Your seller profile is suspended. Access is paused until moderation clears it.'
                : 'Seller Center access is not yet approved.'}
            </p>
            <div className='mt-5 flex flex-wrap gap-3'>
              {!isBusinessAccount ? (
                <button
                  type='button'
                  onClick={handleActivateBusiness}
                  disabled={isActivating}
                  className='inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <Store className='h-4 w-4' />
                  {isActivating ? 'Activating...' : 'Activate business mode'}
                </button>
              ) : null}
              <NavLink
                to='/seller-hub'
                className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50'
              >
                <Store className='h-4 w-4' /> Open seller hub
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-screen overflow-hidden bg-slate-50'>
      <SellerSidebar />
      <SellerMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className='flex min-w-0 flex-1 flex-col'>
        <SellerTopbar
          sellerProfile={sellerProfile}
          fallbackName={fallbackName}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        <main className='flex-1 overflow-y-auto p-4 sm:p-6'>
          <Outlet
            context={{
              sellerProfile,
              creatorProfile,
              setCreatorProfile,
              fallbackName,
            }}
          />
        </main>
      </div>

      <SellerCommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  )
}
