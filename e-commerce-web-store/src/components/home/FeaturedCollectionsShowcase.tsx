// ============================================
// Featured Collections Showcase
//
// Real, admin-curated merchandising rows -- one per product_collection
// that an admin has marked "featured" in the Collections admin page
// (star toggle), ordered by that collection's real `position`. Each row
// shows the collection's own real name/description and its real linked
// products, with a link through to the full /collections/:slug page.
//
// Capped to the top 3 featured collections by position so the homepage
// stays a tight, high-impact "showroom" rather than an exhaustive list --
// admins control exactly which 3 (and in what order) via the star toggle
// and drag-to-reorder already in the Collections admin page. No new admin
// UI was needed for this.
//
// Renders nothing if there are no featured collections with real products
// yet, matching this codebase's honest-empty-state discipline (never a
// placeholder "Best Sellers" row full of fabricated items).
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { collectionsApi } from '../../api'
import type { ProductCollection } from '../../types'
import ToolProductCard from './ToolProductCard'

const MAX_COLLECTIONS = 3
const MAX_PRODUCTS_PER_ROW = 8

export default function FeaturedCollectionsShowcase() {
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const shells = await collectionsApi.getFeatured(MAX_COLLECTIONS)
        const active = shells.filter((c) => c.is_active).slice(0, MAX_COLLECTIONS)

        const full = await Promise.all(
          active.map((c) => collectionsApi.getBySlug(c.slug).catch(() => null)),
        )
        if (cancelled) return

        // Only ever show in-stock, active products in this merchandising
        // row -- a "Best Sellers"/"New Arrivals" shelf full of "Out of
        // Stock" placeholder cards is worse than not showing the row at
        // all. A collection with real products that are all currently
        // out of stock is dropped entirely rather than shown empty.
        const withProducts = full
          .filter((c): c is ProductCollection => !!c && !!c.products)
          .map((c) => ({
            ...c,
            products: (c.products || []).filter(
              (p) => p.is_active && p.total_stock > 0,
            ),
          }))
          .filter((c) => c.products.length > 0)
        setCollections(withProducts)
      } catch (error) {
        console.error('Failed to load featured collections:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && collections.length === 0) return null

  if (loading) {
    return (
      <section aria-label='Curated collections' className='bg-white py-16 sm:py-20'>
        <div className='mx-auto max-w-7xl space-y-14 px-4 sm:px-6 lg:px-8'>
          {[...Array(2)].map((_, i) => (
            <div key={i}>
              <div className='h-8 w-64 animate-pulse rounded bg-slate-100' />
              <div className='mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-slate-100' />
              <div className='mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
                {[...Array(4)].map((_, j) => (
                  <div key={j} className='h-80 animate-pulse rounded-lg border border-slate-200 bg-slate-50' />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      {collections.map((collection, index) => (
        <section
          key={collection.id}
          aria-label={collection.name}
          className={index % 2 === 0 ? 'bg-white py-16 sm:py-20' : 'bg-slate-50 py-16 sm:py-20'}
        >
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
              <div className='max-w-2xl'>
                <h2 className='text-3xl font-black tracking-tight text-slate-900 sm:text-4xl'>
                  {collection.name}
                </h2>
                {(collection.short_description || collection.description) && (
                  <p className='mt-3 text-base text-slate-600'>
                    {collection.short_description || collection.description}
                  </p>
                )}
              </div>
              <Link
                to={`/collections/${collection.slug}`}
                className='hidden shrink-0 items-center gap-1 text-sm font-bold text-slate-900 hover:text-orange-600 sm:inline-flex'
              >
                Shop the collection
                <ArrowRight className='h-4 w-4' aria-hidden='true' />
              </Link>
            </div>

            <div className='mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
              {(collection.products || []).slice(0, MAX_PRODUCTS_PER_ROW).map((product) => (
                <ToolProductCard key={product.id} product={product} />
              ))}
            </div>

            <div className='mt-8 text-center sm:hidden'>
              <Link
                to={`/collections/${collection.slug}`}
                className='inline-flex items-center gap-1 text-sm font-bold text-slate-900 hover:text-orange-600'
              >
                Shop the collection
                <ArrowRight className='h-4 w-4' aria-hidden='true' />
              </Link>
            </div>
          </div>
        </section>
      ))}
    </>
  )
}
