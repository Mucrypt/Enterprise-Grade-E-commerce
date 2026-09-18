// New. Every DiscoverPost already carries real per-post engagement
// counters (view/like/save/share/add_to_cart/purchase) that had zero UI
// surface anywhere before this pass. This aggregates them into a
// "what's working" view -- a real analytics feed built entirely from
// data already being fetched elsewhere, not a new backend metric.

import { useEffect, useState } from 'react'
import {
  Bookmark,
  Eye,
  Heart,
  Loader2,
  Share2,
  ShoppingCart,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import { discoverApi, type DiscoverPost } from '../../api'

const STAT_ICONS = [
  { key: 'view_count' as const, label: 'Views', icon: Eye, color: 'text-slate-500' },
  { key: 'like_count' as const, label: 'Likes', icon: Heart, color: 'text-red-500' },
  { key: 'save_count' as const, label: 'Saves', icon: Bookmark, color: 'text-blue-500' },
  { key: 'share_count' as const, label: 'Shares', icon: Share2, color: 'text-violet-500' },
  { key: 'add_to_cart_count' as const, label: 'Adds to cart', icon: ShoppingCart, color: 'text-orange-500' },
  { key: 'purchase_count' as const, label: 'Purchases', icon: ShoppingBag, color: 'text-emerald-600' },
]

export default function PerformanceTab() {
  const [posts, setPosts] = useState<DiscoverPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    discoverApi
      .getMine()
      .then((data) => {
        if (!cancelled) setPosts(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className='flex items-center justify-center rounded-3xl bg-white py-16 shadow-sm ring-1 ring-black/5'>
        <Loader2 className='h-6 w-6 animate-spin text-orange-500' />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className='rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5'>
        <TrendingUp className='mx-auto h-8 w-8 text-gray-300' />
        <p className='mt-3 text-sm text-gray-500'>
          Post to Discover to start seeing real performance data here.
        </p>
      </div>
    )
  }

  const totals = STAT_ICONS.reduce(
    (acc, stat) => {
      acc[stat.key] = posts.reduce((sum, post) => sum + post[stat.key], 0)
      return acc
    },
    {} as Record<(typeof STAT_ICONS)[number]['key'], number>,
  )

  const conversionRate = totals.view_count > 0 ? (totals.purchase_count / totals.view_count) * 100 : 0
  const ranked = [...posts].sort((a, b) => b.view_count - a.view_count)

  return (
    <div className='space-y-6'>
      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
          <TrendingUp className='h-5 w-5 text-orange-600' /> Discover performance
        </h2>
        <p className='mt-1 text-sm text-gray-500'>
          Real engagement totals across all {posts.length} of your Discover posts.
        </p>

        <div className='mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
          {STAT_ICONS.map((stat) => (
            <div key={stat.key} className='rounded-2xl border border-gray-100 bg-slate-50 p-4'>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <p className='mt-2 text-xl font-black text-slate-900'>{totals[stat.key]}</p>
              <p className='text-xs text-gray-500'>{stat.label}</p>
            </div>
          ))}
        </div>

        <p className='mt-4 text-xs text-gray-500'>
          {conversionRate > 0
            ? `${conversionRate.toFixed(2)}% of views led to a purchase across your posts -- a ratio, not a guarantee.`
            : 'No purchases from Discover views yet.'}
        </p>
      </div>

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <h2 className='text-lg font-bold text-slate-900'>What&apos;s working</h2>
        <p className='mt-1 text-sm text-gray-500'>Your own posts, ranked by real views.</p>

        <div className='mt-4 space-y-2'>
          {ranked.map((post, index) => (
            <div
              key={post.id}
              className='flex items-center gap-4 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3'
            >
              <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white'>
                {index + 1}
              </span>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-semibold text-slate-900'>
                  {post.caption || <span className='text-gray-400'>No caption</span>}
                </p>
                <p className='text-xs text-gray-500 capitalize'>{post.media_type} post</p>
              </div>
              <div className='flex shrink-0 items-center gap-3 text-xs font-medium text-gray-500'>
                <span className='inline-flex items-center gap-1'>
                  <Eye className='h-3.5 w-3.5' /> {post.view_count}
                </span>
                <span className='inline-flex items-center gap-1'>
                  <Heart className='h-3.5 w-3.5' /> {post.like_count}
                </span>
                <span className='inline-flex items-center gap-1 font-semibold text-emerald-700'>
                  {post.purchase_count} bought
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
