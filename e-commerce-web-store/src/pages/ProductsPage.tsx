// ============================================
// Product Listing Page - SHEIN/Amazon Style
// ============================================

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useParams, useLocation, Link } from 'react-router-dom'
import {
  Filter,
  SlidersHorizontal,
  Grid3X3,
  LayoutGrid,
  ChevronDown,
  X,
  Star,
  Check,
} from 'lucide-react'
import type { Product, Category, Brand, ProductFilters } from '../types'
import { productsApi, categoriesApi, brandsApi } from '../api'
import ProductCard from '../components/common/ProductCard'
import { cn, formatPrice } from '../utils'
import { useEventTracking } from '../hooks/useEventTracking'

type SortByValue = ProductFilters['sortBy']

const sortOptions: { value: SortByValue; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Top Rated' },
]

const priceRanges = [
  { min: 0, max: 25, label: 'Under €25' },
  { min: 25, max: 50, label: '€25 - €50' },
  { min: 50, max: 100, label: '€50 - €100' },
  { min: 100, max: 200, label: '€100 - €200' },
  { min: 200, max: Infinity, label: 'Over €200' },
]

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [totalProducts, setTotalProducts] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [gridView, setGridView] = useState<'grid' | 'large'>('grid')

  const { trackSearch, trackFilterApplied, trackCategoryView } =
    useEventTracking()

  // Determine if we're on a category or brand route
  const isCategoryRoute = location.pathname.startsWith('/category/')
  const isBrandRoute = location.pathname.startsWith('/brand/')

  // Get filters from URL - prioritize route params over search params
  const filters = useMemo(
    () => ({
      category:
        isCategoryRoute && slug ? slug : searchParams.get('category') || '',
      brand: isBrandRoute && slug ? slug : searchParams.get('brand') || '',
      minPrice: searchParams.get('minPrice')
        ? Number(searchParams.get('minPrice'))
        : undefined,
      maxPrice: searchParams.get('maxPrice')
        ? Number(searchParams.get('maxPrice'))
        : undefined,
      sortBy: (searchParams.get('sortBy') || 'newest') as SortByValue,
      search: searchParams.get('search') || '',
      inStock: searchParams.get('inStock') === 'true',
    }),
    [searchParams, slug, isCategoryRoute, isBrandRoute],
  )

  useEffect(() => {
    loadData()
  }, [])

  // Reset page when navigating to new category/brand
  useEffect(() => {
    setCurrentPage(1)
  }, [slug])

  useEffect(() => {
    loadProducts()
  }, [filters, currentPage])

  async function loadData() {
    try {
      const [categoriesData, brandsData] = await Promise.all([
        categoriesApi.getAll(),
        brandsApi.getAll(),
      ])
      setCategories(categoriesData)
      setBrands(brandsData)
    } catch (error) {
      console.error('Failed to load filter data:', error)
    }
  }

  async function loadProducts() {
    setLoading(true)
    try {
      const result = await productsApi.getAll({
        ...filters,
        page: currentPage,
        limit: 24,
      })
      setProducts(result.products)
      setTotalProducts(result.pagination?.total || result.products.length)

      // Track search event if there's a search query
      if (filters.search) {
        trackSearch(
          filters.search,
          result.products.length,
          filters.category || 'all',
        )
      }

      // Track category view if browsing a specific category
      if (filters.category && isCategoryRoute) {
        const category = categories.find((c) => c.slug === filters.category)
        if (category) {
          trackCategoryView(category.id, category.name, result.products.length)
        }
      }

      // Track filter applied events
      if (filters.minPrice || filters.maxPrice) {
        trackFilterApplied(
          'price',
          `${filters.minPrice || 0}-${filters.maxPrice || 'any'}`,
          result.products.length,
        )
      }
      if (filters.sortBy && filters.sortBy !== 'newest') {
        trackFilterApplied('sort', filters.sortBy, result.products.length)
      }
      if (filters.inStock) {
        trackFilterApplied('stock', 'in-stock', result.products.length)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateFilter = (
    key: string,
    value: string | number | boolean | undefined,
  ) => {
    const newParams = new URLSearchParams(searchParams)
    if (value === undefined || value === '' || value === false) {
      newParams.delete(key)
    } else {
      newParams.set(key, String(value))
    }
    setSearchParams(newParams)
    setCurrentPage(1)
  }

  const clearAllFilters = () => {
    setSearchParams({})
    setCurrentPage(1)
  }

  const activeFiltersCount = [
    // Don't count route-based category/brand as active filters (they're the main context)
    !isCategoryRoute && filters.category,
    !isBrandRoute && filters.brand,
    filters.minPrice,
    filters.inStock,
  ].filter(Boolean).length

  // Get current category or brand name for display
  const currentCategory =
    isCategoryRoute && slug ? categories.find((c) => c.slug === slug) : null
  const currentBrand =
    isBrandRoute && slug ? brands.find((b) => b.slug === slug) : null

  // Generate page title
  const getPageTitle = () => {
    if (filters.search) return `Results for "${filters.search}"`
    if (currentCategory) return currentCategory.name
    if (currentBrand) return currentBrand.name
    if (isCategoryRoute && slug)
      return slug
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ')
    if (isBrandRoute && slug)
      return slug
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ')
    return 'All Products'
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Breadcrumb */}
      <div className='bg-white border-b'>
        <div className='max-w-7xl mx-auto px-4 py-3'>
          <nav className='flex items-center gap-2 text-sm text-gray-500'>
            <Link to='/' className='hover:text-orange-500'>
              Home
            </Link>
            <span>/</span>
            {isCategoryRoute && (
              <>
                <Link to='/products' className='hover:text-orange-500'>
                  Products
                </Link>
                <span>/</span>
                <span className='text-gray-900'>
                  {currentCategory?.name || slug}
                </span>
              </>
            )}
            {isBrandRoute && (
              <>
                <Link to='/products' className='hover:text-orange-500'>
                  Products
                </Link>
                <span>/</span>
                <span className='text-gray-900'>
                  {currentBrand?.name || slug}
                </span>
              </>
            )}
            {!isCategoryRoute && !isBrandRoute && (
              <span className='text-gray-900'>All Products</span>
            )}
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className='bg-white border-b sticky top-16 z-30'>
        <div className='max-w-7xl mx-auto px-4 py-4'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            {/* Title & Count */}
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>
                {getPageTitle()}
              </h1>
              <p className='text-sm text-gray-500 mt-1'>
                {totalProducts} products found
              </p>
            </div>

            {/* Controls */}
            <div className='flex items-center gap-3'>
              {/* Filter Toggle (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className='lg:hidden flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50'
              >
                <Filter className='w-4 h-4' />
                Filters
                {activeFiltersCount > 0 && (
                  <span className='w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center'>
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Sort */}
              <div className='relative'>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                  className='appearance-none pl-4 pr-10 py-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent cursor-pointer'
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
              </div>

              {/* Grid View Toggle */}
              <div className='hidden sm:flex items-center border rounded-lg'>
                <button
                  onClick={() => setGridView('grid')}
                  className={cn(
                    'p-2 transition-colors',
                    gridView === 'grid'
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  <Grid3X3 className='w-4 h-4' />
                </button>
                <button
                  onClick={() => setGridView('large')}
                  className={cn(
                    'p-2 transition-colors',
                    gridView === 'large'
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  <LayoutGrid className='w-4 h-4' />
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          {activeFiltersCount > 0 && (
            <div className='flex flex-wrap items-center gap-2 mt-4'>
              {filters.category && (
                <span className='inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full'>
                  {categories.find((c) => c.slug === filters.category)?.name ||
                    filters.category}
                  <button
                    onClick={() => updateFilter('category', '')}
                    className='hover:text-orange-600'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </span>
              )}
              {filters.brand && (
                <span className='inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full'>
                  {brands.find((b) => b.slug === filters.brand)?.name ||
                    filters.brand}
                  <button
                    onClick={() => updateFilter('brand', '')}
                    className='hover:text-orange-600'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </span>
              )}
              {(filters.minPrice || filters.maxPrice) && (
                <span className='inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full'>
                  {formatPrice(filters.minPrice || 0)} -{' '}
                  {filters.maxPrice ? formatPrice(filters.maxPrice) : '∞'}
                  <button
                    onClick={() => {
                      updateFilter('minPrice', undefined)
                      updateFilter('maxPrice', undefined)
                    }}
                    className='hover:text-orange-600'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className='text-sm text-gray-500 hover:text-orange-500 underline'
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className='max-w-7xl mx-auto px-4 py-6'>
        <div className='flex gap-6'>
          {/* Sidebar Filters */}
          <aside
            className={cn(
              'fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-0 lg:w-64 shrink-0',
              showFilters ? 'block' : 'hidden lg:block',
            )}
          >
            {/* Mobile Overlay */}
            <div
              className='absolute inset-0 bg-black/50 lg:hidden'
              onClick={() => setShowFilters(false)}
            />

            {/* Filter Panel */}
            <div className='absolute right-0 lg:relative top-0 bottom-0 w-80 lg:w-full bg-white lg:bg-transparent overflow-y-auto lg:overflow-visible'>
              {/* Mobile Header */}
              <div className='lg:hidden flex items-center justify-between p-4 border-b bg-white sticky top-0'>
                <h2 className='font-semibold'>Filters</h2>
                <button onClick={() => setShowFilters(false)}>
                  <X className='w-5 h-5' />
                </button>
              </div>

              <div className='p-4 lg:p-0 space-y-6'>
                {/* Categories */}
                <div className='bg-white lg:rounded-xl lg:p-4 lg:shadow-sm'>
                  <h3 className='font-semibold text-gray-900 mb-3 flex items-center gap-2'>
                    <SlidersHorizontal className='w-4 h-4' />
                    Categories
                  </h3>
                  <div className='space-y-2'>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() =>
                          updateFilter(
                            'category',
                            category.slug === filters.category
                              ? ''
                              : category.slug,
                          )
                        }
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                          filters.category === category.slug
                            ? 'bg-orange-100 text-orange-700'
                            : 'hover:bg-gray-100',
                        )}
                      >
                        <span>{category.name}</span>
                        {filters.category === category.slug && (
                          <Check className='w-4 h-4' />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brands */}
                <div className='bg-white lg:rounded-xl lg:p-4 lg:shadow-sm'>
                  <h3 className='font-semibold text-gray-900 mb-3'>Brands</h3>
                  <div className='space-y-2 max-h-48 overflow-y-auto'>
                    {brands.map((brand) => (
                      <button
                        key={brand.id}
                        onClick={() =>
                          updateFilter(
                            'brand',
                            brand.slug === filters.brand ? '' : brand.slug,
                          )
                        }
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                          filters.brand === brand.slug
                            ? 'bg-orange-100 text-orange-700'
                            : 'hover:bg-gray-100',
                        )}
                      >
                        <span>{brand.name}</span>
                        {filters.brand === brand.slug && (
                          <Check className='w-4 h-4' />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div className='bg-white lg:rounded-xl lg:p-4 lg:shadow-sm'>
                  <h3 className='font-semibold text-gray-900 mb-3'>
                    Price Range
                  </h3>
                  <div className='space-y-2'>
                    {priceRanges.map((range, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (
                            filters.minPrice === range.min &&
                            filters.maxPrice === range.max
                          ) {
                            updateFilter('minPrice', undefined)
                            updateFilter('maxPrice', undefined)
                          } else {
                            updateFilter('minPrice', range.min)
                            updateFilter(
                              'maxPrice',
                              range.max === Infinity ? undefined : range.max,
                            )
                          }
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                          filters.minPrice === range.min
                            ? 'bg-orange-100 text-orange-700'
                            : 'hover:bg-gray-100',
                        )}
                      >
                        <span>{range.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div className='bg-white lg:rounded-xl lg:p-4 lg:shadow-sm'>
                  <h3 className='font-semibold text-gray-900 mb-3'>Rating</h3>
                  <div className='space-y-2'>
                    {[4, 3, 2, 1].map((rating) => (
                      <button
                        key={rating}
                        className='w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-100'
                      >
                        <div className='flex items-center gap-0.5'>
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'w-4 h-4',
                                i < rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300',
                              )}
                            />
                          ))}
                        </div>
                        <span className='text-gray-600'>& Up</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* In Stock */}
                <div className='bg-white lg:rounded-xl lg:p-4 lg:shadow-sm'>
                  <label className='flex items-center gap-3 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={filters.inStock}
                      onChange={(e) =>
                        updateFilter('inStock', e.target.checked)
                      }
                      className='w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500'
                    />
                    <span className='text-sm font-medium'>In Stock Only</span>
                  </label>
                </div>
              </div>

              {/* Mobile Apply Button */}
              <div className='lg:hidden sticky bottom-0 p-4 bg-white border-t'>
                <button
                  onClick={() => setShowFilters(false)}
                  className='w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600'
                >
                  View {totalProducts} Products
                </button>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <main className='flex-1 min-w-0'>
            {loading ? (
              <div
                className={cn(
                  'grid gap-4',
                  gridView === 'grid'
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                )}
              >
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className='bg-white rounded-xl h-72 animate-pulse'
                  />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className='text-center py-16'>
                <div className='w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center'>
                  <Filter className='w-12 h-12 text-gray-400' />
                </div>
                <h3 className='text-xl font-semibold text-gray-900 mb-2'>
                  No products found
                </h3>
                <p className='text-gray-500 mb-6'>
                  Try adjusting your filters or search criteria
                </p>
                <button
                  onClick={clearAllFilters}
                  className='px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600'
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    'grid gap-4',
                    gridView === 'grid'
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                  )}
                >
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variant={gridView === 'large' ? 'default' : 'compact'}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalProducts > 24 && (
                  <div className='flex items-center justify-center gap-2 mt-8'>
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className='px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Previous
                    </button>
                    {[...Array(Math.min(5, Math.ceil(totalProducts / 24)))].map(
                      (_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={cn(
                            'w-10 h-10 rounded-lg font-medium',
                            currentPage === i + 1
                              ? 'bg-orange-500 text-white'
                              : 'hover:bg-gray-100',
                          )}
                        >
                          {i + 1}
                        </button>
                      ),
                    )}
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalProducts / 24)}
                      className='px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
