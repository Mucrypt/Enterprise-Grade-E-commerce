// ============================================
// Home Page - TechTools E-Commerce Store
// ============================================

import { useEffect } from 'react'

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
    if (connection?.effectiveType && /2g/i.test(connection.effectiveType)) return

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
