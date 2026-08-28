import { Skeleton } from '../ui/Skeleton'
import { cn } from '../../utils'

interface ProductGridSkeletonProps {
  density: 'compact' | 'comfortable'
  count?: number
}

export function ProductGridSkeleton({ density, count = 12 }: ProductGridSkeletonProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        density === 'compact'
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
          : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      )}
    >
      {[...Array(count)].map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border bg-white">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
