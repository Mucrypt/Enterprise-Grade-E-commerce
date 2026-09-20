import { useEffect, useState } from 'react'
import { Clock3, ListTodo, Loader2 } from 'lucide-react'
import { creatorApi } from '../../api'
import type { CreatorActivityItem } from '../../types'

export default function ActivityTab() {
  const [items, setItems] = useState<CreatorActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    creatorApi
      .getDashboardActivity()
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setHasMore(result.pagination?.hasMore ?? false)
        setNextCursor(result.pagination?.nextCursor ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLoadMore = async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const result = await creatorApi.getDashboardActivity(10, nextCursor)
      setItems((current) => {
        const existingIds = new Set(current.map((item) => item.id))
        return [...current, ...result.items.filter((item) => !existingIds.has(item.id))]
      })
      setHasMore(result.pagination?.hasMore ?? false)
      setNextCursor(result.pagination?.nextCursor ?? null)
    } finally {
      setIsLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center rounded-3xl bg-white py-16 shadow-sm ring-1 ring-black/5'>
        <Loader2 className='h-6 w-6 animate-spin text-orange-500' />
      </div>
    )
  }

  return (
    <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
      <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
        <ListTodo className='h-5 w-5 text-blue-600' /> Recent activity
      </h2>
      <p className='mt-1 text-sm text-gray-500'>Live backend events for drafts, submissions, and sales.</p>

      <div className='mt-5 space-y-3'>
        {items.length > 0 ? (
          items.map((item) => {
            const timeLabel = item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'Just now'
            return (
              <div key={item.id} className='flex gap-4 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-4'>
                <div className='mt-1 h-3 w-3 rounded-full bg-orange-500' />
                <div className='flex-1'>
                  <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                    <p className='font-semibold text-slate-900'>{item.title}</p>
                    <span className='inline-flex items-center gap-1 text-xs font-medium text-gray-500'>
                      <Clock3 className='h-3.5 w-3.5' /> {timeLabel}
                    </span>
                  </div>
                  <p className='mt-1 text-sm leading-6 text-gray-600'>{item.description}</p>
                </div>
              </div>
            )
          })
        ) : (
          <div className='rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500'>
            Recent creator activity will appear here once you create drafts, submit books, or start
            making sales.
          </div>
        )}
      </div>

      {hasMore ? (
        <div className='mt-5'>
          <button
            type='button'
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isLoadingMore ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' /> Loading more
              </>
            ) : (
              'Load more activity'
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}
