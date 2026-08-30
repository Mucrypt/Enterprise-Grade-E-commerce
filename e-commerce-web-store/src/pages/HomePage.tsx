// ============================================
// Home Page - TechTools Professional Tools & Workshop Equipment
// ============================================

import { useEffect } from 'react'

import {
  ToolsHero,
  TrustStrip,
  ShopByTrade,
  FeaturedCollectionsShowcase,
  CategoryShowcaseBanner,
  FeaturedProfessionalTools,
  WorkshopMachinerySection,
  BusinessBuyerSection,
  ProfessionalBrands,
  ToolKnowledgeSection,
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
      {/* Professional Hero */}
      <ToolsHero />

      {/* Trust / service strip */}
      <TrustStrip />

      {/* Shop by Trade */}
      <ShopByTrade />

      {/* Curated, admin-featured product collections (Best Sellers, New
          Arrivals, etc.) -- the homepage's main "showroom" rows */}
      <FeaturedCollectionsShowcase />

      {/* Spotlight banner for the top admin-featured category collection */}
      <CategoryShowcaseBanner />

      {/* Featured Professional Tools */}
      <FeaturedProfessionalTools />

      {/* Workshop Machinery feature */}
      <WorkshopMachinerySection />

      {/* Business & Bulk Orders (B2B) */}
      <BusinessBuyerSection />

      {/* Professional Brands */}
      <ProfessionalBrands />

      {/* Tool Guides & Workshop Knowledge */}
      <ToolKnowledgeSection />
    </>
  )
}
