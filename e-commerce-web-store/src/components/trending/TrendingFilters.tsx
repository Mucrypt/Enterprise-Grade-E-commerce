// ============================================
// Trending Filters Component
// ============================================

import { useState, useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { Category } from '../../types'
import { categoriesApi } from '../../api'
import { cn } from '../../utils'

interface TrendingFiltersProps {
  selectedCategory: string | null
  onCategoryChange: (slug: string | null) => void
  onFilterClick?: () => void
}

export default function TrendingFilters({
  selectedCategory,
  onCategoryChange,
  onFilterClick,
}: TrendingFiltersProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      const data = await categoriesApi.getAll()
      setCategories(data.filter((c) => c.is_active).slice(0, 8))
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide'>
          {/* All Chip */}
          <button
            onClick={() => onCategoryChange(null)}
            className={cn(
              'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all',
              selectedCategory === null
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            )}
          >
            All
          </button>

          {/* Category Chips */}
          {loading ? (
            <>
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className='shrink-0 h-9 w-24 bg-gray-100 rounded-full animate-pulse'
                />
              ))}
            </>
          ) : (
            categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.slug)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                  selectedCategory === category.slug
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                )}
              >
                {category.name}
              </button>
            ))
          )}

          {/* Filter Button */}
          {onFilterClick && (
            <button
              onClick={onFilterClick}
              className='shrink-0 ml-auto pl-4 border-l border-gray-200'
            >
              <div className='flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-orange-500 transition-colors'>
                <SlidersHorizontal className='w-5 h-5' />
                <span className='text-sm font-medium hidden md:inline'>
                  Filters
                </span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
