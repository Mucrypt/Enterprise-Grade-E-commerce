import { useEffect, useState } from 'react'
import { Check, Star, X } from 'lucide-react'
import type { Category, Brand, CategoryAttribute } from '../../types'
import { categoriesApi } from '../../api'
import { cn } from '../../utils'
import { AccordionItem } from '../ui/Accordion'

const PRICE_RANGES = [
  { min: 0, max: 25, label: 'Under €25' },
  { min: 25, max: 50, label: '€25 - €50' },
  { min: 50, max: 100, label: '€50 - €100' },
  { min: 100, max: 200, label: '€100 - €200' },
  { min: 200, max: undefined, label: 'Over €200' },
]

const RATING_OPTIONS = [4, 3, 2, 1]

interface SidebarFilters {
  category?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  inStock?: boolean
}

interface FilterSidebarProps {
  categories: Category[]
  brands: Brand[]
  filters: SidebarFilters
  onUpdateFilter: (key: string, value: string | number | boolean | undefined) => void
  totalProducts: number
  mobileOpen: boolean
  onCloseMobile: () => void
  /** Route-based category/brand (e.g. /category/:slug) shouldn't be re-selectable in the sidebar -- they ARE the page. */
  hideCategorySection?: boolean
  hideBrandSection?: boolean
  /** The single category currently scoping the grid, if any -- drives which structured attribute filters (Voltage, Material...) are shown. */
  activeCategoryId?: string
  selectedAttributes?: Record<string, string>
  onUpdateAttributeFilter?: (name: string, value: string | undefined) => void
}

export function FilterSidebar({
  categories,
  brands,
  filters,
  onUpdateFilter,
  totalProducts,
  mobileOpen,
  onCloseMobile,
  hideCategorySection,
  hideBrandSection,
  activeCategoryId,
  selectedAttributes = {},
  onUpdateAttributeFilter,
}: FilterSidebarProps) {
  const toggleRating = (rating: number) => {
    onUpdateFilter('minRating', filters.minRating === rating ? undefined : rating)
  }

  // Structured, category-specific attribute definitions -- only fetched
  // when a single category is actually scoping the grid, and only
  // 'select'-type ones get filter checkboxes (their `options` array is
  // the real, admin-defined controlled vocabulary).
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([])
  useEffect(() => {
    if (!activeCategoryId) return
    let cancelled = false
    categoriesApi
      .getAttributes(activeCategoryId)
      .then((attrs) => {
        if (!cancelled) setCategoryAttributes(attrs)
      })
      .catch(() => {
        if (!cancelled) setCategoryAttributes([])
      })
    return () => {
      cancelled = true
    }
  }, [activeCategoryId])
  // Gated on activeCategoryId so a stale previous category's attributes
  // never leak into view while the next fetch is in flight or absent.
  const filterableAttributes = activeCategoryId
    ? categoryAttributes.filter(
        (attr) => attr.is_filterable && attr.input_type === 'select' && (attr.options?.length || 0) > 0,
      )
    : []

  return (
    <aside
      className={cn(
        'fixed inset-0 z-40 lg:relative lg:inset-auto lg:z-0 lg:w-64 lg:shrink-0',
        mobileOpen ? 'block' : 'hidden lg:block',
      )}
    >
      <div className="absolute inset-0 bg-black/50 lg:hidden" onClick={onCloseMobile} aria-hidden="true" />

      <div className="absolute bottom-0 right-0 top-0 flex w-80 flex-col overflow-y-auto bg-white lg:relative lg:w-full lg:overflow-visible lg:bg-transparent">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4 lg:hidden">
          <h2 className="font-semibold">Filters</h2>
          <button type="button" onClick={onCloseMobile} aria-label="Close filters">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 p-4 lg:space-y-4 lg:p-0">
          <div className="rounded-xl border bg-white lg:shadow-sm">
            {!hideCategorySection && (
              <div className="px-4">
                <AccordionItem title="Category" defaultOpen>
                  <div className="space-y-1">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() =>
                          onUpdateFilter('category', category.slug === filters.category ? '' : category.slug)
                        }
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          filters.category === category.slug ? 'bg-orange-100 text-orange-700' : 'hover:bg-gray-100',
                        )}
                      >
                        <span>{category.name}</span>
                        {filters.category === category.slug && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </AccordionItem>
              </div>
            )}

            {!hideBrandSection && (
              <div className="px-4">
                <AccordionItem title="Brand" defaultOpen>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {brands.map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => onUpdateFilter('brand', brand.slug === filters.brand ? '' : brand.slug)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          filters.brand === brand.slug ? 'bg-orange-100 text-orange-700' : 'hover:bg-gray-100',
                        )}
                      >
                        <span>{brand.name}</span>
                        {filters.brand === brand.slug && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </AccordionItem>
              </div>
            )}

            <div className="px-4">
              <AccordionItem title="Price" defaultOpen>
                <div className="space-y-1">
                  {PRICE_RANGES.map((range) => {
                    const selected = filters.minPrice === range.min && filters.maxPrice === range.max
                    return (
                      <button
                        key={range.label}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            onUpdateFilter('minPrice', undefined)
                            onUpdateFilter('maxPrice', undefined)
                          } else {
                            onUpdateFilter('minPrice', range.min)
                            onUpdateFilter('maxPrice', range.max)
                          }
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          selected ? 'bg-orange-100 text-orange-700' : 'hover:bg-gray-100',
                        )}
                      >
                        <span>{range.label}</span>
                        {selected && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </AccordionItem>
            </div>

            {filterableAttributes.map((attr) => (
              <div className="px-4" key={attr.id}>
                <AccordionItem title={attr.unit ? `${attr.name} (${attr.unit})` : attr.name}>
                  <div className="space-y-1">
                    {(attr.options || []).map((option) => {
                      const selected = selectedAttributes[attr.name] === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            onUpdateAttributeFilter?.(attr.name, selected ? undefined : option)
                          }
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                            selected ? 'bg-orange-100 text-orange-700' : 'hover:bg-gray-100',
                          )}
                        >
                          <span>{option}</span>
                          {selected && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </AccordionItem>
              </div>
            ))}

            <div className="px-4">
              <AccordionItem title="Rating">
                <div className="space-y-1">
                  {RATING_OPTIONS.map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => toggleRating(rating)}
                      aria-pressed={filters.minRating === rating}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        filters.minRating === rating ? 'bg-orange-100 text-orange-700' : 'hover:bg-gray-100',
                      )}
                    >
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn('h-4 w-4', i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300')}
                          />
                        ))}
                      </div>
                      <span>&amp; Up</span>
                    </button>
                  ))}
                </div>
              </AccordionItem>
            </div>

            <div className="px-4 py-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={filters.inStock || false}
                  onChange={(e) => onUpdateFilter('inStock', e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-medium">In Stock Only</span>
              </label>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t bg-white p-4 lg:hidden">
          <button
            type="button"
            onClick={onCloseMobile}
            className="w-full rounded-lg bg-orange-500 py-3 font-semibold text-white hover:bg-orange-600"
          >
            View {totalProducts} Products
          </button>
        </div>
      </div>
    </aside>
  )
}
