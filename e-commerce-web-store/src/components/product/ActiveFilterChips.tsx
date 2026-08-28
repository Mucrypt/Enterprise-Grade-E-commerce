import { X } from 'lucide-react'
import type { Category, Brand } from '../../types'
import { formatPrice } from '../../utils'

export interface ActiveFilters {
  category?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  minRating?: number
}

interface ActiveFilterChipsProps {
  filters: ActiveFilters
  categories: Category[]
  brands: Brand[]
  /** Route-based category/brand (e.g. /category/:slug) aren't removable chips -- they're the page context. */
  hideCategoryChip?: boolean
  hideBrandChip?: boolean
  onRemove: (key: 'category' | 'brand' | 'price' | 'rating') => void
  onClearAll: () => void
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
      {children}
      <button type="button" onClick={onRemove} aria-label="Remove filter" className="hover:text-orange-600">
        <X className="h-4 w-4" />
      </button>
    </span>
  )
}

export function ActiveFilterChips({
  filters,
  categories,
  brands,
  hideCategoryChip,
  hideBrandChip,
  onRemove,
  onClearAll,
}: ActiveFilterChipsProps) {
  const hasAny =
    (filters.category && !hideCategoryChip) ||
    (filters.brand && !hideBrandChip) ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minRating

  if (!hasAny) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {filters.category && !hideCategoryChip && (
        <Chip onRemove={() => onRemove('category')}>
          {categories.find((c) => c.slug === filters.category)?.name || filters.category}
        </Chip>
      )}
      {filters.brand && !hideBrandChip && (
        <Chip onRemove={() => onRemove('brand')}>
          {brands.find((b) => b.slug === filters.brand)?.name || filters.brand}
        </Chip>
      )}
      {(filters.minPrice || filters.maxPrice) && (
        <Chip onRemove={() => onRemove('price')}>
          {formatPrice(filters.minPrice || 0)} - {filters.maxPrice ? formatPrice(filters.maxPrice) : '∞'}
        </Chip>
      )}
      {filters.minRating && (
        <Chip onRemove={() => onRemove('rating')}>{filters.minRating}★ &amp; Up</Chip>
      )}
      <button type="button" onClick={onClearAll} className="text-sm text-gray-500 underline hover:text-orange-500">
        Clear all
      </button>
    </div>
  )
}
