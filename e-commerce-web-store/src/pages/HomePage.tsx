// ============================================
// Home Page - TechTools E-Commerce Store
// ============================================

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Store } from 'lucide-react'

import {
  HeroSection,
  FlashDealsSection,
  CategoryGridSection,
  FeaturedProductsSection,
  BooksShowcaseSection,
  BrandShowcase,
  PromoBanners,
  NewsletterSection,
} from '../components/home'

export default function HomePage() {
  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string }
      }
    ).connection

    if (connection?.saveData) return
    if (connection?.effectiveType && /2g/i.test(connection.effectiveType))
      return

    // Prefetch highest-intent next routes after first content settles.
    const timer = window.setTimeout(() => {
      void import('./ProductsPage')
      void import('./BooksPage')
      void import('./CartPage')
      void import('./LoginPage')
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Hero Slider with Features Bar */}
      <HeroSection />

      {/* Quick Access - Books and Seller tools */}
      <section className='bg-white'>
        <div className='container mx-auto px-4 py-6'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Link
              to='/books'
              className='group rounded-3xl bg-linear-to-br from-slate-950 via-slate-900 to-orange-700 p-5 text-white shadow-sm transition hover:shadow-lg'
            >
              <div className='flex items-center justify-between gap-4'>
                <div className='flex items-start gap-3'>
                  <span className='inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15'>
                    <BookOpen className='h-5 w-5' />
                  </span>
                  <div>
                    <p className='text-lg font-bold'>Books Library</p>
                    <p className='mt-1 text-sm text-orange-100/90'>
                      Discover curated digital books and creator releases.
                    </p>
                  </div>
                </div>
                <span className='text-sm font-semibold text-orange-100 transition group-hover:text-white'>
                  Open
                </span>
              </div>
            </Link>

            <Link
              to='/seller-hub'
              className='group rounded-3xl border border-orange-100 bg-orange-50 p-5 text-slate-900 shadow-sm transition hover:shadow-lg'
            >
              <div className='flex items-center justify-between gap-4'>
                <div className='flex items-start gap-3'>
                  <span className='inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100'>
                    <Store className='h-5 w-5 text-orange-600' />
                  </span>
                  <div>
                    <p className='text-lg font-bold'>Seller Hub</p>
                    <p className='mt-1 text-sm text-slate-600'>
                      Switch to business mode and manage trust tiers.
                    </p>
                  </div>
                </div>
                <span className='text-sm font-semibold text-orange-600 transition group-hover:text-orange-700'>
                  Open
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Flash Deals - Time-limited Offers */}
      <FlashDealsSection />

      {/* Shop by Category */}
      <CategoryGridSection />

      {/* Promotional Banners */}
      <PromoBanners />

      {/* Featured/Popular Products */}
      <FeaturedProductsSection />

      {/* Books Marketplace Spotlight */}
      <BooksShowcaseSection />

      {/* Top Brands */}
      <BrandShowcase />

      {/* Newsletter Signup */}
      <NewsletterSection />
    </>
  )
}
