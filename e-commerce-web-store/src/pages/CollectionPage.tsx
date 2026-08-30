// ============================================
// Collection Page (category collections + product collections)
// ============================================
// Storefront landing page for a real, admin-curated collection -- a
// category_collections campaign (a set of categories, e.g. "Autumn Power
// Tools Sale") or a product_collections campaign (a set of products, e.g.
// "Hot Right Now" / "Best Sellers"). Both live under the same /collections/
// :slug URL: this page tries the category-collection lookup first, and
// falls back to the product-collection lookup if that 404s, so every
// collection type gets a real landing page without splitting the route.
// A collection that's inactive, private, or outside its scheduled window
// 404s server-side either way, so this page never has to guess about
// availability -- it either has real data to show, or the not-found state.
// ============================================

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { categoryCollectionsApi, collectionsApi } from '../api'
import type { CategoryCollection, ProductCollection } from '../types'
import ToolProductCard from '../components/home/ToolProductCard'

type LoadedCollection =
  | { kind: 'category'; data: CategoryCollection }
  | { kind: 'product'; data: ProductCollection }

function mediaUrl(category: CategoryCollection['categories'][number], purpose: 'icon'): string | null {
  const media = category.media?.find((m) => m.media_purpose === purpose)
  return media?.cdn_urls?.medium || media?.file_path || media?.url || null
}

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const [collection, setCollection] = useState<LoadedCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load(collectionSlug: string) {
      setLoading(true)
      setNotFound(false)
      try {
        try {
          const data = await categoryCollectionsApi.getBySlug(collectionSlug)
          if (!cancelled) setCollection({ kind: 'category', data })
          return
        } catch {
          // Not a category collection -- try product collection next.
        }
        const data = await collectionsApi.getBySlug(collectionSlug)
        if (!cancelled) setCollection({ kind: 'product', data })
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load(slug)

    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (notFound || !collection) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-gray-900">This collection isn't available</h1>
        <p className="mt-2 text-gray-500">It may have ended, or the link may be out of date.</p>
        <Link
          to="/products"
          className="mt-6 inline-block rounded-md bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600"
        >
          Browse All Products
        </Link>
      </div>
    )
  }

  const { data } = collection
  const heroImage = data.banner_url || data.image_url

  return (
    <div>
      {heroImage ? (
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          <img src={heroImage} alt={data.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/60 via-black/10 to-transparent">
            <div className="container mx-auto px-4 pb-8">
              <h1 className="text-3xl font-black text-white sm:text-4xl">{data.name}</h1>
              {data.short_description && (
                <p className="mt-2 max-w-xl text-white/90">{data.short_description}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b bg-gray-50 py-10">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-black text-gray-900 sm:text-4xl">{data.name}</h1>
            {data.short_description && (
              <p className="mt-2 max-w-xl text-gray-600">{data.short_description}</p>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10">
        {data.description && (
          <p className="mb-8 max-w-2xl text-gray-600">{data.description}</p>
        )}

        {collection.kind === 'category' ? (
          collection.data.categories.length === 0 ? (
            <p className="text-gray-500">No categories have been added to this collection yet.</p>
          ) : (
            <>
              <h2 className="mb-5 text-lg font-bold text-gray-900">Shop this collection</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {collection.data.categories.map((category) => {
                  const icon = mediaUrl(category, 'icon')
                  return (
                    <Link
                      key={category.id}
                      to={`/category/${category.slug}`}
                      className="group flex flex-col items-center gap-3 rounded-xl border border-gray-100 p-4 text-center transition-colors hover:border-orange-200 hover:bg-orange-50"
                    >
                      {icon ? (
                        <span className="h-16 w-16 overflow-hidden rounded-full shadow-sm transition-transform group-hover:scale-105">
                          <img src={icon} alt={category.name} className="h-full w-full object-cover" />
                        </span>
                      ) : (
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-700 transition-transform group-hover:scale-105">
                          {category.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-orange-700">
                        {category.name}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </>
          )
        ) : (collection.data.products || []).length === 0 ? (
          <p className="text-gray-500">No products have been added to this collection yet.</p>
        ) : (
          <>
            <h2 className="mb-5 text-lg font-bold text-gray-900">Shop this collection</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(collection.data.products || []).map((product) => (
                <ToolProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
