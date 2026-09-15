// ============================================
// Trending Page - TechTools E-Commerce Store
// ============================================
// The hero is the exact same admin-managed carousel as the homepage
// (Settings > Hero Slides, 'trending' placement) -- ToolsHero, not a
// bespoke banner. The stat strip beneath it is real, derived numbers
// (total featured products, active brand count), not a hardcoded claim.

import { useEffect, useState } from 'react'
import { Sparkles, Store } from 'lucide-react'
import { ToolsHero } from '../components/home'
import {
  TrendingCollections,
  TrendingStores,
  TrendingFilters,
} from '../components/trending'
import { productsApi, brandsApi } from '../api'

export default function TrendingPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [trendingProductCount, setTrendingProductCount] = useState<number | null>(null)
  const [activeStoreCount, setActiveStoreCount] = useState<number | null>(null)

  useEffect(() => {
    productsApi
      .getAll({ featured: true, limit: 1 })
      .then((res) => setTrendingProductCount(res.pagination?.total ?? null))
      .catch(() => setTrendingProductCount(null))

    brandsApi
      .getAll()
      .then((brands) => setActiveStoreCount(brands.filter((b) => b.is_active).length))
      .catch(() => setActiveStoreCount(null))
  }, [])

  const hasStats =
    (trendingProductCount !== null && trendingProductCount > 0) ||
    (activeStoreCount !== null && activeStoreCount > 0)

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero -- admin-managed, same CMS as the homepage */}
      <ToolsHero placement='trending' />

      {/* Stat strip -- real, derived numbers only */}
      {hasStats && (
        <div className='bg-gray-950 py-3'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap justify-center gap-3'>
            {trendingProductCount !== null && trendingProductCount > 0 && (
              <div className='inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/10'>
                <Sparkles className='w-3.5 h-3.5 text-orange-400' />
                <span className='text-white text-xs font-medium'>
                  {trendingProductCount}+ Trending Items
                </span>
              </div>
            )}
            {activeStoreCount !== null && activeStoreCount > 0 && (
              <div className='inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/10'>
                <Store className='w-3.5 h-3.5 text-orange-400' />
                <span className='text-white text-xs font-medium'>
                  {activeStoreCount} Featured Stores
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Filters */}
      <TrendingFilters
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* Trending Collections */}
      <TrendingCollections />

      {/* Featured Stores */}
      <TrendingStores categoryFilter={selectedCategory} />

      {/* Bottom CTA Section */}
      <section className='py-16 bg-linear-to-r from-gray-900 to-gray-800'>
        <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
          <h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>
            Want to Become a Featured Store?
          </h2>
          <p className='text-gray-400 mb-8'>
            Join our marketplace and reach millions of customers looking for
            quality products.
          </p>
          <div className='flex flex-col sm:flex-row justify-center gap-4'>
            <a
              href='/contact'
              className='inline-flex items-center justify-center px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full transition-colors'
            >
              Become a Seller
            </a>
            <a
              href='/about'
              className='inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition-colors'
            >
              Learn More
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
