// ============================================
// Trending Page - TechTools E-Commerce Store
// ============================================
// The header stat pills below are real, derived numbers (total featured
// products, active brand count) -- not the old hardcoded "1000+ Trending
// Items" / "Updated Daily" claims, which weren't backed by anything.

import { useEffect, useState } from 'react'
import { TrendingUp, Sparkles, Store } from 'lucide-react'
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

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Header */}
      <div className='relative bg-linear-to-br from-gray-950 via-gray-900 to-orange-950 overflow-hidden'>
        {/* Background Pattern */}
        <div className='absolute inset-0 opacity-[0.07]'>
          <svg className='w-full h-full' xmlns='http://www.w3.org/2000/svg'>
            <defs>
              <pattern
                id='trending-pattern'
                x='0'
                y='0'
                width='40'
                height='40'
                patternUnits='userSpaceOnUse'
              >
                <circle cx='20' cy='20' r='1.5' fill='currentColor' />
              </pattern>
            </defs>
            <rect width='100%' height='100%' fill='url(#trending-pattern)' />
          </svg>
        </div>
        <div className='absolute -top-24 -right-24 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl' />
        <div className='absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl' />

        <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20'>
          <div className='flex items-center gap-4 mb-5'>
            <div className='p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10'>
              <TrendingUp className='w-8 h-8 text-orange-400' />
            </div>
            <span className='inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-orange-300 border border-white/10'>
              <Sparkles className='w-3.5 h-3.5' /> Live catalog data
            </span>
          </div>

          <h1 className='text-4xl md:text-6xl font-black text-white tracking-tight leading-none'>
            Trending Now
          </h1>
          <p className='text-gray-400 text-base md:text-lg mt-3 max-w-xl'>
            Real bestsellers, real stores, updated straight from what's
            actually selling.
          </p>

          {/* Stats Pills -- real, derived numbers only */}
          <div className='flex flex-wrap gap-3 mt-8'>
            {trendingProductCount !== null && trendingProductCount > 0 && (
              <div className='inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10'>
                <Sparkles className='w-4 h-4 text-orange-400' />
                <span className='text-white text-sm font-medium'>
                  {trendingProductCount}+ Trending Items
                </span>
              </div>
            )}
            {activeStoreCount !== null && activeStoreCount > 0 && (
              <div className='inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10'>
                <Store className='w-4 h-4 text-orange-400' />
                <span className='text-white text-sm font-medium'>
                  {activeStoreCount} Featured Stores
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

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
