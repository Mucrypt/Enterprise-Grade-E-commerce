// ============================================
// Trending Stores Component (Brand Sections)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  Plus,
  Check,
  Flame,
  BadgeCheck,
  MessageCircle,
  Star,
  Users,
  Package,
} from 'lucide-react'
import type { Brand, Product } from '../../types'
import { brandsApi, productsApi } from '../../api'
import {
  formatPrice,
  getProductImage,
  calculateDiscount,
  cn,
} from '../../utils'

interface BrandWithProducts {
  brand: Brand
  products: Product[]
  stats: {
    soldCount: number
    followerCount: number
    newProductsCount: number
  }
  testimonial?: {
    author: string
    text: string
    rating: number
  }
}

// Mock testimonials
const TESTIMONIALS = [
  {
    author: 's***3',
    text: 'These items fit perfect and look amazing!',
    rating: 5,
  },
  { author: 'j***k', text: 'Great quality for the price!', rating: 5 },
  {
    author: 'm***a',
    text: 'Fast shipping and exactly as described.',
    rating: 4,
  },
  { author: 't***y', text: 'Love this brand, always reliable!', rating: 5 },
  { author: 'a***z', text: 'Exceeded my expectations!', rating: 5 },
]

function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${Math.floor(num / 1000)}K`
  return num.toString()
}

interface StoreCardProps {
  brandData: BrandWithProducts
  index: number
}

function StoreCard({ brandData }: StoreCardProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const { brand, products, stats, testimonial } = brandData

  return (
    <div className='bg-white rounded-2xl shadow-sm hover:shadow-lg transition-shadow p-5'>
      {/* Store Header */}
      <div className='flex items-start justify-between mb-4'>
        <Link
          to={`/brand/${brand.slug}`}
          className='flex items-center gap-3 group'
        >
          {/* Logo */}
          <div className='relative'>
            {brand.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand.name}
                className='w-12 h-12 object-contain rounded-xl bg-gray-50 p-1'
              />
            ) : (
              <div className='w-12 h-12 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center'>
                <span className='text-xl font-bold text-white'>
                  {brand.name.charAt(0)}
                </span>
              </div>
            )}
            <div className='absolute -bottom-1 -right-1 bg-white rounded-full p-0.5'>
              <BadgeCheck className='w-4 h-4 text-orange-500' />
            </div>
          </div>

          {/* Name & Stats */}
          <div>
            <h3 className='font-bold text-gray-900 group-hover:text-orange-600 transition-colors flex items-center gap-1'>
              {brand.name}
              <span className='inline-flex items-center px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-semibold rounded'>
                Trends
              </span>
            </h3>
            <div className='flex items-center gap-3 text-xs text-gray-500 mt-1'>
              <span className='flex items-center gap-1'>
                <Flame className='w-3 h-3 text-orange-500' />
                {formatCount(stats.soldCount)}+ Sold
              </span>
              <span className='flex items-center gap-1'>
                <Users className='w-3 h-3' />
                {formatCount(stats.followerCount)} Followers
              </span>
              {stats.newProductsCount > 0 && (
                <span className='text-green-600 font-medium'>
                  {stats.newProductsCount}+ New
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Follow Button */}
        <button
          onClick={() => setIsFollowing(!isFollowing)}
          className={cn(
            'flex items-center gap-1 px-4 py-2 rounded-full font-semibold text-sm transition-all',
            isFollowing
              ? 'bg-orange-50 text-orange-600 border border-orange-200'
              : 'bg-orange-500 text-white hover:bg-orange-600',
          )}
        >
          {isFollowing ? (
            <>
              <Check className='w-4 h-4' />
              Following
            </>
          ) : (
            <>
              <Plus className='w-4 h-4' />
              Follow
            </>
          )}
        </button>
      </div>

      {/* Products Grid */}
      <div className='grid grid-cols-4 gap-2 mb-4'>
        {products.slice(0, 4).map((product) => {
          const hasDiscount =
            product.sale_price &&
            Number(product.sale_price) < Number(product.base_price)
          const discount = hasDiscount
            ? calculateDiscount(product.base_price, product.sale_price!)
            : 0

          return (
            <Link
              key={product.id}
              to={`/product/${product.slug}`}
              className='group'
            >
              <div className='relative aspect-4/5 rounded-lg overflow-hidden bg-gray-100'>
                <img
                  src={getProductImage(product, { w: 200, h: 250 })}
                  alt={product.name}
                  className='w-full h-full object-cover group-hover:scale-110 transition-transform duration-300'
                />
                {hasDiscount && (
                  <div className='absolute top-1 left-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded'>
                    -{discount}%
                  </div>
                )}
              </div>
              <div className='mt-2 text-center'>
                <p className='font-bold text-gray-900'>
                  {formatPrice(product.sale_price || product.base_price)}
                </p>
                {hasDiscount && (
                  <p className='text-xs text-gray-400 line-through'>
                    {formatPrice(product.base_price)}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Testimonial */}
      {testimonial && (
        <div className='flex items-start gap-2 bg-gray-50 rounded-lg p-3 mb-4'>
          <MessageCircle className='w-4 h-4 text-orange-500 shrink-0 mt-0.5' />
          <div className='flex-1 min-w-0'>
            <p className='text-sm text-gray-600'>
              <span className='font-semibold text-gray-700'>
                {testimonial.author}:
              </span>{' '}
              <span className='italic'>"{testimonial.text}"</span>
            </p>
          </div>
          <div className='flex items-center gap-0.5 shrink-0'>
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'w-3 h-3',
                  i < testimonial.rating
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-200',
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* View All Link */}
      <Link
        to={`/brand/${brand.slug}`}
        className='flex items-center justify-center gap-1 text-sm font-semibold text-orange-500 hover:text-orange-600 py-2 border-t border-gray-100 group'
      >
        View All Products
        <ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
      </Link>
    </div>
  )
}

interface TrendingStoresProps {
  categoryFilter?: string | null
}

export default function TrendingStores({
  categoryFilter,
}: TrendingStoresProps) {
  const [brandsData, setBrandsData] = useState<BrandWithProducts[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBrands()
  }, [])

  async function loadBrands() {
    try {
      const brands = await brandsApi.getAll()
      const activeBrands = brands.filter((b) => b.is_active).slice(0, 6)

      const brandsWithProducts = await Promise.all(
        activeBrands.map(async (brand, index) => {
          try {
            const { products } = await productsApi.getAll({
              brand: brand.slug,
              limit: 4,
            })

            return {
              brand,
              products,
              stats: {
                soldCount: Math.floor(Math.random() * 500 + 50) * 1000,
                followerCount: Math.floor(Math.random() * 150 + 20) * 1000,
                newProductsCount: Math.floor(Math.random() * 50 + 5),
              },
              testimonial:
                index % 2 === 0
                  ? TESTIMONIALS[index % TESTIMONIALS.length]
                  : undefined,
            }
          } catch {
            return {
              brand,
              products: [],
              stats: { soldCount: 0, followerCount: 0, newProductsCount: 0 },
            }
          }
        }),
      )

      setBrandsData(brandsWithProducts.filter((b) => b.products.length > 0))
    } catch (error) {
      console.error('Failed to load brands:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter by category if provided
  const filteredBrands = categoryFilter
    ? brandsData.filter((b) =>
        b.products.some((p) => p.category_slug === categoryFilter),
      )
    : brandsData

  if (loading) {
    return (
      <section className='py-8'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='h-8 w-48 bg-gray-200 rounded animate-pulse mb-6' />
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className='h-90 bg-gray-200 rounded-2xl animate-pulse'
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (filteredBrands.length === 0) {
    return (
      <section className='py-12'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
          <Package className='w-12 h-12 text-gray-300 mx-auto mb-4' />
          <p className='text-gray-500'>No stores found for this category</p>
        </div>
      </section>
    )
  }

  return (
    <section className='py-8'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='flex items-center gap-3 mb-6'>
          <div className='p-2 bg-orange-100 rounded-xl'>
            <Package className='w-6 h-6 text-orange-500' />
          </div>
          <div>
            <h2 className='text-2xl font-black text-gray-900'>
              Featured Stores
            </h2>
            <p className='text-sm text-gray-500'>Top brands & sellers</p>
          </div>
        </div>

        {/* Stores Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {filteredBrands.map((brandData, index) => (
            <StoreCard
              key={brandData.brand.id}
              brandData={brandData}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
