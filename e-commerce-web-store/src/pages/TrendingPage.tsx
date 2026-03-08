// ============================================
// Trending Page - TechTools E-Commerce Store
// ============================================

import { useState } from 'react'
import { TrendingUp, Sparkles } from 'lucide-react'
import {
  TrendingCollections,
  TrendingStores,
  TrendingFilters,
} from '../components/trending'

export default function TrendingPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Header */}
      <div className='relative bg-linear-to-r from-orange-500 via-orange-400 to-amber-500 overflow-hidden'>
        {/* Background Pattern */}
        <div className='absolute inset-0 opacity-10'>
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

        <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16'>
          <div className='flex items-center gap-4 mb-4'>
            <div className='p-3 bg-white/20 backdrop-blur-sm rounded-2xl'>
              <TrendingUp className='w-8 h-8 text-white' />
            </div>
            <div>
              <h1 className='text-3xl md:text-4xl font-black text-white'>
                Trending Now
              </h1>
              <p className='text-white/80 text-sm md:text-base mt-1'>
                Discover what's hot and popular
              </p>
            </div>
          </div>

          {/* Stats Pills */}
          <div className='flex flex-wrap gap-3 mt-6'>
            <div className='inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full'>
              <Sparkles className='w-4 h-4 text-white' />
              <span className='text-white text-sm font-medium'>
                Updated Daily
              </span>
            </div>
            <div className='inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full'>
              <span className='text-white text-sm font-medium'>
                1000+ Trending Items
              </span>
            </div>
            <div className='inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full'>
              <span className='text-white text-sm font-medium'>
                Top Rated Stores
              </span>
            </div>
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
