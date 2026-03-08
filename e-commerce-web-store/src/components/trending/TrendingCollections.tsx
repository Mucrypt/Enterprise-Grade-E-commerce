// ============================================
// Trending Collections Component
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ChevronRight, Sparkles } from 'lucide-react'
import type { ProductCollection, Product } from '../../types'
import { collectionsApi } from '../../api'
import { formatPrice, getProductImage } from '../../utils'

interface CollectionWithProducts extends ProductCollection {
  featuredProducts?: Product[]
}

export default function TrendingCollections() {
  const [collections, setCollections] = useState<CollectionWithProducts[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCollections()
  }, [])

  async function loadCollections() {
    try {
      const data = await collectionsApi.getFeatured()

      // Load featured products for each collection
      const collectionsWithProducts = await Promise.all(
        data.slice(0, 8).map(async (collection) => {
          try {
            const fullCollection = await collectionsApi.getBySlug(
              collection.slug,
            )
            return {
              ...collection,
              featuredProducts: fullCollection.products?.slice(0, 4) || [],
            }
          } catch {
            return { ...collection, featuredProducts: [] }
          }
        }),
      )

      setCollections(collectionsWithProducts)
    } catch (error) {
      console.error('Failed to load collections:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <section className='py-8'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3 mb-6'>
            <div className='h-8 w-48 bg-gray-200 rounded animate-pulse' />
          </div>
          <div className='flex gap-4 overflow-x-auto pb-4'>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className='min-w-70 h-80 bg-gray-200 rounded-2xl animate-pulse'
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (collections.length === 0) return null

  return (
    <section className='py-8 bg-linear-to-b from-gray-50 to-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-orange-100 rounded-xl'>
              <Sparkles className='w-6 h-6 text-orange-500' />
            </div>
            <div>
              <h2 className='text-2xl font-black text-gray-900'>
                Trending Collections
              </h2>
              <p className='text-sm text-gray-500'>
                Curated picks just for you
              </p>
            </div>
          </div>
          <Link
            to='/products?featured=true'
            className='hidden md:flex items-center gap-1 text-orange-500 hover:text-orange-600 font-semibold group'
          >
            View All
            <ChevronRight className='w-5 h-5 group-hover:translate-x-1 transition-transform' />
          </Link>
        </div>

        {/* Collections Horizontal Scroll */}
        <div className='flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4'>
          {collections.map((collection) => (
            <Link
              key={collection.id}
              to={`/products?collection=${collection.slug}`}
              className='group min-w-70 md:min-w-[320px]'
            >
              <div className='relative bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden p-4 h-85 flex flex-col'>
                {/* Trending Badge */}
                {collection.is_featured && (
                  <div className='absolute top-4 right-4 flex items-center gap-1 bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full'>
                    <TrendingUp className='w-3 h-3' />
                    Trending
                  </div>
                )}

                {/* Collection Name */}
                <div className='mb-4'>
                  <div className='flex items-center gap-1 text-white'>
                    <span className='text-xl font-bold'>
                      # {collection.name}
                    </span>
                    <ChevronRight className='w-5 h-5 opacity-60 group-hover:translate-x-1 transition-transform' />
                  </div>
                  <p className='text-gray-400 text-sm mt-1'>
                    {collection.products?.length || 0} items
                  </p>
                </div>

                {/* Products Grid */}
                <div className='grid grid-cols-2 gap-2 flex-1'>
                  {(collection.featuredProducts || [])
                    .slice(0, 4)
                    .map((product) => (
                      <div
                        key={product.id}
                        className='relative rounded-lg overflow-hidden bg-white/10 backdrop-blur'
                      >
                        <img
                          src={getProductImage(product, { w: 150, h: 150 })}
                          alt={product.name}
                          className='w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-300'
                        />
                        <div className='absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs font-semibold text-white'>
                          {formatPrice(
                            product.sale_price || product.base_price,
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Hover Effect */}
                <div className='absolute inset-0 border-2 border-transparent group-hover:border-orange-500/50 rounded-2xl transition-all pointer-events-none' />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
