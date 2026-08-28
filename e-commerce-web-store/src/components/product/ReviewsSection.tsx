import { useEffect, useState } from 'react'
import { ThumbsUp, BadgeCheck } from 'lucide-react'
import { reviewsApi } from '../../api'
import type { Review, ReviewSummary } from '../../types'
import { formatDate } from '../../utils'
import { StarRating } from '../ui/StarRating'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

interface ReviewsSectionProps {
  productId: string
}

const STAR_LEVELS = [5, 4, 3, 2, 1] as const

function summaryCountFor(summary: ReviewSummary, stars: number): number {
  const key = `rating_${stars}_count` as keyof ReviewSummary
  return Number(summary[key] || 0)
}

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    reviewsApi
      .getByProduct(productId, page, 10)
      .then((data) => {
        if (cancelled) return
        setReviews((prev) => (page === 1 ? data.reviews : [...prev, ...data.reviews]))
        setSummary(data.summary)
        setHasMore(data.pagination.page < data.pagination.totalPages)
      })
      .catch(() => {
        if (!cancelled) {
          setReviews([])
          setSummary(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId, page])

  if (loading && page === 1) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    )
  }

  if (!summary || summary.total_reviews === 0) {
    return <EmptyState title='No reviews yet' description='Be the first to review this product.' />
  }

  return (
    <div className='space-y-6'>
      <div className='rounded-xl bg-white p-6 shadow-sm'>
        <div className='flex flex-col gap-6 md:flex-row md:items-center'>
          <div className='text-center'>
            <div className='text-5xl font-bold text-gray-900'>{summary.average_rating.toFixed(1)}</div>
            <StarRating rating={summary.average_rating} className='mt-2 justify-center' />
            <p className='mt-1 text-sm text-gray-500'>
              Based on {summary.total_reviews} review{summary.total_reviews === 1 ? '' : 's'}
            </p>
          </div>
          <div className='flex-1 space-y-2'>
            {STAR_LEVELS.map((stars) => {
              const count = summaryCountFor(summary, stars)
              const percent = summary.total_reviews > 0 ? Math.round((count / summary.total_reviews) * 100) : 0
              return (
                <div key={stars} className='flex items-center gap-3'>
                  <span className='w-6 text-sm text-gray-500'>{stars}★</span>
                  <div className='h-2 flex-1 overflow-hidden rounded-full bg-gray-200'>
                    <div className='h-full rounded-full bg-yellow-400' style={{ width: `${percent}%` }} />
                  </div>
                  <span className='w-10 text-sm text-gray-500'>{percent}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {reviews.map((review) => (
        <div key={review.id} className='rounded-xl bg-white p-6 shadow-sm'>
          <div className='flex items-start gap-4'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-600'>
              {(review.user_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className='flex-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium'>{review.user_name || 'Anonymous'}</span>
                {review.is_verified_purchase && (
                  <span className='flex items-center gap-1 text-xs font-medium text-green-600'>
                    <BadgeCheck className='h-3.5 w-3.5' /> Verified purchase
                  </span>
                )}
                <span className='text-sm text-gray-500'>• {formatDate(review.created_at)}</span>
              </div>
              <StarRating rating={review.rating} size='sm' className='mt-1' />
              {review.title && <p className='mt-2 font-medium text-gray-900'>{review.title}</p>}
              {review.comment && <p className='mt-1 text-gray-700'>{review.comment}</p>}
              {review.images.length > 0 && (
                <div className='mt-3 flex gap-2'>
                  {review.images.map((img) => (
                    <img
                      key={img.id}
                      src={img.image_url}
                      alt='Customer review'
                      className='h-16 w-16 rounded-lg object-cover'
                    />
                  ))}
                </div>
              )}
              {review.admin_response && (
                <div className='mt-3 rounded-lg bg-gray-50 p-3 text-sm'>
                  <span className='font-medium text-gray-900'>Response from TechTools: </span>
                  {review.admin_response}
                </div>
              )}
              {review.helpful_count > 0 && (
                <div className='mt-4 flex items-center gap-1 text-sm text-gray-500'>
                  <ThumbsUp className='h-4 w-4' /> Helpful ({review.helpful_count})
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          type='button'
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
          className='mx-auto block rounded-lg border px-6 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
        >
          {loading ? 'Loading…' : 'Show more reviews'}
        </button>
      )}
    </div>
  )
}
