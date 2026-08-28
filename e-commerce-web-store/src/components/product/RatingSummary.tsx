import { StarRating } from '../ui/StarRating'

interface RatingSummaryProps {
  averageRating?: number | string
  reviewCount?: number | string
  unitsSold?: number | string
}

export function RatingSummary({ averageRating, reviewCount, unitsSold }: RatingSummaryProps) {
  const rating = typeof averageRating === 'string' ? parseFloat(averageRating) : averageRating
  const count = typeof reviewCount === 'string' ? parseInt(reviewCount, 10) : reviewCount
  const sold = typeof unitsSold === 'string' ? parseInt(unitsSold, 10) : unitsSold

  // Never render a fake "4.5 / 5 (128 reviews)" -- only when the API
  // actually returned a real rating backed by at least one review. Same
  // gate already established in components/home/ToolProductCard.tsx.
  const hasRealRating = !!rating && !!count && count > 0
  const hasRealSales = !!sold && sold > 0

  if (!hasRealRating && !hasRealSales) return null

  return (
    <div className='flex flex-wrap items-center gap-4'>
      {hasRealRating && (
        <>
          <StarRating rating={rating!} />
          <span className='text-sm text-gray-500'>
            {rating!.toFixed(1)} / 5 ({count} review{count === 1 ? '' : 's'})
          </span>
        </>
      )}
      {hasRealRating && hasRealSales && <span className='text-sm text-gray-400'>|</span>}
      {hasRealSales && <span className='text-sm text-green-600'>{sold} sold</span>}
    </div>
  )
}
