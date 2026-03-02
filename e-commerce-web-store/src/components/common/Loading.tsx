// ============================================
// Loading Components
// ============================================

import { Loader2 } from 'lucide-react'
import { cn } from '../../utils'

// Full page spinner
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <Loader2 className='w-8 h-8 text-orange-500 animate-spin' />
    </div>
  )
}

// Full page loader
export function PageLoader() {
  return (
    <div className='min-h-[60vh] flex items-center justify-center'>
      <div className='text-center'>
        <Loader2 className='w-12 h-12 text-orange-500 animate-spin mx-auto' />
        <p className='mt-4 text-gray-500'>Loading...</p>
      </div>
    </div>
  )
}

// Product card skeleton
export function ProductCardSkeleton() {
  return (
    <div className='bg-white rounded-xl overflow-hidden animate-pulse'>
      <div className='aspect-square bg-gray-200' />
      <div className='p-4 space-y-3'>
        <div className='h-3 bg-gray-200 rounded w-1/3' />
        <div className='h-4 bg-gray-200 rounded w-full' />
        <div className='h-4 bg-gray-200 rounded w-2/3' />
        <div className='h-3 bg-gray-200 rounded w-1/4 mt-4' />
        <div className='h-6 bg-gray-200 rounded w-1/3' />
      </div>
    </div>
  )
}

// Product grid skeleton
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6'>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Category skeleton
export function CategorySkeleton() {
  return (
    <div className='flex flex-col items-center animate-pulse'>
      <div className='w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-200' />
      <div className='h-4 bg-gray-200 rounded w-20 mt-3' />
    </div>
  )
}

// Hero skeleton
export function HeroSkeleton() {
  return (
    <div className='relative h-125 lg:h-150 bg-gray-200 animate-pulse'>
      <div className='absolute inset-0 flex items-center'>
        <div className='container mx-auto px-4'>
          <div className='max-w-xl space-y-4'>
            <div className='h-6 bg-gray-300 rounded w-32' />
            <div className='h-12 bg-gray-300 rounded w-full' />
            <div className='h-12 bg-gray-300 rounded w-3/4' />
            <div className='h-6 bg-gray-300 rounded w-2/3' />
            <div className='h-12 bg-gray-300 rounded w-40 mt-6' />
          </div>
        </div>
      </div>
    </div>
  )
}
