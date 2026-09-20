// The Seller Center's application shell -- sidebar + topbar + <Outlet/>.
// The locked-state screen only shows for a genuinely closed door (no
// seller profile yet, or the account is SUSPENDED/CLOSED) -- an
// onboarded-but-unverified seller reaches the full shell so they can
// keep building their store; a persistent banner (not a wall) explains
// when their storefront specifically isn't public yet.

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Loader2, Store } from 'lucide-react'
import { creatorApi, sellerApi } from '../../api'
import type { CreatorProfile, SellerProfile } from '../../types'
import { useAuthStore } from '../../stores'
import { useCreatorDashboardReady } from '../../hooks/useCreatorDashboardReady'
import SellerSidebar from '../../components/seller-center/SellerSidebar'
import SellerMobileNav from '../../components/seller-center/SellerMobileNav'
import SellerTopbar from '../../components/seller-center/SellerTopbar'
import SellerCommandPalette from '../../components/seller-center/SellerCommandPalette'

export default function SellerCenterShell() {
  const navigate = useNavigate()
  const { user, isAuthenticated, hasHydrated, isLoading: authLoading } = useAuthStore()

  const [loading, setLoading] = useState(true)
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

  const { ready, loading: capabilitiesLoading, capabilities } = useCreatorDashboardReady()

  if (authLoading || !hasHydrated || loading || capabilitiesLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50'>
        <Loader2 className='h-8 w-8 animate-spin text-orange-500' />
      </div>
    )
  }

  if (!user) return null

  const fallbackName =
    `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email

  // A genuinely closed door only -- no seller application started yet,
  // or the account is SUSPENDED/CLOSED. Anyone else (still onboarding,
  // pending review, rejected, restricted) reaches the real shell below
  // so they can keep building; canOpenStorefront is the one thing that
  // still requires real verification, surfaced as a banner inside the
  // shell instead of a wall in front of it.
  if (!ready) {
    const nextAction = capabilities?.requiredNextAction
    const message =
      capabilities?.blockingReasons[0] ||
      'Seller Center access is not available for this account right now.'
    const heading =
      nextAction === 'START_ONBOARDING'
        ? 'Start your seller journey'
        : nextAction === 'CONTACT_SUPPORT'
        ? 'Seller account suspended'
        : 'Seller Center unavailable'

    return (
      <div className='min-h-screen bg-slate-50 py-8'>
        <div className='mx-auto max-w-3xl px-4'>
          <div className='rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5'>
            <h2 className='text-xl font-bold text-slate-900'>{heading}</h2>
            <p className='mt-2 text-sm text-gray-600'>{message}</p>
            <div className='mt-5 flex flex-wrap gap-3'>
              {nextAction === 'START_ONBOARDING' ? (
                <NavLink
                  to='/seller-hub'
                  className='inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600'
                >
                  <Store className='h-4 w-4' /> Start onboarding
                </NavLink>
              ) : (
                <NavLink
                  to='/support'
                  className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50'
                >
                  <Store className='h-4 w-4' /> Contact support
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // The one thing that still requires real verification: a public,
  // buyer-facing storefront. Shown as a persistent banner inside the
  // shell rather than a wall in front of it -- everyone reaching this
  // point can already build; this just explains why "View storefront"
  // is hidden and what unlocks it.
  const showStorefrontBanner = capabilities != null && !capabilities.canOpenStorefront

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

        {showStorefrontBanner && (
          <div className='flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-2.5 sm:px-6'>
            <p className='text-sm text-amber-800'>
              {capabilities?.blockingReasons[0] ||
                "Your storefront isn't public yet -- verification is required before customers can find and buy from you."}
            </p>
            <NavLink
              to='/seller-hub'
              className='shrink-0 text-sm font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950'
            >
              Continue verification
            </NavLink>
          </div>
        )}

        <main className='flex-1 overflow-y-auto p-4 sm:p-6'>
          <Outlet
            context={{
              sellerProfile,
              creatorProfile,
              setCreatorProfile,
              fallbackName,
              capabilities,
            }}
          />
        </main>
      </div>

      <SellerCommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  )
}
