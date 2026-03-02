// ============================================
// Home Page - TechTools E-Commerce Store
// ============================================

import {
  HeroSection,
  FlashDealsSection,
  CategoryGridSection,
  FeaturedProductsSection,
  BrandShowcase,
  PromoBanners,
  NewsletterSection,
} from '../components/home'

export default function HomePage() {
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

      {/* Top Brands */}
      <BrandShowcase />

      {/* Newsletter Signup */}
      <NewsletterSection />
    </>
  )
}
