// ============================================
// Product Detail Page
// ============================================

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, Share2, Shield, RotateCcw, Package, Award, MessageSquare, Users } from 'lucide-react'
import DOMPurify from 'dompurify'
import type { Product, ProductMedia, ProductVariant } from '../types'
import { productsApi } from '../api'
import { useCartStore, useWishlistStore } from '../stores'
import { cn, getProductImage } from '../utils'
import { getDisplayPricing } from '../utils/pricing'
import ProductCard from '../components/common/ProductCard'
import DeliveryEstimate from '../components/product/DeliveryEstimate'
import { ImageGallery } from '../components/product/ImageGallery'
import { PriceBlock } from '../components/product/PriceBlock'
import { RatingSummary } from '../components/product/RatingSummary'
import { PurchasePanel } from '../components/product/PurchasePanel'
import { StickyMobileBar } from '../components/product/StickyMobileBar'
import { ReviewsSection } from '../components/product/ReviewsSection'
import { Specifications } from '../components/product/Specifications'
import { ProductJsonLd } from '../components/product/ProductJsonLd'
import { Badge } from '../components/ui/Badge'
import { useEventTracking } from '../hooks/useEventTracking'

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews'>('description')

  const { addItem } = useCartStore()
  const { toggleItem, isInWishlist } = useWishlistStore()
  const { trackProductView, trackAddToCart, trackProductFavorite } = useEventTracking()

  useEffect(() => {
    if (slug) {
      loadProduct(slug)
    }
  }, [slug])

  async function loadProduct(productSlug: string) {
    setLoading(true)
    try {
      const data = await productsApi.getBySlug(productSlug)
      setProduct(data)
      setQuantity(1)
      setSelectedVariant(null)

      const pricing = getDisplayPricing(data.base_price, data.sale_price)
      trackProductView(
        data.id,
        data.name,
        data.sku || '',
        data.category_id || '',
        Number(data.base_price),
        pricing.discountPercent || 0,
      )

      // getRelated resolves successfully with an empty array (not a thrown
      // error) whenever nothing shares this product's category/brand --
      // a real gap in a catalog this size, where many products are the
      // only one in their niche. Previously only a thrown error fell back
      // to featured products, so an empty (but successful) result left
      // both "You May Also Like" and "Frequently Bought Together" showing
      // nothing at all for those products.
      try {
        const related = await productsApi.getRelated(data.id, 8)
        if (related.length > 0) {
          setRelatedProducts(related)
        } else {
          const featured = await productsApi.getFeatured(8)
          setRelatedProducts(featured.filter((p) => p.id !== data.id))
        }
      } catch {
        try {
          const featured = await productsApi.getFeatured(8)
          setRelatedProducts(featured.filter((p) => p.id !== data.id))
        } catch {
          setRelatedProducts([])
        }
      }
    } catch (error) {
      console.error('Failed to load product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = () => {
    if (!product) return
    addItem(product, quantity, selectedVariant || undefined)
    const pricing = getDisplayPricing(product.base_price, product.sale_price)
    trackAddToCart(product.id, product.name, product.sku || '', pricing.sellingPrice, quantity)
  }

  const handleBuyNow = () => {
    if (!product) return
    addItem(product, quantity, selectedVariant || undefined)
    window.location.href = '/checkout'
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='mx-auto max-w-7xl px-4'>
          <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
            <div className='aspect-square animate-pulse rounded-xl bg-gray-200' />
            <div className='space-y-4'>
              <div className='h-8 w-3/4 animate-pulse rounded bg-gray-200' />
              <div className='h-6 w-1/2 animate-pulse rounded bg-gray-200' />
              <div className='h-10 w-1/3 animate-pulse rounded bg-gray-200' />
              <div className='h-32 animate-pulse rounded bg-gray-200' />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <h1 className='mb-2 text-2xl font-bold text-gray-900'>Product Not Found</h1>
          <p className='mb-4 text-gray-500'>The product you're looking for doesn't exist.</p>
          <Link to='/products' className='text-orange-500 hover:underline'>
            Browse All Products
          </Link>
        </div>
      </div>
    )
  }

  const pricing = getDisplayPricing(product.base_price, product.sale_price)
  const inWishlist = isInWishlist(product.id)
  const variants = product.variations || []

  const galleryItems: ProductMedia[] = product.media?.length
    ? [...product.media].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return (a.position || 0) - (b.position || 0)
      })
    : product.images?.length
    ? product.images.map((img) => ({ ...img, type: 'image' as const, position: img.display_order || 0 }))
    : [{ url: getProductImage(product), is_primary: true, id: '1', alt_text: product.name, position: 0, type: 'image' as const }]

  const availableStock = selectedVariant ? selectedVariant.stock : product.total_stock

  return (
    <div className='min-h-screen bg-gray-50 pb-20 sm:pb-0'>
      <ProductJsonLd product={product} imageUrl={galleryItems[0]?.url || getProductImage(product)} />

      {/* Breadcrumb */}
      <div className='border-b bg-white'>
        <div className='mx-auto max-w-7xl px-4 py-3'>
          <nav className='flex items-center gap-2 text-sm text-gray-500'>
            <Link to='/' className='hover:text-orange-500'>
              Home
            </Link>
            <span>/</span>
            <Link to='/products' className='hover:text-orange-500'>
              Products
            </Link>
            <span>/</span>
            {product.category_name && (
              <>
                <Link to={`/category/${product.category_slug}`} className='hover:text-orange-500'>
                  {product.category_name}
                </Link>
                <span>/</span>
              </>
            )}
            <span className='max-w-xs truncate text-gray-900'>{product.name}</span>
          </nav>
        </div>
      </div>

      <div className='mx-auto max-w-7xl px-4 py-8'>
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12'>
          <ImageGallery
            items={galleryItems}
            productName={product.name}
            badges={
              <>
                {pricing.discountPercent !== null && pricing.discountPercent > 0 && (
                  <Badge variant='sale'>-{pricing.discountPercent}%</Badge>
                )}
                {product.is_featured && <Badge variant='featured'>Featured</Badge>}
              </>
            }
            actions={
              <>
                <button
                  type='button'
                  onClick={() => {
                    toggleItem(product)
                    trackProductFavorite(product.id, product.name, !inWishlist)
                  }}
                  aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  aria-pressed={inWishlist}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors',
                    inWishlist ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:text-red-500',
                  )}
                >
                  <Heart className={cn('h-5 w-5', inWishlist && 'fill-current')} />
                </button>
                <button
                  type='button'
                  aria-label='Share this product'
                  className='flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg hover:text-orange-500'
                >
                  <Share2 className='h-5 w-5' />
                </button>
              </>
            }
          />

          <div className='space-y-6'>
            {product.brand_name && (
              <Link to={`/brand/${product.brand_slug}`} className='inline-block text-sm font-medium text-orange-500 hover:underline'>
                {product.brand_name}
              </Link>
            )}

            <h1 className='text-2xl font-bold leading-tight text-gray-900 lg:text-3xl'>{product.name}</h1>

            <RatingSummary
              averageRating={product.average_rating}
              reviewCount={product.review_count}
              unitsSold={product.units_sold}
            />

            <PriceBlock basePrice={product.base_price} salePrice={product.sale_price} />

            {product.short_description && <p className='leading-relaxed text-gray-600'>{product.short_description}</p>}

            <PurchasePanel
              product={product}
              quantity={quantity}
              onQuantityChange={setQuantity}
              variants={variants}
              selectedVariant={selectedVariant}
              onSelectVariant={setSelectedVariant}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
            />

            <DeliveryEstimate productId={product.id} />

            {/* Compact trust badges -- only figures that are genuine,
                site-wide company policy (asserted the same way elsewhere,
                e.g. FAQ/Terms/Footer), never a per-product invented claim. */}
            <div className='grid grid-cols-2 gap-4'>
              <div className='flex items-center gap-3 rounded-lg bg-gray-50 p-3'>
                <Shield className='h-5 w-5 text-orange-500' />
                <div>
                  <p className='text-sm font-medium'>2-Year Warranty</p>
                  <p className='text-xs text-gray-500'>Full coverage</p>
                </div>
              </div>
              <div className='flex items-center gap-3 rounded-lg bg-gray-50 p-3'>
                <RotateCcw className='h-5 w-5 text-orange-500' />
                <div>
                  <p className='text-sm font-medium'>30-Day Returns</p>
                  <p className='text-xs text-gray-500'>Easy returns</p>
                </div>
              </div>
            </div>

            <p className='text-sm text-gray-500'>
              SKU: <span className='font-mono'>{product.sku}</span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className='mt-12'>
          <div className='border-b'>
            <div className='flex gap-8'>
              {(
                [
                  { id: 'description', label: 'Description', icon: Package },
                  { id: 'specs', label: 'Specifications', icon: Award },
                  {
                    id: 'reviews',
                    label: product.review_count ? `Reviews (${product.review_count})` : 'Reviews',
                    icon: MessageSquare,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type='button'
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                  role='tab'
                  className={cn(
                    'flex items-center gap-2 border-b-2 py-4 font-medium transition-colors',
                    activeTab === tab.id ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-700',
                  )}
                >
                  <tab.icon className='h-5 w-5' />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className='py-8'>
            {activeTab === 'description' && (
              <div className='rounded-xl bg-white p-6 shadow-sm'>
                {/* Sourced-product descriptions are stored as HTML (AI-rewritten with
                    <p>/<ul>/<li> markup); manually-entered ones are plain text with no
                    tags, which renders identically through innerHTML as it would as a
                    plain string -- so this is safe for both, not sourcing-specific.
                    DOMPurify is required here, not optional: this HTML can originate
                    from a scraped third-party page (Alibaba/Amazon) via the sourcing
                    extension, so it's untrusted input reaching every visitor's browser. */}
                <div
                  className='whitespace-pre-line text-gray-700 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-3'
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || '') }}
                />
              </div>
            )}

            {activeTab === 'specs' && (
              <div className='rounded-xl bg-white p-6 shadow-sm'>
                <Specifications product={product} />
              </div>
            )}

            {activeTab === 'reviews' && <ReviewsSection productId={product.id} />}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className='mt-12'>
            <h2 className='mb-6 text-2xl font-bold text-gray-900'>You May Also Like</h2>
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
              {relatedProducts.slice(0, 4).map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}

        {relatedProducts.length > 4 && (
          <div className='mt-12'>
            <h2 className='mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900'>
              <Users className='h-6 w-6 text-orange-500' /> Frequently Bought Together
            </h2>
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
              {relatedProducts.slice(4, 8).map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}
      </div>

      <StickyMobileBar
        sellingPrice={pricing.sellingPrice}
        outOfStock={availableStock <= 0}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
      />
    </div>
  )
}
