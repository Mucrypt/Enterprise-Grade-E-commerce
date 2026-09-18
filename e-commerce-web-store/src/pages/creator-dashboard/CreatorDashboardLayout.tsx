// Replaces the old single-route, single-long-scroll CreatorDashboardPage.
// Fetches identity-level data ONLY (who is this seller/creator, are they
// approved) and renders a persistent identity header + tab switcher +
// <Outlet/>. Each tab route fetches its own data on mount instead of
// everything loading up front.

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Activity,
  BarChart3,
  BookOpen,
  Clapperboard,
  Loader2,
  Settings2,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { cn } from '../../utils'
import { creatorApi, sellerApi, userApi } from '../../api'
import type { CreatorProfile, SellerProfile } from '../../types'
import { useAuthStore } from '../../stores'
import { useCreatorDashboardReady } from '../../hooks/useCreatorDashboardReady'
import SellerIdentityHeader from '../../components/seller/SellerIdentityHeader'

const TABS = [
  { to: '/creator-dashboard/overview', label: 'Overview', icon: BarChart3 },
  { to: '/creator-dashboard/store', label: 'Store products', icon: Store },
  { to: '/creator-dashboard/books', label: 'Books', icon: BookOpen },
  { to: '/creator-dashboard/discover', label: 'Discover', icon: Clapperboard },
  { to: '/creator-dashboard/performance', label: 'Performance', icon: TrendingUp },
  { to: '/creator-dashboard/earnings', label: 'Earnings', icon: Wallet },
  { to: '/creator-dashboard/activity', label: 'Activity', icon: Activity },
  { to: '/creator-dashboard/settings', label: 'Settings', icon: Settings2 },
]

export default function CreatorDashboardLayout() {
  const navigate = useNavigate()
  const { user, isAuthenticated, hasHydrated, isLoading: authLoading, updateUser } =
    useAuthStore()

  const [loading, setLoading] = useState(true)
  const [isActivating, setIsActivating] = useState(false)
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      navigate('/login', { state: { from: { pathname: '/creator-dashboard' } } })
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

  const { ready, isBusinessAccount, verificationStatus } = useCreatorDashboardReady(
    sellerProfile,
    creatorProfile,
  )

  const handleActivateBusiness = async () => {
    setIsActivating(true)
    try {
      const result = await userApi.activateBusinessMode({ source: 'web_creator_dashboard' })
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
                ? 'Creator access suspended'
                : 'Creator dashboard locked'}
            </h2>
            <p className='mt-2 text-sm text-gray-600'>
              {!isBusinessAccount
                ? 'This dashboard is available to verified seller/creator accounts only. Activate business mode, then request admin verification from Seller Hub.'
                : verificationStatus === 'pending'
                ? 'Your verification request is pending review. Once an admin approves it, your dashboard will unlock and you can create books and products.'
                : verificationStatus === 'rejected'
                ? 'Your verification request was rejected. Return to Seller Hub to update your verification details and resubmit.'
                : sellerProfile?.is_suspended
                ? 'Your seller profile is suspended. Access is paused until moderation clears it.'
                : 'Creator access is not yet approved.'}
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
    <div className='min-h-screen bg-slate-50 pb-16'>
      <div className='mx-auto max-w-6xl px-4 pt-8'>
        <NavLink
          to='/seller-hub'
          className='mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900'
        >
          <ArrowLeft className='h-4 w-4' /> Seller hub
        </NavLink>

        <SellerIdentityHeader sellerProfile={sellerProfile} fallbackName={fallbackName} />

        <div className='sticky top-0 z-10 -mx-4 mt-6 overflow-x-auto bg-slate-50/95 px-4 py-3 backdrop-blur-sm'>
          <div className='flex w-max gap-2'>
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }: { isActive: boolean }) =>
                  cn(
                    'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition',
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100',
                  )
                }
              >
                <tab.icon className='h-4 w-4' />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className='mt-6'>
          <Outlet
            context={{
              sellerProfile,
              creatorProfile,
              setCreatorProfile,
              fallbackName,
            }}
          />
        </div>
      </div>
    </div>
  )
}
