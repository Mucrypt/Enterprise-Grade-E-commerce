import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CheckCircle2,
  DollarSign,
  Clock3,
  Loader2,
  ListTodo,
  Sparkles,
  Store,
  UserCircle2,
  TrendingUp,
} from 'lucide-react'
import { creatorApi, sellerApi, userApi } from '../api'
import type {
  CreatorBookDraftInput,
  CreatorActivityItem,
  CreatorDashboardMetrics,
  CreatorProfile,
  SellerProfile,
} from '../types'
import { useAuthStore } from '../stores'

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const formatMoney = (value: number) => `$${Number(value || 0).toFixed(2)}`

export default function CreatorDashboardPage() {
  const navigate = useNavigate()
  const {
    user,
    isAuthenticated,
    hasHydrated,
    isLoading: authLoading,
    updateUser,
  } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isCreatingBook, setIsCreatingBook] = useState(false)
  const [isSubmittingBook, setIsSubmittingBook] = useState(false)
  const [isActivatingBusiness, setIsActivatingBusiness] = useState(false)

  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(
    null,
  )
  const [metrics, setMetrics] = useState<CreatorDashboardMetrics | null>(null)
  const [activityFeed, setActivityFeed] = useState<CreatorActivityItem[]>([])
  const [activityNextCursor, setActivityNextCursor] = useState<string | null>(
    null,
  )
  const [activityHasMore, setActivityHasMore] = useState(false)
  const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false)
  const [latestBookId, setLatestBookId] = useState<string | null>(null)
  const [latestBookSlug, setLatestBookSlug] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [profileForm, setProfileForm] = useState({
    handle: '',
    displayName: '',
    bio: '',
    websiteUrl: '',
  })

  const [bookForm, setBookForm] = useState<CreatorBookDraftInput>({
    name: '',
    slug: '',
    description: '',
    shortDescription: '',
    basePrice: 9.99,
    salePrice: 0,
    format: 'pdf',
    fileUrl: '',
    previewUrl: '',
    coverImageUrl: '',
  })

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      navigate('/login', {
        state: { from: { pathname: '/creator-dashboard' } },
      })
    }
  }, [authLoading, hasHydrated, isAuthenticated, navigate])

  useEffect(() => {
    const load = async () => {
      if (!hasHydrated || !isAuthenticated) return

      setLoading(true)
      setError('')

      try {
        const [sellerResult, metricsResult, activityResult] = await Promise.all(
          [
            sellerApi
              .getMyProfile()
              .catch(() => ({ sellerProfile: null, eligible: false })),
            creatorApi.getDashboardMetrics().catch(() => null),
            creatorApi.getDashboardActivity().catch(() => ({
              items: [],
              pagination: {
                hasMore: false,
                nextCursor: null,
                limit: 10,
              },
              generatedAt: new Date().toISOString(),
            })),
          ],
        )

        setSellerProfile(sellerResult.sellerProfile)
        setMetrics(metricsResult)
        setActivityFeed(activityResult.items)
        setActivityHasMore(activityResult.pagination?.hasMore ?? false)
        setActivityNextCursor(activityResult.pagination?.nextCursor ?? null)

        try {
          const creator = await creatorApi.getMyProfile()
          setCreatorProfile(creator)
          setProfileForm({
            handle: creator.handle || '',
            displayName: creator.display_name || '',
            bio: creator.bio || '',
            websiteUrl: creator.website_url || '',
          })
        } catch {
          setCreatorProfile(null)
          const fallbackHandle =
            user?.email
              ?.split('@')[0]
              ?.toLowerCase()
              .replace(/[^a-z0-9]/g, '') || 'creator'
          setProfileForm((current) => ({
            ...current,
            handle: current.handle || fallbackHandle,
            displayName:
              current.displayName ||
              `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
          }))
        }
      } catch (loadError: any) {
        setError(
          loadError?.response?.data?.error ||
            'Could not load creator dashboard right now.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [
    hasHydrated,
    isAuthenticated,
    user?.email,
    user?.first_name,
    user?.last_name,
  ])

  const creatorVerificationStatus =
    sellerProfile?.verification_status ||
    creatorProfile?.verification_status ||
    'none'

  const creatorDashboardReady = useMemo(() => {
    return (
      Boolean(user?.is_business_account) &&
      creatorVerificationStatus === 'approved' &&
      !sellerProfile?.is_suspended
    )
  }, [
    creatorVerificationStatus,
    sellerProfile?.is_suspended,
    user?.is_business_account,
  ])

  const totalBooks = metrics?.activation.totalBooks ?? 0
  const publishedBooks = metrics?.activation.publishedBooks ?? 0
  const pendingReviewBooks = metrics?.activation.pendingReviewBooks ?? 0
  const rejectedBooks = metrics?.activation.rejectedBooks ?? 0
  const grossSales30d = metrics?.sales.grossSales30d ?? 0
  const timeToFirstSaleHours = metrics?.sales.timeToFirstSaleHours ?? null
  const catalogProgress =
    totalBooks > 0 ? Math.round((publishedBooks / totalBooks) * 100) : 0
  const creatorHandle = creatorProfile?.handle || 'creator'
  const creatorDisplayName =
    creatorProfile?.display_name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    'Creator'
  const dashboardReadiness = [
    user?.is_business_account ? 25 : 0,
    sellerProfile ? 25 : 0,
    creatorProfile ? 25 : 0,
    totalBooks > 0 ? 25 : 0,
  ].reduce((sum, value) => sum + value, 0)

  const analyticsBars = useMemo(
    () => [
      { label: 'Total books', value: Math.max(totalBooks, 1) },
      { label: 'Published', value: Math.max(publishedBooks, 1) },
      { label: 'In review', value: Math.max(pendingReviewBooks, 1) },
      {
        label: '30d sales',
        value: Math.max(Math.round(grossSales30d / 100), 1),
      },
    ],
    [grossSales30d, pendingReviewBooks, publishedBooks, totalBooks],
  )

  const maxAnalyticsValue = Math.max(
    ...analyticsBars.map((bar) => bar.value),
    1,
  )

  const canAccessCreatorDashboard = creatorDashboardReady

  const handleActivateBusiness = async () => {
    setError('')
    setSuccess('')
    setIsActivatingBusiness(true)

    try {
      const result = await userApi.activateBusinessMode({
        source: 'web_creator_dashboard',
      })

      updateUser({
        is_business_account: result.user.isBusinessAccount,
        user_type: result.user.userType,
        business_mode_activated_at: result.user.businessModeActivatedAt || null,
      })

      setSuccess(
        'Business mode activated. You can now configure your creator profile.',
      )
    } catch (activationError: any) {
      setError(
        activationError?.response?.data?.error ||
          'Could not activate business mode right now. Please try again.',
      )
    } finally {
      setIsActivatingBusiness(false)
    }
  }

  const handleSaveCreatorProfile = async () => {
    setError('')
    setSuccess('')
    setIsSavingProfile(true)

    try {
      const saved = await creatorApi.upsertMyProfile({
        handle: toSlug(profileForm.handle),
        displayName: profileForm.displayName.trim(),
        bio: profileForm.bio.trim(),
        websiteUrl: profileForm.websiteUrl.trim(),
        isPublic: true,
      })

      setCreatorProfile(saved)
      setSuccess(
        'Creator profile saved. Your public creator identity is ready.',
      )
    } catch (saveError: any) {
      setError(
        saveError?.response?.data?.error || 'Could not save creator profile.',
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleCreateBook = async () => {
    setError('')
    setSuccess('')
    setIsCreatingBook(true)

    try {
      const payload: CreatorBookDraftInput = {
        name: bookForm.name.trim(),
        slug: toSlug(bookForm.slug || bookForm.name),
        description: bookForm.description?.trim(),
        shortDescription: bookForm.shortDescription?.trim(),
        basePrice: Number(bookForm.basePrice || 0),
        salePrice: Number(bookForm.salePrice || 0) || undefined,
        format: bookForm.format,
        fileUrl: bookForm.fileUrl?.trim() || undefined,
        previewUrl: bookForm.previewUrl?.trim() || undefined,
        coverImageUrl: bookForm.coverImageUrl?.trim() || undefined,
      }

      const created = await creatorApi.createBook(payload)
      setLatestBookId(created.id)
      setLatestBookSlug(created.slug)
      setSuccess(
        'Book draft created successfully. Submit it for review when ready.',
      )

      if (!metrics) return
      setMetrics({
        ...metrics,
        activation: {
          ...metrics.activation,
          totalBooks: metrics.activation.totalBooks + 1,
        },
      })
    } catch (createError: any) {
      setError(
        createError?.response?.data?.error || 'Could not create book draft.',
      )
    } finally {
      setIsCreatingBook(false)
    }
  }

  const handleSubmitLatestBook = async () => {
    if (!latestBookId) return

    setError('')
    setSuccess('')
    setIsSubmittingBook(true)

    try {
      await creatorApi.submitBookForReview(latestBookId, {
        notes: 'Submitted from creator dashboard',
      })
      setSuccess('Book submitted for review successfully.')
    } catch (submitError: any) {
      setError(
        submitError?.response?.data?.error ||
          'Could not submit this book yet. Make sure a full file URL is provided.',
      )
    } finally {
      setIsSubmittingBook(false)
    }
  }

  const handleLoadMoreActivity = async () => {
    if (!activityHasMore || !activityNextCursor || isLoadingMoreActivity) {
      return
    }

    setIsLoadingMoreActivity(true)
    setError('')

    try {
      const result = await creatorApi.getDashboardActivity(
        10,
        activityNextCursor,
      )

      setActivityFeed((current) => {
        const existingIds = new Set(current.map((item) => item.id))
        const newItems = result.items.filter(
          (item) => !existingIds.has(item.id),
        )
        return [...current, ...newItems]
      })

      setActivityHasMore(result.pagination?.hasMore ?? false)
      setActivityNextCursor(result.pagination?.nextCursor ?? null)
    } catch (loadMoreError: any) {
      setError(
        loadMoreError?.response?.data?.error ||
          'Could not load more activity right now.',
      )
    } finally {
      setIsLoadingMoreActivity(false)
    }
  }

  if (authLoading || !hasHydrated || loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-50'>
        <Loader2 className='h-8 w-8 animate-spin text-orange-500' />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className='min-h-screen bg-slate-50 py-8'>
      <div className='mx-auto max-w-7xl px-4'>
        <div className='rounded-[28px] bg-linear-to-br from-slate-950 via-slate-900 to-blue-700 p-8 text-white shadow-xl'>
          <div className='flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
            <div className='max-w-3xl'>
              <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100'>
                <Sparkles className='h-4 w-4' /> Creator Dashboard
              </div>
              <h1 className='mt-4 text-3xl font-black tracking-tight sm:text-4xl'>
                A dedicated seller and creator workspace separate from admin
                operations.
              </h1>
              <p className='mt-3 max-w-2xl text-sm leading-6 text-blue-50/85'>
                Build products, publish books, and scale revenue with
                trust-first workflows. This dashboard is built for marketplace
                creators, not back-office admins.
              </p>
            </div>

            <div className='flex flex-wrap gap-3'>
              <Link
                to='/seller-hub'
                className='inline-flex items-center gap-2 rounded-2xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10'
              >
                <ArrowLeft className='h-4 w-4' /> Seller hub
              </Link>
              <Link
                to='/books'
                className='inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-blue-50'
              >
                <BookOpen className='h-4 w-4' /> Books marketplace
              </Link>
            </div>
          </div>
        </div>

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

        <div className='mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
            <p className='text-sm text-gray-500'>Command status</p>
            <p className='mt-2 text-xl font-bold text-slate-900'>
              {creatorDashboardReady
                ? 'Ready to publish'
                : creatorVerificationStatus === 'pending'
                ? 'Awaiting admin approval'
                : user.is_business_account
                ? 'Prepare and request review'
                : 'Activate business mode'}
            </p>
            <p className='mt-2 text-sm text-gray-500'>
              {creatorDashboardReady
                ? 'Your creator workspace is fully unlocked.'
                : 'Seller Hub is your next step before this dashboard opens.'}
            </p>
          </div>

          <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
            <p className='text-sm text-gray-500'>Catalog growth</p>
            <p className='mt-2 text-2xl font-bold text-slate-900'>
              {publishedBooks}/{totalBooks}
            </p>
            <div className='mt-3 h-2 rounded-full bg-gray-100'>
              <div
                className='h-2 rounded-full bg-linear-to-r from-orange-500 to-blue-600'
                style={{ width: `${Math.min(catalogProgress, 100)}%` }}
              />
            </div>
            <p className='mt-2 text-sm text-gray-500'>
              {catalogProgress}% of your drafts are live.
            </p>
          </div>

          <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
            <p className='text-sm text-gray-500'>30-day revenue</p>
            <p className='mt-2 text-2xl font-bold text-slate-900'>
              {formatMoney(grossSales30d)}
            </p>
            <p className='mt-2 text-sm text-gray-500'>
              {metrics?.sales.paidOrders ?? 0} paid orders and{' '}
              {metrics?.sales.unitsSold ?? 0} units sold.
            </p>
          </div>

          <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
            <p className='text-sm text-gray-500'>Readiness score</p>
            <p className='mt-2 text-2xl font-bold text-slate-900'>
              {dashboardReadiness}/100
            </p>
            <p className='mt-2 text-sm text-gray-500'>
              Profile, seller, creator, and catalog readiness combined.
            </p>
          </div>
        </div>

        {!canAccessCreatorDashboard ? (
          <div className='mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
            <h2 className='text-xl font-bold text-slate-900'>
              {!user.is_business_account
                ? 'Activate business mode first'
                : creatorVerificationStatus === 'pending'
                ? 'Waiting for admin verification'
                : creatorVerificationStatus === 'rejected'
                ? 'Verification was rejected'
                : sellerProfile?.is_suspended
                ? 'Creator access suspended'
                : 'Creator dashboard locked'}
            </h2>
            <p className='mt-2 text-sm text-gray-600'>
              {!user.is_business_account
                ? 'This dashboard is available to verified seller/creator accounts only. Activate business mode, then request admin verification from Seller Hub.'
                : creatorVerificationStatus === 'pending'
                ? 'Your verification request is pending review. Once an admin approves it, your dashboard will unlock and you can create books and products.'
                : creatorVerificationStatus === 'rejected'
                ? 'Your verification request was rejected. Return to Seller Hub to update your verification details and resubmit.'
                : sellerProfile?.is_suspended
                ? 'Your seller profile is suspended. Access is paused until moderation clears it.'
                : 'Creator access is not yet approved.'}
            </p>
            <div className='mt-5 flex flex-wrap gap-3'>
              {!user.is_business_account ? (
                <button
                  type='button'
                  onClick={handleActivateBusiness}
                  disabled={isActivatingBusiness}
                  className='inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <Store className='h-4 w-4' />
                  {isActivatingBusiness
                    ? 'Activating...'
                    : 'Activate business mode'}
                </button>
              ) : null}
              <Link
                to='/seller-hub'
                className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50'
              >
                <Store className='h-4 w-4' /> Open seller hub
              </Link>
            </div>
          </div>
        ) : (
          <div className='mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]'>
            <div className='space-y-6'>
              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
                  <div>
                    <p className='inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700'>
                      <BarChart3 className='h-3.5 w-3.5' /> Command center
                    </p>
                    <h2 className='mt-3 text-2xl font-black tracking-tight text-slate-900'>
                      {creatorDisplayName}
                    </h2>
                    <p className='mt-2 text-sm text-gray-500'>
                      @{creatorHandle} · {creatorVerificationStatus} access ·{' '}
                      {user.is_business_account
                        ? 'business account active'
                        : 'business mode required'}
                    </p>
                  </div>
                  <div className='rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100'>
                    <p className='text-xs font-semibold uppercase tracking-[0.2em] text-gray-500'>
                      Publishing pipeline
                    </p>
                    <p className='mt-1 text-sm font-semibold text-slate-900'>
                      {publishedBooks} live · {pendingReviewBooks} in review ·{' '}
                      {rejectedBooks} rejected
                    </p>
                  </div>
                </div>
                <div className='mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                  <div className='rounded-2xl bg-slate-950 p-4 text-white'>
                    <p className='text-sm text-slate-300'>Total books</p>
                    <p className='mt-2 text-3xl font-black'>{totalBooks}</p>
                  </div>
                  <div className='rounded-2xl bg-blue-50 p-4 text-slate-900 ring-1 ring-blue-100'>
                    <p className='text-sm text-gray-500'>Published</p>
                    <p className='mt-2 text-3xl font-black text-blue-700'>
                      {publishedBooks}
                    </p>
                  </div>
                  <div className='rounded-2xl bg-orange-50 p-4 text-slate-900 ring-1 ring-orange-100'>
                    <p className='text-sm text-gray-500'>In review</p>
                    <p className='mt-2 text-3xl font-black text-orange-600'>
                      {pendingReviewBooks}
                    </p>
                  </div>
                  <div className='rounded-2xl bg-emerald-50 p-4 text-slate-900 ring-1 ring-emerald-100'>
                    <p className='text-sm text-gray-500'>Gross sales (30d)</p>
                    <p className='mt-2 text-3xl font-black text-emerald-700'>
                      {formatMoney(grossSales30d)}
                    </p>
                  </div>
                </div>
                <div className='mt-5'>
                  <div className='mb-2 flex items-center justify-between text-sm'>
                    <span className='font-medium text-slate-900'>
                      Catalog launch progress
                    </span>
                    <span className='text-gray-500'>{catalogProgress}%</span>
                  </div>
                  <div className='h-2 rounded-full bg-gray-100'>
                    <div
                      className='h-2 rounded-full bg-linear-to-r from-blue-600 via-orange-500 to-emerald-500'
                      style={{ width: `${Math.min(catalogProgress, 100)}%` }}
                    />
                  </div>
                  <p className='mt-2 text-sm text-gray-500'>
                    {creatorDashboardReady
                      ? 'Your account is approved. Focus on product quality, release cadence, and sales conversion.'
                      : 'Finish the approval flow, then the full publishing studio unlocks here.'}
                  </p>
                </div>
              </div>

              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
                  <UserCircle2 className='h-5 w-5 text-blue-600' /> Creator
                  identity
                </h2>
                <p className='mt-1 text-sm text-gray-500'>
                  Configure how buyers see your creator storefront.
                </p>

                <div className='mt-5 grid gap-4 md:grid-cols-2'>
                  <input
                    value={profileForm.displayName}
                    onChange={(e) =>
                      setProfileForm((current) => ({
                        ...current,
                        displayName: e.target.value,
                      }))
                    }
                    placeholder='Display name'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
                  />
                  <input
                    value={profileForm.handle}
                    onChange={(e) =>
                      setProfileForm((current) => ({
                        ...current,
                        handle: e.target.value,
                      }))
                    }
                    placeholder='Handle (e.g. jane-doe)'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
                  />
                  <input
                    value={profileForm.websiteUrl}
                    onChange={(e) =>
                      setProfileForm((current) => ({
                        ...current,
                        websiteUrl: e.target.value,
                      }))
                    }
                    placeholder='Website URL (optional)'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:col-span-2'
                  />
                  <textarea
                    value={profileForm.bio}
                    onChange={(e) =>
                      setProfileForm((current) => ({
                        ...current,
                        bio: e.target.value,
                      }))
                    }
                    placeholder='Creator bio'
                    rows={4}
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:col-span-2'
                  />
                </div>

                <button
                  type='button'
                  onClick={handleSaveCreatorProfile}
                  disabled={isSavingProfile}
                  className='mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  {isSavingProfile ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <BadgeCheck className='h-4 w-4' />
                  )}
                  {isSavingProfile ? 'Saving...' : 'Save creator profile'}
                </button>
              </div>

              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
                  <Sparkles className='h-5 w-5 text-blue-600' /> Growth signals
                </h2>
                <div className='mt-5 grid gap-4 md:grid-cols-3'>
                  <div className='rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100'>
                    <p className='text-xs font-semibold uppercase tracking-[0.18em] text-gray-500'>
                      First sale
                    </p>
                    <p className='mt-2 text-lg font-bold text-slate-900'>
                      {timeToFirstSaleHours != null
                        ? `${timeToFirstSaleHours}h`
                        : 'Not yet'}
                    </p>
                  </div>
                  <div className='rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100'>
                    <p className='text-xs font-semibold uppercase tracking-[0.18em] text-gray-500'>
                      Activation date
                    </p>
                    <p className='mt-2 text-lg font-bold text-slate-900'>
                      {metrics?.activation.creatorProfileCreatedAt
                        ? new Date(
                            metrics.activation.creatorProfileCreatedAt,
                          ).toLocaleDateString()
                        : 'Pending'}
                    </p>
                  </div>
                  <div className='rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100'>
                    <p className='text-xs font-semibold uppercase tracking-[0.18em] text-gray-500'>
                      Rejected drafts
                    </p>
                    <p className='mt-2 text-lg font-bold text-slate-900'>
                      {rejectedBooks}
                    </p>
                  </div>
                </div>
              </div>

              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <div className='flex items-center justify-between gap-4'>
                  <div>
                    <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
                      <TrendingUp className='h-5 w-5 text-emerald-600' />
                      Analytics snapshot
                    </h2>
                    <p className='mt-1 text-sm text-gray-500'>
                      A compact read on catalog progress and early revenue.
                    </p>
                  </div>
                  <div className='rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100'>
                    <p className='text-xs font-semibold uppercase tracking-[0.2em] text-gray-500'>
                      Readiness
                    </p>
                    <p className='mt-1 text-sm font-semibold text-slate-900'>
                      {dashboardReadiness}/100
                    </p>
                  </div>
                </div>

                <div className='mt-5 space-y-3'>
                  {analyticsBars.map((bar) => {
                    const width = Math.max(
                      Math.round((bar.value / maxAnalyticsValue) * 100),
                      8,
                    )

                    return (
                      <div key={bar.label} className='space-y-2'>
                        <div className='flex items-center justify-between text-sm'>
                          <span className='font-medium text-slate-900'>
                            {bar.label}
                          </span>
                          <span className='text-gray-500'>{bar.value}</span>
                        </div>
                        <div className='h-3 rounded-full bg-gray-100'>
                          <div
                            className='h-3 rounded-full bg-linear-to-r from-slate-900 via-blue-600 to-orange-500'
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <div className='flex items-center justify-between gap-4'>
                  <div>
                    <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
                      <ListTodo className='h-5 w-5 text-blue-600' />
                      Recent activity
                    </h2>
                    <p className='mt-1 text-sm text-gray-500'>
                      Derived from creator profile, seller status, and sales
                      signals.
                    </p>
                  </div>
                  <div className='rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100'>
                    <p className='text-xs font-semibold uppercase tracking-[0.2em] text-blue-700'>
                      Feed
                    </p>
                    <p className='mt-1 text-sm font-semibold text-blue-800'>
                      Lifecycle summary
                    </p>
                  </div>
                </div>

                <div className='mt-5 space-y-3'>
                  {activityFeed.length > 0 ? (
                    activityFeed.map((item) => {
                      const timeLabel = item.occurredAt
                        ? new Date(item.occurredAt).toLocaleString()
                        : 'Just now'

                      return (
                        <div
                          key={item.id}
                          className='flex gap-4 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-4'
                        >
                          <div className='mt-1 h-3 w-3 rounded-full bg-orange-500' />
                          <div className='flex-1'>
                            <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                              <p className='font-semibold text-slate-900'>
                                {item.title}
                              </p>
                              <span className='inline-flex items-center gap-1 text-xs font-medium text-gray-500'>
                                <Clock3 className='h-3.5 w-3.5' /> {timeLabel}
                              </span>
                            </div>
                            <p className='mt-1 text-sm leading-6 text-gray-600'>
                              {item.description}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className='rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500'>
                      Recent creator activity will appear here once you create
                      drafts, submit books, or start making sales.
                    </div>
                  )}
                </div>

                {activityHasMore ? (
                  <div className='mt-5'>
                    <button
                      type='button'
                      onClick={handleLoadMoreActivity}
                      disabled={isLoadingMoreActivity}
                      className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      {isLoadingMoreActivity ? (
                        <>
                          <Loader2 className='h-4 w-4 animate-spin' /> Loading
                          more
                        </>
                      ) : (
                        'Load more activity'
                      )}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
                  <BookOpen className='h-5 w-5 text-orange-600' /> Create and
                  launch book
                </h2>
                <p className='mt-1 text-sm text-gray-500'>
                  Publish your own product directly from the marketplace creator
                  dashboard.
                </p>

                <div className='mt-5 grid gap-4 md:grid-cols-2'>
                  <input
                    value={bookForm.name}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        name: e.target.value,
                      }))
                    }
                    placeholder='Book title'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
                  />
                  <input
                    value={bookForm.slug || ''}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        slug: e.target.value,
                      }))
                    }
                    placeholder='Slug (optional)'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
                  />
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={bookForm.basePrice}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        basePrice: Number(e.target.value || 0),
                      }))
                    }
                    placeholder='Base price'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
                  />
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={bookForm.salePrice || 0}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        salePrice: Number(e.target.value || 0),
                      }))
                    }
                    placeholder='Sale price (optional)'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
                  />
                  <input
                    value={bookForm.fileUrl || ''}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        fileUrl: e.target.value,
                      }))
                    }
                    placeholder='Full book file URL (required before submit)'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100 md:col-span-2'
                  />
                  <input
                    value={bookForm.previewUrl || ''}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        previewUrl: e.target.value,
                      }))
                    }
                    placeholder='Preview URL (optional)'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
                  />
                  <input
                    value={bookForm.coverImageUrl || ''}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        coverImageUrl: e.target.value,
                      }))
                    }
                    placeholder='Cover image URL (optional)'
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
                  />
                  <textarea
                    value={bookForm.shortDescription || ''}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        shortDescription: e.target.value,
                      }))
                    }
                    placeholder='Short description'
                    rows={2}
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100 md:col-span-2'
                  />
                  <textarea
                    value={bookForm.description || ''}
                    onChange={(e) =>
                      setBookForm((current) => ({
                        ...current,
                        description: e.target.value,
                      }))
                    }
                    placeholder='Long description'
                    rows={4}
                    className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100 md:col-span-2'
                  />
                </div>

                <div className='mt-5 flex flex-wrap gap-3'>
                  <button
                    type='button'
                    onClick={handleCreateBook}
                    disabled={
                      isCreatingBook ||
                      !bookForm.name.trim() ||
                      !bookForm.basePrice
                    }
                    className='inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {isCreatingBook ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <CheckCircle2 className='h-4 w-4' />
                    )}
                    {isCreatingBook ? 'Creating...' : 'Create draft book'}
                  </button>

                  <button
                    type='button'
                    onClick={handleSubmitLatestBook}
                    disabled={isSubmittingBook || !latestBookId}
                    className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {isSubmittingBook ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <BarChart3 className='h-4 w-4' />
                    )}
                    {isSubmittingBook
                      ? 'Submitting...'
                      : 'Submit latest draft for review'}
                  </button>

                  {latestBookSlug ? (
                    <Link
                      to={`/books/${latestBookSlug}`}
                      className='inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100'
                    >
                      <BookOpen className='h-4 w-4' /> View latest draft page
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className='space-y-6'>
              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
                  <DollarSign className='h-5 w-5 text-emerald-600' /> Revenue
                  intelligence
                </h2>
                <div className='mt-4 space-y-4 text-sm text-gray-700'>
                  <div className='flex items-center justify-between gap-3'>
                    <span>Gross sales</span>
                    <span className='font-semibold text-slate-900'>
                      {formatMoney(metrics?.sales.grossSales || 0)}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <span>Paid orders</span>
                    <span className='font-semibold text-slate-900'>
                      {metrics?.sales.paidOrders ?? 0}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <span>Units sold</span>
                    <span className='font-semibold text-slate-900'>
                      {metrics?.sales.unitsSold ?? 0}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <span>Time to first sale</span>
                    <span className='font-semibold text-slate-900'>
                      {metrics?.sales.timeToFirstSaleHours != null
                        ? `${metrics.sales.timeToFirstSaleHours}h`
                        : 'Not yet'}
                    </span>
                  </div>
                </div>
              </div>

              <div className='rounded-3xl bg-slate-950 p-6 text-white shadow-sm ring-1 ring-black/5'>
                <h2 className='flex items-center gap-2 text-xl font-bold'>
                  <CheckCircle2 className='h-5 w-5 text-emerald-400' /> Launch
                  readiness
                </h2>
                <p className='mt-2 text-sm text-slate-300'>
                  A simple model to keep creators moving without overwhelming
                  them.
                </p>
                <div className='mt-5 space-y-3'>
                  {[
                    {
                      label: 'Business mode active',
                      done: Boolean(user.is_business_account),
                    },
                    {
                      label: 'Seller profile ready',
                      done: Boolean(sellerProfile),
                    },
                    {
                      label: 'Admin approved',
                      done: creatorDashboardReady,
                    },
                    {
                      label: 'Book draft ready',
                      done: Boolean(latestBookId),
                    },
                    {
                      label: 'Revenue started',
                      done: (metrics?.sales.unitsSold ?? 0) > 0,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className='flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3'
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          item.done ? 'bg-emerald-500' : 'bg-white/15'
                        }`}
                      >
                        <CheckCircle2 className='h-3.5 w-3.5 text-white' />
                      </span>
                      <span className='text-sm font-medium text-white'>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <h2 className='text-xl font-bold text-slate-900'>
                  Operational checklist
                </h2>
                <ul className='mt-4 space-y-3 text-sm leading-6 text-gray-600'>
                  <li>
                    1. Activate business mode and keep seller profile healthy.
                  </li>
                  <li>2. Save creator profile with a unique public handle.</li>
                  <li>3. Create book drafts with secure asset URLs.</li>
                  <li>
                    4. Submit drafts for review to enter publishing queue.
                  </li>
                  <li>5. Track sales and optimize titles from metrics.</li>
                </ul>
              </div>

              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <h2 className='text-xl font-bold text-slate-900'>
                  Access status
                </h2>
                <div className='mt-4 space-y-3 text-sm text-gray-700'>
                  <div className='flex items-center justify-between gap-3'>
                    <span>Business account</span>
                    <span className='font-semibold text-slate-900'>
                      {user.is_business_account ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <span>Seller profile</span>
                    <span className='font-semibold text-slate-900'>
                      {sellerProfile ? 'Ready' : 'Not prepared'}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <span>Creator profile</span>
                    <span className='font-semibold text-slate-900'>
                      {creatorProfile ? 'Ready' : 'Not configured'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
