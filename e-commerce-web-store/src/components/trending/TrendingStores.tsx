// ============================================
// Trending Stores Component (Brand Sections)
// ============================================
// Every number and quote here is real: soldCount/followerCount come from
// actual paid orders and brand_follows (see brand.controller.ts
// getBrandStats), and the testimonial is a genuine approved review pulled
// from one of the brand's products -- never a fabricated placeholder. The
// Follow button is a real, server-synced action (see brandsApi.follow),
// not a local toggle that resets on refresh.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { useAuthStore } from '../../stores'
import {
  formatPrice,
  getProductImage,
  calculateDiscount,
  cn,
} from '../../utils'

type BrandStats = {
  soldCount: number
  followerCount: number
  newProductsCount: number
}

type TopReview = { rating: number; comment: string; authorName: string }

interface BrandWithProducts {
  brand: Brand
  products: Product[]
  stats: BrandStats
  review?: TopReview
}

function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${Math.floor(num / 1000)}K`
  return num.toString()
}

interface StoreCardProps {
  brandData: BrandWithProducts
  isFollowing: boolean
  onToggleFollow: (brandId: string) => void
}

function StoreCard({ brandData, isFollowing, onToggleFollow }: StoreCardProps) {
  const { brand, products, stats, review } = brandData

  return (
    <div className='bg-white rounded-2xl shadow-sm hover:shadow-lg transition-shadow p-5'>
      {/* Store Header */}
      <div className='flex items-start justify-between mb-4'>
        <Link
          to={`/brand/${brand.slug}`}
          className='flex items-center gap-3 group min-w-0'
        >
          {/* Logo */}
          <div className='relative shrink-0'>
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
          <div className='min-w-0'>
            <h3 className='font-bold text-gray-900 group-hover:text-orange-600 transition-colors flex items-center gap-1 truncate'>
              {brand.name}
              <span className='inline-flex items-center px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-semibold rounded shrink-0'>
                Trends
              </span>
            </h3>
            <div className='flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap'>
              {stats.soldCount > 0 && (
                <span className='flex items-center gap-1'>
                  <Flame className='w-3 h-3 text-orange-500' />
                  {formatCount(stats.soldCount)}+ Sold
                </span>
              )}
              {stats.followerCount > 0 && (
                <span className='flex items-center gap-1'>
                  <Users className='w-3 h-3' />
                  {formatCount(stats.followerCount)} Followers
                </span>
              )}
              {stats.newProductsCount > 0 && (
                <span className='text-green-600 font-medium'>
                  {stats.newProductsCount}+ New
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Follow Button -- real, server-synced */}
        <button
          onClick={() => onToggleFollow(brand.id)}
          className={cn(
            'flex shrink-0 items-center gap-1 px-4 py-2 rounded-full font-semibold text-sm transition-all',
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

      {/* Real testimonial -- absent when the brand has no qualifying review yet */}
      {review && (
        <div className='flex items-start gap-2 bg-gray-50 rounded-lg p-3 mb-4'>
          <MessageCircle className='w-4 h-4 text-orange-500 shrink-0 mt-0.5' />
          <div className='flex-1 min-w-0'>
            <p className='text-sm text-gray-600'>
              <span className='font-semibold text-gray-700'>
                {review.authorName}:
              </span>{' '}
              <span className='italic'>&ldquo;{review.comment}&rdquo;</span>
            </p>
          </div>
          <div className='flex items-center gap-0.5 shrink-0'>
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'w-3 h-3',
                  i < review.rating
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
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [brandsData, setBrandsData] = useState<BrandWithProducts[]>([])
  const [followedBrandIds, setFollowedBrandIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadBrands = useCallback(async () => {
    try {
      const brands = await brandsApi.getAll()
      const activeBrands = brands.filter((b) => b.is_active).slice(0, 6)

      const brandsWithProducts = await Promise.all(
        activeBrands.map(async (brand) => {
          try {
            const { products } = await productsApi.getAll({
              brand: brand.slug,
              limit: 4,
            })
            return { brand, products }
          } catch {
            return { brand, products: [] as Product[] }
          }
        }),
      )

      const withProducts = brandsWithProducts.filter((b) => b.products.length > 0)
      const brandIds = withProducts.map((b) => b.brand.id)
      const { stats, topReviews } = await brandsApi.getStats(brandIds)

      setBrandsData(
        withProducts.map(({ brand, products }) => ({
          brand,
          products,
          stats: {
            soldCount: stats[brand.id]?.unitsSold ?? 0,
            followerCount: stats[brand.id]?.followerCount ?? 0,
            newProductsCount: stats[brand.id]?.newProductsCount ?? 0,
          },
          review: topReviews[brand.id],
        })),
      )

      if (isAuthenticated) {
        try {
          const followed = await brandsApi.getFollowed()
          setFollowedBrandIds(new Set(followed))
        } catch {
          // Best-effort -- an empty set just means every card shows "Follow".
        }
      }
    } catch (error) {
      console.error('Failed to load brands:', error)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadBrands()
  }, [loadBrands])

  const handleToggleFollow = async (brandId: string) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/trending' } } })
      return
    }

    const isFollowing = followedBrandIds.has(brandId)
    setFollowedBrandIds((prev) => {
      const next = new Set(prev)
      if (isFollowing) next.delete(brandId)
      else next.add(brandId)
      return next
    })
    setBrandsData((prev) =>
      prev.map((b) =>
        b.brand.id === brandId
          ? {
              ...b,
              stats: {
                ...b.stats,
                followerCount: Math.max(0, b.stats.followerCount + (isFollowing ? -1 : 1)),
              },
            }
          : b,
      ),
    )

    try {
      if (isFollowing) await brandsApi.unfollow(brandId)
      else await brandsApi.follow(brandId)
    } catch {
      setFollowedBrandIds((prev) => {
        const next = new Set(prev)
        if (isFollowing) next.add(brandId)
        else next.delete(brandId)
        return next
      })
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
          {filteredBrands.map((brandData) => (
            <StoreCard
              key={brandData.brand.id}
              brandData={brandData}
              isFollowing={followedBrandIds.has(brandData.brand.id)}
              onToggleFollow={handleToggleFollow}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
