import { ChevronDown, Filter, Grid3X3, LayoutGrid } from 'lucide-react'
import type { ProductFilters } from '../../types'
import { cn } from '../../utils'

type SortByValue = NonNullable<ProductFilters['sortBy']>
type Density = 'compact' | 'comfortable'

// No 'popular'/best-selling option -- the backend has no sales-ranking
// data to sort by yet (see the Phase 1 plan's explicit gap list). Offering
// a sort that silently does nothing is worse than not offering it.
const SORT_OPTIONS: { value: SortByValue; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
]

interface ProductToolbarProps {
  totalProducts: number
  sortBy: SortByValue
  onSortChange: (value: SortByValue) => void
  density: Density
  onDensityChange: (density: Density) => void
  activeFiltersCount: number
  onOpenMobileFilters: () => void
}

export function ProductToolbar({
  totalProducts,
  sortBy,
  onSortChange,
  density,
  onDensityChange,
  activeFiltersCount,
  onOpenMobileFilters,
}: ProductToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-gray-500 sm:inline">{totalProducts} products</span>

      <button
        type="button"
        onClick={onOpenMobileFilters}
        className="flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-50 lg:hidden"
      >
        <Filter className="h-4 w-4" />
        Filters
        {activeFiltersCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs text-white">
            {activeFiltersCount}
          </span>
        )}
      </button>

      <div className="relative">
        <label htmlFor="product-sort" className="sr-only">
          Sort by
        </label>
        <select
          id="product-sort"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortByValue)}
          className="cursor-pointer appearance-none rounded-lg border bg-white py-2 pl-4 pr-10 text-sm focus:border-transparent focus:ring-2 focus:ring-orange-500"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>

      <div className="hidden items-center rounded-lg border sm:flex" role="group" aria-label="Grid density">
        <button
          type="button"
          onClick={() => onDensityChange('compact')}
          aria-pressed={density === 'compact'}
          aria-label="Compact grid"
          className={cn('p-2 transition-colors', density === 'compact' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600')}
        >
          <Grid3X3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDensityChange('comfortable')}
          aria-pressed={density === 'comfortable'}
          aria-label="Comfortable grid"
          className={cn('p-2 transition-colors', density === 'comfortable' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600')}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
