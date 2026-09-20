import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CircleDollarSign,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Store,
} from 'lucide-react'
import { sellerApi, userApi } from '../api'
import type { SellerProfile, SellerTierConfig, SellerVerificationRequest } from '../types'
import { useAuthStore } from '../stores'
import { formatPrice } from '../utils'
import { useCreatorDashboardReady } from '../hooks/useCreatorDashboardReady'
import { SELLER_TIER_ORDER, formatTier, getTierStyle } from '../utils/sellerTier'
import SellerIdentityHeader from '../components/seller/SellerIdentityHeader'
import SellerAnnouncementsBanner from '../components/seller/SellerAnnouncementsBanner'

const formatMoney = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') {
    return 'Custom'
  }

  return formatPrice(Number(value))
}

export default function SellerHubPage() {
  const navigate = useNavigate()
  const {
    user,
    isAuthenticated,
    hasHydrated,
    isLoading: authLoading,
    updateUser,
  } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
  const [verificationRequests, setVerificationRequests] = useState<
    SellerVerificationRequest[]
  >([])
  const [tiers, setTiers] = useState<SellerTierConfig[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyAction, setBusyAction] = useState<
    'activate' | 'onboard' | string | null
  >(null)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      navigate('/login', { state: { from: { pathname: '/seller-hub' } } })
    }
  }, [authLoading, hasHydrated, isAuthenticated, navigate])

  useEffect(() => {
    const load = async () => {
      if (!hasHydrated || !isAuthenticated) {
        return
      }

      setLoading(true)

      try {
        const [tierData, profileData, requestData] = await Promise.all([
          sellerApi.getTierConfig().catch(() => []),
          sellerApi
            .getMyProfile()
            .catch(() => ({ sellerProfile: null, eligible: false })),
          sellerApi.getVerificationRequests().catch(() => []),
        ])

        setTiers(tierData)
        setSellerProfile(profileData.sellerProfile)
        setVerificationRequests(requestData)
      } catch (loadError: any) {
        setError(
          loadError?.response?.data?.error ||
            'Could not load seller tools right now. Please try again.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [hasHydrated, isAuthenticated])

  const currentTierIndex = useMemo(() => {
    const tier = sellerProfile?.tier || 'unverified'
    return SELLER_TIER_ORDER.indexOf(tier)
  }, [sellerProfile?.tier])

  const pendingRequest = verificationRequests.find(
    (request) => request.status === 'PENDING',
  )

  const { ready: creatorDashboardReady } = useCreatorDashboardReady()

  const handleActivateBusinessMode = async () => {
    setBusyAction('activate')
    setError('')
    setSuccess('')

    try {
      const result = await userApi.activateBusinessMode({
        source: 'web_store_seller_hub',
      })

      updateUser({
        is_business_account: result.user.isBusinessAccount,
        user_type: result.user.userType,
        business_mode_activated_at: result.user.businessModeActivatedAt || null,
      })

      setSuccess('Business mode is active. Complete seller setup below.')
    } catch (actionError: any) {
      setError(
        actionError?.response?.data?.error ||
          'Could not activate business mode right now.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleOnboardSeller = async () => {
    setBusyAction('onboard')
    setError('')
    setSuccess('')

    try {
      const result = await sellerApi.onboard({
        termsAccepted: true,
        source: 'web_store_seller_hub',
      })

      setSellerProfile(result.sellerProfile)
      setSuccess(
        'Seller profile is ready. You can start with protected low-risk selling limits.',
      )
    } catch (actionError: any) {
      setError(
        actionError?.response?.data?.error ||
          'Could not prepare your seller profile right now.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleRequestTier = async (
    requestedTier: 'basic' | 'trusted' | 'pro',
  ) => {
    setBusyAction(requestedTier)
    setError('')
    setSuccess('')

    try {
      const result = await sellerApi.requestVerification({
        requestedTier,
        notes: `Requested from seller hub for ${requestedTier} tier.`,
      })

      setVerificationRequests((current) => [result.request, ...current])
      setSellerProfile((current) =>
        current
          ? {
              ...current,
              verification_status: 'PENDING_REVIEW',
            }
          : current,
      )
      setSuccess(
        `${formatTier(
          requestedTier,
        )} verification submitted. You can keep selling while review is in progress.`,
      )
    } catch (actionError: any) {
      setError(
        actionError?.response?.data?.error ||
          'Could not submit your verification request right now.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  if (authLoading || !hasHydrated || loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-stone-50'>
        <Loader2 className='h-8 w-8 animate-spin text-orange-500' />
      </div>
    )
  }

  if (!user) return null

  const fallbackName =
    `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email

  return (
    <div className='min-h-screen bg-stone-50 py-8'>
      <div className='mx-auto max-w-6xl px-4'>
        <Link
          to='/profile'
          className='mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900'
        >
          <ArrowLeft className='h-4 w-4' /> Back to profile
        </Link>

        <SellerIdentityHeader sellerProfile={sellerProfile} fallbackName={fallbackName} />

        <div className='mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
          <div>
            <p className='inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700'>
              <Store className='h-3.5 w-3.5' /> Seller Hub
            </p>
            <p className='mt-2 max-w-xl text-sm text-gray-500'>
              Start small, build trust, and grow into a protected marketplace seller with
              layered verification tiers.
            </p>
          </div>
          {creatorDashboardReady ? (
            <Link
              to='/seller-center'
              className='inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800'
            >
              <Briefcase className='h-4 w-4' /> Seller Center
            </Link>
          ) : (
            <div className='inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500'>
              <Briefcase className='h-4 w-4' /> Seller Center locked
            </div>
          )}
        </div>

        {sellerProfile && (
          <div className='mt-6'>
            <SellerAnnouncementsBanner />
          </div>
        )}

        {(error || success) && (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || success}
          </div>
        )}

        <div className='mt-6 grid gap-6 lg:grid-cols-[1.25fr,0.75fr]'>
          <div className='space-y-6'>
            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
                <p className='text-sm text-gray-500'>Business mode</p>
                <p className='mt-3 text-2xl font-bold text-slate-900'>
                  {user.is_business_account ? 'Active' : 'Customer'}
                </p>
              </div>
              <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
                <p className='text-sm text-gray-500'>Seller tier</p>
                <p className='mt-3 text-2xl font-bold text-slate-900'>
                  {formatTier(sellerProfile?.tier || 'unverified')}
                </p>
              </div>
              <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
                <p className='text-sm text-gray-500'>Verification</p>
                <p className='mt-3 text-2xl font-bold text-slate-900'>
                  {formatTier(sellerProfile?.verification_status || 'NOT_STARTED')}
                </p>
              </div>
            </div>

            <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
              <h2 className='text-xl font-bold text-slate-900'>
                Activation flow
              </h2>
              <div className='mt-5 space-y-4'>
                <div className='rounded-2xl border border-gray-100 p-4'>
                  <p className='font-semibold text-slate-900'>
                    1. Switch to business mode
                  </p>
                  <p className='mt-1 text-sm text-gray-500'>
                    Required once. This keeps buying flows intact while
                    unlocking creator and seller tools.
                  </p>
                  {!user.is_business_account ? (
                    <button
                      type='button'
                      onClick={handleActivateBusinessMode}
                      disabled={busyAction === 'activate'}
                      className='mt-4 inline-flex items-center rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      {busyAction === 'activate'
                        ? 'Activating...'
                        : 'Activate business mode'}
                    </button>
                  ) : (
                    <p className='mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700'>
                      <BadgeCheck className='h-4 w-4' /> Business mode is
                      already active.
                    </p>
                  )}
                </div>

                <div className='rounded-2xl border border-gray-100 p-4'>
                  <p className='font-semibold text-slate-900'>
                    2. Prepare seller profile
                  </p>
                  <p className='mt-1 text-sm text-gray-500'>
                    This creates your protected seller profile with safe listing
                    and price caps for early-stage trust building.
                  </p>
                  {!sellerProfile ? (
                    <button
                      type='button'
                      onClick={handleOnboardSeller}
                      disabled={
                        !user.is_business_account || busyAction === 'onboard'
                      }
                      className='mt-4 inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      {busyAction === 'onboard'
                        ? 'Preparing...'
                        : 'Create seller profile'}
                    </button>
                  ) : (
                    <p className='mt-3 text-sm text-emerald-700'>
                      Seller profile ready with initial marketplace protection
                      rules applied.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
              <div className='flex items-center justify-between gap-4'>
                <div>
                  <h2 className='text-xl font-bold text-slate-900'>
                    Trust tiers
                  </h2>
                  <p className='mt-1 text-sm text-gray-500'>
                    Higher trust unlocks better limits while strengthening buyer
                    protection.
                  </p>
                </div>
                {pendingRequest ? (
                  <span className='rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700'>
                    Pending review
                  </span>
                ) : null}
              </div>

              <div className='mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                {tiers.map((tier, index) => {
                  const isCurrent = sellerProfile?.tier === tier.tier
                  const isLocked =
                    Boolean(pendingRequest) || !sellerProfile || isCurrent
                  const isUpgrade =
                    SELLER_TIER_ORDER.indexOf(tier.tier) > currentTierIndex
                  const isPastTier = index < currentTierIndex
                  const tierStyle = getTierStyle(tier.tier)

                  return (
                    <div
                      key={tier.tier}
                      className={`relative overflow-hidden rounded-3xl border p-5 ${
                        isCurrent
                          ? 'border-orange-300 bg-orange-50'
                          : isPastTier
                          ? 'border-gray-100 bg-slate-50 opacity-60'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div
                        className={`absolute inset-x-0 top-0 h-1.5 bg-linear-to-r ${tierStyle.gradient}`}
                      />
                      <div className='flex items-center justify-between gap-3'>
                        <h3 className='text-lg font-bold text-slate-900'>
                          {formatTier(tier.tier)}
                        </h3>
                        {isCurrent ? (
                          <span className='rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white'>
                            Current
                          </span>
                        ) : null}
                      </div>

                      <p className='mt-2 text-sm leading-6 text-gray-500'>
                        {tier.description ||
                          'Controlled seller access with marketplace safeguards.'}
                      </p>

                      <div className='mt-5 space-y-3 text-sm text-slate-700'>
                        <div className='flex items-center justify-between gap-4'>
                          <span>Max active listings</span>
                          <span className='font-semibold'>
                            {tier.max_active_listings}
                          </span>
                        </div>
                        <div className='flex items-center justify-between gap-4'>
                          <span>Max price</span>
                          <span className='font-semibold'>
                            {formatMoney(tier.max_product_price)}
                          </span>
                        </div>
                        <div className='flex items-center justify-between gap-4'>
                          <span>Platform commission</span>
                          <span className='font-semibold'>
                            {tier.commission_rate !== null && tier.commission_rate !== undefined
                              ? `${tier.commission_rate}%`
                              : 'Standard'}
                          </span>
                        </div>
                        <div className='flex items-center justify-between gap-4'>
                          <span>Buyer protection</span>
                          <span className='font-semibold'>
                            {tier.buyer_protection_level || 'standard'}
                          </span>
                        </div>
                      </div>

                      {isUpgrade ? (
                        <button
                          type='button'
                          onClick={() =>
                            handleRequestTier(
                              tier.tier as 'basic' | 'trusted' | 'pro',
                            )
                          }
                          disabled={isLocked || busyAction === tier.tier}
                          className='mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          {busyAction === tier.tier
                            ? 'Submitting...'
                            : `Request ${formatTier(tier.tier)}`}
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className='space-y-6'>
            <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
              <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
                <ShieldCheck className='h-5 w-5 text-emerald-600' /> Safety
                model
              </h2>
              <ul className='mt-4 space-y-3 text-sm leading-6 text-gray-600'>
                <li>
                  Every seller starts with controlled listing and price limits.
                </li>
                <li>
                  Verification raises trust progressively instead of blocking
                  growth upfront.
                </li>
                <li>
                  Audit trails, moderation, and suspension controls protect
                  buyers and the platform.
                </li>
              </ul>
              <p className='mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-100'>
                Your Seller Center dashboard is available as soon as your
                seller profile is ready -- build your store now. Verification
                is only required before your storefront can go public.
              </p>
            </div>

            <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
              <h2 className='text-xl font-bold text-slate-900'>
                Seller snapshot
              </h2>
              <div className='mt-4 space-y-4 text-sm text-gray-600'>
                <div className='flex items-center justify-between gap-4'>
                  <span>Display name</span>
                  <span className='font-semibold text-slate-900'>
                    {sellerProfile?.display_name || fallbackName}
                  </span>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <span>Price cap</span>
                  <span className='font-semibold text-slate-900'>
                    {formatMoney(sellerProfile?.max_product_price)}
                  </span>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <span>Active listing limit</span>
                  <span className='font-semibold text-slate-900'>
                    {sellerProfile?.max_active_listings ?? 0}
                  </span>
                </div>
                {creatorDashboardReady ? (
                  <Link
                    to='/seller-center'
                    className='mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800'
                  >
                    <CircleDollarSign className='h-4 w-4' /> Open Seller
                    Center
                  </Link>
                ) : (
                  <p className='mt-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-center text-xs text-gray-500 ring-1 ring-slate-100'>
                    Finish activation to unlock your Seller Center dashboard.
                  </p>
                )}
                {sellerProfile && (
                  <Link
                    to='/seller-center/support'
                    className='inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50'
                  >
                    <MessageCircle className='h-4 w-4' /> Contact support
                  </Link>
                )}
              </div>
            </div>

            <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
              <h2 className='text-xl font-bold text-slate-900'>
                Verification timeline
              </h2>
              <div className='mt-4 space-y-3'>
                {verificationRequests.length === 0 ? (
                  <div className='rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500'>
                    No verification requests yet. Start with Basic when you are
                    ready.
                  </div>
                ) : (
                  verificationRequests.map((request) => (
                    <div
                      key={request.id}
                      className='rounded-2xl border border-gray-100 px-4 py-4'
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <p className='font-semibold text-slate-900'>
                          {formatTier(request.requested_tier)} tier request
                        </p>
                        <span className='rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'>
                          {request.status}
                        </span>
                      </div>
                      <p className='mt-2 text-sm text-gray-500'>
                        {request.notes ||
                          'Submitted for marketplace trust review.'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
