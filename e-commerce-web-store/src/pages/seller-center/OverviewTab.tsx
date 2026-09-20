// The dashboard's front page. Three honestly-labeled, real-data cards
// (Store earnings / Book sales / Discover reach) replace the old
// "Readiness score: 0/100" client-side heuristic and the books-only
// "Catalog growth"/"30-day revenue" tiles that read as broken for any
// seller who only lists store products. A real getting-started checklist
// (not a fake score) auto-hides once every step is done.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clapperboard,
  Clock3,
  Loader2,
  Store,
  Wallet,
} from 'lucide-react'
import { creatorApi, discoverApi, sellerEarningsApi, sellerProductsApi } from '../../api'
import type { CreatorActivityItem, CreatorDashboardMetrics } from '../../types'
import { formatPrice } from '../../utils'
import SellerQuickActions from '../../components/seller-center/SellerQuickActions'
import { useCreatorDashboardContext } from './context'

export default function OverviewTab() {
  const { sellerProfile } = useCreatorDashboardContext()

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<CreatorDashboardMetrics | null>(null)
  const [activity, setActivity] = useState<CreatorActivityItem[]>([])
  const [storeEarnings, setStoreEarnings] = useState({
    pendingBalance: 0,
    confirmedUnpaidBalance: 0,
    lifetimePaid: 0,
  })
  const [discoverReach, setDiscoverReach] = useState({
    views: 0,
    likes: 0,
    purchases: 0,
    postCount: 0,
  })
  const [storeProductCount, setStoreProductCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const [metricsResult, activityResult, earningsResult, discoverResult, productsResult] =
        await Promise.all([
          creatorApi.getDashboardMetrics().catch(() => null),
          creatorApi
            .getDashboardActivity(5)
            .catch(() => ({ items: [], pagination: { hasMore: false, nextCursor: null, limit: 5 }, generatedAt: '' })),
          sellerEarningsApi
            .getSummary()
            .catch(() => ({ pendingBalance: 0, confirmedUnpaidBalance: 0, lifetimePaid: 0, tier: null, commissionRate: null })),
          discoverApi.getMine().catch(() => []),
          sellerProductsApi.getMine().catch(() => []),
        ])

      if (cancelled) return

      setMetrics(metricsResult)
      setActivity(activityResult.items)
      setStoreEarnings({
        pendingBalance: earningsResult.pendingBalance,
        confirmedUnpaidBalance: earningsResult.confirmedUnpaidBalance,
        lifetimePaid: earningsResult.lifetimePaid,
      })
      setDiscoverReach({
        views: discoverResult.reduce((sum, post) => sum + post.view_count, 0),
        likes: discoverResult.reduce((sum, post) => sum + post.like_count, 0),
        purchases: discoverResult.reduce((sum, post) => sum + post.purchase_count, 0),
        postCount: discoverResult.length,
      })
      setStoreProductCount(productsResult.length)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const grossSales30d = metrics?.sales.grossSales30d ?? 0

  const checklist = [
    { label: 'List your first store product', done: storeProductCount > 0, to: '/seller-center/products' },
    { label: 'Post to Discover', done: discoverReach.postCount > 0, to: '/seller-center/content' },
    {
      label: 'Make your first sale',
      done:
        storeEarnings.pendingBalance + storeEarnings.confirmedUnpaidBalance + storeEarnings.lifetimePaid > 0 ||
        (metrics?.sales.unitsSold ?? 0) > 0,
      to: '/seller-center/finances',
    },
  ]
  const allDone = checklist.every((item) => item.done)

  if (loading) {
    return (
      <div className='flex items-center justify-center rounded-3xl bg-white py-16 shadow-sm ring-1 ring-black/5'>
        <Loader2 className='h-6 w-6 animate-spin text-orange-500' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <SellerQuickActions handle={sellerProfile?.handle || null} dashboardReady />

      {!allDone && (
        <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
          <h2 className='text-lg font-bold text-slate-900'>Getting started</h2>
          <div className='mt-4 space-y-2'>
            {checklist.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className='flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 transition hover:bg-slate-100'
              >
                <span className='flex items-center gap-3'>
                  {item.done ? (
                    <CheckCircle2 className='h-5 w-5 text-emerald-500' />
                  ) : (
                    <Circle className='h-5 w-5 text-gray-300' />
                  )}
                  <span
                    className={`text-sm font-medium ${item.done ? 'text-gray-400 line-through' : 'text-slate-900'}`}
                  >
                    {item.label}
                  </span>
                </span>
                {!item.done && <ArrowRight className='h-4 w-4 text-gray-400' />}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className='grid gap-4 sm:grid-cols-3'>
        <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
          <p className='flex items-center gap-2 text-sm text-gray-500'>
            <Wallet className='h-4 w-4 text-emerald-600' /> Store earnings
          </p>
          <p className='mt-2 text-2xl font-black text-slate-900'>
            {formatPrice(storeEarnings.confirmedUnpaidBalance)}
          </p>
          <p className='mt-1 text-xs text-gray-500'>Owed to you, confirmed and unpaid.</p>
        </div>

        <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
          <p className='flex items-center gap-2 text-sm text-gray-500'>
            <Store className='h-4 w-4 text-blue-600' /> Book sales, last 30 days
          </p>
          <p className='mt-2 text-2xl font-black text-slate-900'>{formatPrice(grossSales30d)}</p>
          <p className='mt-1 text-xs text-gray-500'>
            {metrics?.sales.paidOrders ?? 0} paid orders &middot; {metrics?.sales.unitsSold ?? 0} units.
          </p>
        </div>

        <div className='rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5'>
          <p className='flex items-center gap-2 text-sm text-gray-500'>
            <Clapperboard className='h-4 w-4 text-orange-600' /> Discover reach
          </p>
          <p className='mt-2 text-2xl font-black text-slate-900'>{discoverReach.views}</p>
          <p className='mt-1 text-xs text-gray-500'>
            views across {discoverReach.postCount} posts &middot; {discoverReach.likes} likes
          </p>
        </div>
      </div>

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <div className='flex items-center justify-between gap-4'>
          <h2 className='text-lg font-bold text-slate-900'>Recent activity</h2>
          <Link
            to='/seller-center/activity'
            className='inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700'
          >
            View all <ArrowRight className='h-3.5 w-3.5' />
          </Link>
        </div>
        <div className='mt-4 space-y-3'>
          {activity.length > 0 ? (
            activity.map((item) => (
              <div key={item.id} className='flex gap-3 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3'>
                <div className='mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500' />
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                    <p className='truncate text-sm font-semibold text-slate-900'>{item.title}</p>
                    <span className='inline-flex items-center gap-1 text-xs text-gray-500'>
                      <Clock3 className='h-3 w-3' />
                      {item.occurredAt ? new Date(item.occurredAt).toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                  <p className='mt-0.5 truncate text-xs text-gray-500'>{item.description}</p>
                </div>
              </div>
            ))
          ) : (
            <p className='text-sm text-gray-500'>Nothing yet -- activity appears as you list products and sell.</p>
          )}
        </div>
      </div>

      {sellerProfile?.tier && (
        <p className='text-center text-xs text-gray-400'>
          Selling as a {sellerProfile.tier} tier seller.
        </p>
      )}
    </div>
  )
}
