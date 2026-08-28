import { Star } from 'lucide-react'
import { cn } from '../../utils'

export function StarRating({
  rating,
  size = 'md',
  className,
}: {
  rating: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
  const rounded = Math.round(rating)

  return (
    <div className={cn('flex items-center gap-0.5', className)} role='img' aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={cn(sizeClass, i < rounded ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')}
          aria-hidden='true'
        />
      ))}
    </div>
  )
}
