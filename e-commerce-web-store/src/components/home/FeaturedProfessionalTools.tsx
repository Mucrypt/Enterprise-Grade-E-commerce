// ============================================
// Featured Professional Tools
//
// Real data only: uses the existing productsApi.getFeatured
// endpoint, no hardcoded products/prices/stock/ratings. Only
// a single "Featured" section is shown (no Best Sellers / New
// Arrivals tabs) because the backend has no real sales-ranking
// or "new" classification wired to this endpoint - adding tabs
// would mean fabricating labels, which is explicitly disallowed.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Product } from '../../types'
import { productsApi } from '../../api'
import { homepageConfig } from '../../config/homepage.config'
import ToolProductCard from './ToolProductCard'

export default function FeaturedProfessionalTools() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      try {
        const data = await productsApi.getFeatured(
          homepageConfig.featuredTools.fetchLimit,
        )
        if (cancelled) return

        const active = data.filter((product) => product.is_active)
        // Show in-stock items first so the lead item is never
        // out of stock, without fabricating stock for anything.
        const sorted = [...active].sort((a, b) => {
          const aInStock = a.total_stock > 0 ? 1 : 0
          const bInStock = b.total_stock > 0 ? 1 : 0
          return bInStock - aInStock
        })

        setProducts(sorted.slice(0, homepageConfig.featuredTools.displayLimit))
      } catch (error) {
        console.error('Failed to load featured products:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProducts()
    return () => {
      cancelled = true
    }
  }, [])

  const { heading, description, displayLimit } = homepageConfig.featuredTools

  return (
    <section aria-label='Featured professional tools' className='bg-slate-50 py-16 sm:py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div className='max-w-2xl'>
            <h2 className='text-3xl font-black tracking-tight text-slate-900 sm:text-4xl'>
              {heading}
            </h2>
            <p className='mt-3 text-base text-slate-600'>{description}</p>
          </div>
          <Link
            to={homepageConfig.routes.products}
            className='hidden shrink-0 items-center gap-1 text-sm font-bold text-slate-900 hover:text-orange-600 sm:inline-flex'
          >
            View All Products
            <ArrowRight className='h-4 w-4' aria-hidden='true' />
          </Link>
        </div>

        {loading ? (
          <div className='mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
            {[...Array(displayLimit)].map((_, i) => (
              <div
                key={i}
                className='h-80 animate-pulse rounded-lg border border-slate-200 bg-white'
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className='mt-10 rounded-lg border border-slate-200 bg-white p-8 text-center'>
            <p className='text-sm text-slate-600'>
              No featured products are available right now.{' '}
              <Link
                to={homepageConfig.routes.products}
                className='font-semibold text-orange-600 hover:text-orange-700'
              >
                Browse the full catalogue
              </Link>
            </p>
          </div>
        ) : (
          <div className='mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
            {products.map((product) => (
              <ToolProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className='mt-8 text-center sm:hidden'>
          <Link
            to={homepageConfig.routes.products}
            className='inline-flex items-center gap-1 text-sm font-bold text-slate-900 hover:text-orange-600'
          >
            View All Products
            <ArrowRight className='h-4 w-4' aria-hidden='true' />
          </Link>
        </div>
      </div>
    </section>
  )
}
