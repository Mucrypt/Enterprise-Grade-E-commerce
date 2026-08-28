// ============================================
// Product Listing Page
// ============================================

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useParams, useLocation, Link } from 'react-router-dom'
import { Filter } from 'lucide-react'
import type { Product, Category, Brand, ProductFilters, ProductCollection } from '../types'
import { productsApi, categoriesApi, brandsApi, collectionsApi } from '../api'
import ProductCard from '../components/common/ProductCard'
import { ProductToolbar } from '../components/product/ProductToolbar'
import { FilterSidebar } from '../components/product/FilterSidebar'
import { ActiveFilterChips } from '../components/product/ActiveFilterChips'
import { ProductGridSkeleton } from '../components/product/ProductGridSkeleton'
import { CategoryIntro } from '../components/product/CategoryIntro'
import { QuickView } from '../components/product/QuickView'
import { EmptyState } from '../components/ui/EmptyState'
import { cn } from '../utils'
import { useEventTracking } from '../hooks/useEventTracking'

type SortByValue = NonNullable<ProductFilters['sortBy']>
type Density = 'compact' | 'comfortable'

const PAGE_SIZE = 24

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [totalProducts, setTotalProducts] = useState(0)
  const [activeCollection, setActiveCollection] = useState<ProductCollection | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [density, setDensity] = useState<Density>('compact')
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)

  const { trackSearch, trackFilterApplied, trackCategoryView } = useEventTracking()

  const isCategoryRoute = location.pathname.startsWith('/category/')
  const isBrandRoute = location.pathname.startsWith('/brand/')

  const filters = useMemo(
    () => ({
      category: isCategoryRoute && slug ? slug : searchParams.get('category') || '',
      brand: isBrandRoute && slug ? slug : searchParams.get('brand') || '',
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      minRating: searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined,
      sortBy: (searchParams.get('sortBy') || 'newest') as SortByValue,
      search: searchParams.get('search') || '',
      inStock: searchParams.get('inStock') === 'true',
      collection: searchParams.get('collection') || '',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage])

  async function loadData() {
    try {
      const [categoriesData, brandsData] = await Promise.all([categoriesApi.getAll(), brandsApi.getAll()])
      setCategories(categoriesData)
      setBrands(brandsData)
    } catch (error) {
      console.error('Failed to load filter data:', error)
    }
  }

  async function loadProducts() {
    setLoading(true)
    try {
      if (filters.collection) {
        const collection = await collectionsApi.getBySlug(filters.collection)
        const collectionProducts = collection.products || []

        setActiveCollection(collection)
        setProducts(collectionProducts)
        setTotalProducts(collectionProducts.length)
        return
      }

      setActiveCollection(null)
      const result = await productsApi.getAll({
        ...filters,
        page: currentPage,
        limit: PAGE_SIZE,
      })
      setProducts(result.products)
      setTotalProducts(result.pagination?.total || result.products.length)

      if (filters.search) {
        trackSearch(filters.search, result.products.length, filters.category || 'all')
      }

      if (filters.category && isCategoryRoute) {
        const category = categories.find((c) => c.slug === filters.category)
        if (category) {
          trackCategoryView(category.id, category.name, result.products.length)
        }
      }

      if (filters.minPrice || filters.maxPrice) {
        trackFilterApplied('price', `${filters.minPrice || 0}-${filters.maxPrice || 'any'}`, result.products.length)
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

  const updateFilter = (key: string, value: string | number | boolean | undefined) => {
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
    setActiveCollection(null)
  }

  const removeFilter = (key: 'category' | 'brand' | 'price' | 'rating') => {
    if (key === 'price') {
      updateFilter('minPrice', undefined)
      updateFilter('maxPrice', undefined)
    } else if (key === 'rating') {
      updateFilter('minRating', undefined)
    } else {
      updateFilter(key, undefined)
    }
  }

  const activeFiltersCount = [
    // Don't count route-based category/brand as active filters (they're the main context)
    !isCategoryRoute && filters.category,
    !isBrandRoute && filters.brand,
    filters.minPrice,
    filters.minRating,
    filters.inStock,
    filters.collection,
  ].filter(Boolean).length

  const currentCategory = isCategoryRoute && slug ? categories.find((c) => c.slug === slug) : null
  const currentBrand = isBrandRoute && slug ? brands.find((b) => b.slug === slug) : null

  const getPageTitle = () => {
    if (filters.search) return `Results for "${filters.search}"`
    if (activeCollection) return activeCollection.name
    if (currentCategory) return currentCategory.name
    if (currentBrand) return currentBrand.name
    if (isCategoryRoute && slug) return slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    if (isBrandRoute && slug) return slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    return 'All Products'
  }

  const totalPages = Math.ceil(totalProducts / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/" className="hover:text-orange-500">
              Home
            </Link>
            <span>/</span>
            {isCategoryRoute && (
              <>
                <Link to="/products" className="hover:text-orange-500">
                  Products
                </Link>
                <span>/</span>
                <span className="text-gray-900">{currentCategory?.name || slug}</span>
              </>
            )}
            {isBrandRoute && (
              <>
                <Link to="/products" className="hover:text-orange-500">
                  Products
                </Link>
                <span>/</span>
                <span className="text-gray-900">{currentBrand?.name || slug}</span>
              </>
            )}
            {!isCategoryRoute && !isBrandRoute && (
              <span className="text-gray-900">{activeCollection?.name || 'All Products'}</span>
            )}
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="sticky top-16 z-30 border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
              <p className="mt-1 text-sm text-gray-500 sm:hidden">{totalProducts} products found</p>
            </div>

            <ProductToolbar
              totalProducts={totalProducts}
              sortBy={filters.sortBy}
              onSortChange={(value) => updateFilter('sortBy', value)}
              density={density}
              onDensityChange={setDensity}
              activeFiltersCount={activeFiltersCount}
              onOpenMobileFilters={() => setShowFilters(true)}
            />
          </div>

          {isCategoryRoute && currentCategory && <div className="mt-4"><CategoryIntro category={currentCategory} /></div>}

          <ActiveFilterChips
            filters={filters}
            categories={categories}
            brands={brands}
            hideCategoryChip={isCategoryRoute}
            hideBrandChip={isBrandRoute}
            onRemove={removeFilter}
            onClearAll={clearAllFilters}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          <FilterSidebar
            categories={categories}
            brands={brands}
            filters={filters}
            onUpdateFilter={updateFilter}
            totalProducts={totalProducts}
            mobileOpen={showFilters}
            onCloseMobile={() => setShowFilters(false)}
            hideCategorySection={isCategoryRoute}
            hideBrandSection={isBrandRoute}
          />

          <main className="min-w-0 flex-1">
            {loading ? (
              <ProductGridSkeleton density={density} />
            ) : products.length === 0 ? (
              <EmptyState
                icon={Filter}
                title="No products found"
                description="Try adjusting your filters or search criteria."
                className="py-16"
              />
            ) : (
              <>
                <div
                  className={cn(
                    'grid gap-4',
                    density === 'compact'
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                      : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                  )}
                >
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variant={density === 'comfortable' ? 'default' : 'compact'}
                      onQuickView={setQuickViewProduct}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      // Centers the visible page-number window around the
                      // current page instead of always showing pages 1-5 --
                      // pages 6+ were previously unreachable except by
                      // clicking Next repeatedly.
                      const windowStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
                      const pageNum = windowStart + i
                      if (pageNum > totalPages) return null
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          aria-current={currentPage === pageNum ? 'page' : undefined}
                          className={cn(
                            'h-10 w-10 rounded-lg font-medium',
                            currentPage === pageNum ? 'bg-orange-500 text-white' : 'hover:bg-gray-100',
                          )}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      className="rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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

      {quickViewProduct && <QuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />}
    </div>
  )
}
