// ============================================
// Product Detail Page - SHEIN/Amazon Style
// ============================================

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Heart,
  Share2,
  ShoppingCart,
  Truck,
  Shield,
  RotateCcw,
  Star,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Check,
  Package,
  Clock,
  Award,
  MessageSquare,
  ThumbsUp,
  Play,
} from 'lucide-react'
import DOMPurify from 'dompurify'
import type { Product, ProductMedia } from '../types'
import { productsApi } from '../api'
import { useCartStore, useWishlistStore } from '../stores'
import { cn, formatPrice, calculateDiscount, getProductImage } from '../utils'
import ProductCard from '../components/common/ProductCard'
import { useEventTracking } from '../hooks/useEventTracking'

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<
    'description' | 'specs' | 'reviews'
  >('description')

  const { addItem } = useCartStore()
  const { toggleItem, isInWishlist } = useWishlistStore()
  const { trackProductView, trackAddToCart, trackProductFavorite } =
    useEventTracking()

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

      // Track product view event
      trackProductView(
        data.id,
        data.name,
        data.sku || '',
        data.category_id || '',
        Number(data.base_price),
        calculateDiscount(data.base_price, data.sale_price || 0),
      )

      // Load related products
      try {
        const related = await productsApi.getRelated(data.id, 8)
        setRelatedProducts(related)
      } catch {
        // Fallback to featured products
        const featured = await productsApi.getFeatured(8)
        setRelatedProducts(featured.filter((p) => p.id !== data.id))
      }
    } catch (error) {
      console.error('Failed to load product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = () => {
    if (product) {
      addItem(product, quantity)
      trackAddToCart(
        product.id,
        product.name,
        product.sku || '',
        Number(product.sale_price || product.base_price),
        quantity,
      )
    }
  }

  const handleBuyNow = () => {
    if (product) {
      addItem(product, quantity)
      window.location.href = '/checkout'
    }
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-7xl mx-auto px-4'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
            <div className='aspect-square bg-gray-200 rounded-xl animate-pulse' />
            <div className='space-y-4'>
              <div className='h-8 bg-gray-200 rounded animate-pulse w-3/4' />
              <div className='h-6 bg-gray-200 rounded animate-pulse w-1/2' />
              <div className='h-10 bg-gray-200 rounded animate-pulse w-1/3' />
              <div className='h-32 bg-gray-200 rounded animate-pulse' />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>
            Product Not Found
          </h1>
          <p className='text-gray-500 mb-4'>
            The product you're looking for doesn't exist.
          </p>
          <Link to='/products' className='text-orange-500 hover:underline'>
            Browse All Products
          </Link>
        </div>
      </div>
    )
  }

  const discount = calculateDiscount(
    product.base_price,
    product.sale_price || 0,
  )
  const inWishlist = isInWishlist(product.id)

  // Build gallery items from media (includes both images and videos)
  const galleryItems: ProductMedia[] = product.media?.length
    ? product.media.sort((a, b) => {
        // Primary items first, then by position
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return (a.position || 0) - (b.position || 0)
      })
    : product.images?.length
    ? product.images.map((img) => ({
        ...img,
        type: 'image' as const,
        position: img.display_order || 0,
      }))
    : [
        {
          url: getProductImage(product),
          is_primary: true,
          id: '1',
          alt_text: product.name,
          position: 0,
          type: 'image' as const,
        },
      ]

  // For backwards compatibility
  const images = galleryItems

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Breadcrumb */}
      <div className='bg-white border-b'>
        <div className='max-w-7xl mx-auto px-4 py-3'>
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
                <Link
                  to={`/category/${product.category_slug}`}
                  className='hover:text-orange-500'
                >
                  {product.category_name}
                </Link>
                <span>/</span>
              </>
            )}
            <span className='text-gray-900 truncate max-w-xs'>
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className='max-w-7xl mx-auto px-4 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12'>
          {/* Image/Video Gallery */}
          <div className='space-y-4'>
            {/* Main Image or Video */}
            <div className='relative aspect-square bg-white rounded-2xl overflow-hidden shadow-sm'>
              {galleryItems[selectedImage]?.type === 'video' ? (
                <video
                  src={galleryItems[selectedImage]?.url}
                  controls
                  className='w-full h-full object-contain p-6'
                  poster={galleryItems[selectedImage]?.cdn_urls?.thumbnail}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <img
                  src={
                    galleryItems[selectedImage]?.url || getProductImage(product)
                  }
                  alt={product.name}
                  className='w-full h-full object-contain p-6'
                />
              )}

              {/* Navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setSelectedImage(
                        (prev) => (prev - 1 + images.length) % images.length,
                      )
                    }
                    className='absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white'
                  >
                    <ChevronLeft className='w-5 h-5' />
                  </button>
                  <button
                    onClick={() =>
                      setSelectedImage((prev) => (prev + 1) % images.length)
                    }
                    className='absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white'
                  >
                    <ChevronRight className='w-5 h-5' />
                  </button>
                </>
              )}

              {/* Badges */}
              <div className='absolute top-4 left-4 flex flex-col gap-2'>
                {discount > 0 && (
                  <span className='px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-lg'>
                    -{discount}%
                  </span>
                )}
                {product.is_featured && (
                  <span className='px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded-lg'>
                    Featured
                  </span>
                )}
              </div>

              {/* Wishlist & Share */}
              <div className='absolute top-4 right-4 flex flex-col gap-2'>
                <button
                  onClick={() => {
                    toggleItem(product)
                    trackProductFavorite(product.id, product.name, !inWishlist)
                  }}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors',
                    inWishlist
                      ? 'bg-red-500 text-white'
                      : 'bg-white text-gray-600 hover:text-red-500',
                  )}
                >
                  <Heart
                    className={cn('w-5 h-5', inWishlist && 'fill-current')}
                  />
                </button>
                <button className='w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-600 hover:text-orange-500'>
                  <Share2 className='w-5 h-5' />
                </button>
              </div>
            </div>

            {/* Thumbnails */}
            {galleryItems.length > 1 && (
              <div className='flex gap-3 overflow-x-auto pb-2'>
                {galleryItems.map((item, index) => (
                  <button
                    key={item.id || index}
                    onClick={() => setSelectedImage(index)}
                    className={cn(
                      'relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all',
                      selectedImage === index
                        ? 'border-orange-500'
                        : 'border-transparent hover:border-gray-300',
                    )}
                  >
                    {item.type === 'video' ? (
                      <>
                        <video
                          src={item.url}
                          className='w-full h-full object-cover'
                          muted
                        />
                        <div className='absolute inset-0 bg-black/30 flex items-center justify-center'>
                          <Play className='w-6 h-6 text-white fill-white' />
                        </div>
                      </>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.alt_text || `${product.name} ${index + 1}`}
                        className='w-full h-full object-cover'
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className='space-y-6'>
            {/* Brand */}
            {product.brand_name && (
              <Link
                to={`/brand/${product.brand_slug}`}
                className='inline-block text-sm font-medium text-orange-500 hover:underline'
              >
                {product.brand_name}
              </Link>
            )}

            {/* Name */}
            <h1 className='text-2xl lg:text-3xl font-bold text-gray-900 leading-tight'>
              {product.name}
            </h1>

            {/* Rating */}
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-1'>
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'w-5 h-5',
                      i < 4
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300',
                    )}
                  />
                ))}
              </div>
              <span className='text-sm text-gray-500'>
                4.5 / 5 (128 reviews)
              </span>
              <span className='text-sm text-gray-400'>|</span>
              <span className='text-sm text-green-600'>500+ sold</span>
            </div>

            {/* Price */}
            <div className='bg-orange-50 rounded-xl p-4'>
              <div className='flex items-baseline gap-3'>
                <span className='text-3xl font-bold text-orange-600'>
                  {formatPrice(product.sale_price || product.base_price)}
                </span>
                {product.sale_price && (
                  <>
                    <span className='text-lg text-gray-400 line-through'>
                      {formatPrice(product.base_price)}
                    </span>
                    <span className='px-2 py-1 bg-red-500 text-white text-xs font-bold rounded'>
                      SAVE{' '}
                      {formatPrice(
                        Number(product.base_price) - Number(product.sale_price),
                      )}
                    </span>
                  </>
                )}
              </div>
              {discount > 0 && (
                <p className='text-sm text-orange-600 mt-2'>
                  🔥 Limited time offer - {discount}% off!
                </p>
              )}
            </div>

            {/* Short Description */}
            <p className='text-gray-600 leading-relaxed'>
              {product.short_description}
            </p>

            {/* Stock Status */}
            <div className='flex items-center gap-2'>
              {product.total_stock > 0 ? (
                <>
                  <Check className='w-5 h-5 text-green-500' />
                  <span className='text-green-600 font-medium'>In Stock</span>
                  {product.total_stock < 20 && (
                    <span className='text-orange-500 text-sm'>
                      (Only {product.total_stock} left!)
                    </span>
                  )}
                </>
              ) : (
                <span className='text-red-500 font-medium'>Out of Stock</span>
              )}
            </div>

            {/* Quantity */}
            <div className='flex items-center gap-4'>
              <span className='font-medium text-gray-700'>Quantity:</span>
              <div className='flex items-center border rounded-lg'>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className='w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors'
                >
                  <Minus className='w-4 h-4' />
                </button>
                <span className='w-14 text-center font-semibold'>
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity(
                      Math.min(product.total_stock || 99, quantity + 1),
                    )
                  }
                  className='w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors'
                >
                  <Plus className='w-4 h-4' />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className='flex gap-4'>
              <button
                onClick={handleAddToCart}
                disabled={product.total_stock === 0}
                className='flex-1 flex items-center justify-center gap-2 py-4 border-2 border-orange-500 text-orange-500 font-bold rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <ShoppingCart className='w-5 h-5' />
                Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={product.total_stock === 0}
                className='flex-1 py-4 bg-linear-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Buy Now
              </button>
            </div>

            {/* Features */}
            <div className='grid grid-cols-2 gap-4 pt-4'>
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-lg'>
                <Truck className='w-5 h-5 text-orange-500' />
                <div>
                  <p className='font-medium text-sm'>Free Shipping</p>
                  <p className='text-xs text-gray-500'>Orders over €50</p>
                </div>
              </div>
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-lg'>
                <Shield className='w-5 h-5 text-orange-500' />
                <div>
                  <p className='font-medium text-sm'>2-Year Warranty</p>
                  <p className='text-xs text-gray-500'>Full coverage</p>
                </div>
              </div>
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-lg'>
                <RotateCcw className='w-5 h-5 text-orange-500' />
                <div>
                  <p className='font-medium text-sm'>30-Day Returns</p>
                  <p className='text-xs text-gray-500'>Easy returns</p>
                </div>
              </div>
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-lg'>
                <Clock className='w-5 h-5 text-orange-500' />
                <div>
                  <p className='font-medium text-sm'>Fast Delivery</p>
                  <p className='text-xs text-gray-500'>1-3 business days</p>
                </div>
              </div>
            </div>

            {/* SKU */}
            <p className='text-sm text-gray-500'>
              SKU: <span className='font-mono'>{product.sku}</span>
            </p>
          </div>
        </div>

        {/* Tabs Section */}
        <div className='mt-12'>
          <div className='border-b'>
            <div className='flex gap-8'>
              {[
                { id: 'description', label: 'Description', icon: Package },
                { id: 'specs', label: 'Specifications', icon: Award },
                { id: 'reviews', label: 'Reviews (128)', icon: MessageSquare },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    'flex items-center gap-2 py-4 border-b-2 font-medium transition-colors',
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-500'
                      : 'border-transparent text-gray-500 hover:text-gray-700',
                  )}
                >
                  <tab.icon className='w-5 h-5' />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className='py-8'>
            {activeTab === 'description' && (
              <div className='prose max-w-none'>
                <div className='bg-white rounded-xl p-6 shadow-sm'>
                  {/* Sourced-product descriptions are stored as HTML (AI-rewritten with
                      <p>/<ul>/<li> markup); manually-entered ones are plain text with no
                      tags, which renders identically through innerHTML as it would as a
                      plain string -- so this is safe for both, not sourcing-specific.
                      DOMPurify is required here, not optional: this HTML can originate
                      from a scraped third-party page (Alibaba/Amazon) via the sourcing
                      extension, so it's untrusted input reaching every visitor's browser. */}
                  <div
                    className='text-gray-700 leading-relaxed whitespace-pre-line [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-3'
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || '') }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className='bg-white rounded-xl p-6 shadow-sm'>
                <table className='w-full'>
                  <tbody className='divide-y'>
                    <tr>
                      <td className='py-3 text-gray-500 w-1/3'>Brand</td>
                      <td className='py-3 font-medium'>
                        {product.brand_name || '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className='py-3 text-gray-500'>Category</td>
                      <td className='py-3 font-medium'>
                        {product.category_name}
                      </td>
                    </tr>
                    <tr>
                      <td className='py-3 text-gray-500'>SKU</td>
                      <td className='py-3 font-mono'>{product.sku}</td>
                    </tr>
                    <tr>
                      <td className='py-3 text-gray-500'>Weight</td>
                      <td className='py-3 font-medium'>
                        {product.weight} {product.weight_unit}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className='space-y-6'>
                {/* Review Summary */}
                <div className='bg-white rounded-xl p-6 shadow-sm'>
                  <div className='flex flex-col md:flex-row md:items-center gap-6'>
                    <div className='text-center'>
                      <div className='text-5xl font-bold text-gray-900'>
                        4.5
                      </div>
                      <div className='flex items-center justify-center gap-1 mt-2'>
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'w-5 h-5',
                              i < 4
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300',
                            )}
                          />
                        ))}
                      </div>
                      <p className='text-sm text-gray-500 mt-1'>
                        Based on 128 reviews
                      </p>
                    </div>
                    <div className='flex-1 space-y-2'>
                      {[5, 4, 3, 2, 1].map((stars) => (
                        <div key={stars} className='flex items-center gap-3'>
                          <span className='text-sm text-gray-500 w-6'>
                            {stars}★
                          </span>
                          <div className='flex-1 h-2 bg-gray-200 rounded-full overflow-hidden'>
                            <div
                              className='h-full bg-yellow-400 rounded-full'
                              style={{
                                width: `${
                                  stars === 5
                                    ? 60
                                    : stars === 4
                                    ? 25
                                    : stars === 3
                                    ? 10
                                    : 3
                                }%`,
                              }}
                            />
                          </div>
                          <span className='text-sm text-gray-500 w-10'>
                            {stars === 5
                              ? '60%'
                              : stars === 4
                              ? '25%'
                              : stars === 3
                              ? '10%'
                              : '3%'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sample Reviews */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className='bg-white rounded-xl p-6 shadow-sm'>
                    <div className='flex items-start gap-4'>
                      <div className='w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold'>
                        {String.fromCharCode(64 + i)}
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>Customer {i}</span>
                          <span className='text-sm text-gray-500'>
                            • 2 weeks ago
                          </span>
                        </div>
                        <div className='flex items-center gap-1 mt-1'>
                          {[...Array(5)].map((_, j) => (
                            <Star
                              key={j}
                              className={cn(
                                'w-4 h-4',
                                j < 5 - (i - 1)
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300',
                              )}
                            />
                          ))}
                        </div>
                        <p className='text-gray-700 mt-3'>
                          Great product! Exactly as described. Fast shipping and
                          well packaged. Would definitely recommend to others.
                        </p>
                        <div className='flex items-center gap-4 mt-4'>
                          <button className='flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500'>
                            <ThumbsUp className='w-4 h-4' />
                            Helpful (12)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className='mt-12'>
            <h2 className='text-2xl font-bold text-gray-900 mb-6'>
              You May Also Like
            </h2>
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
              {relatedProducts.slice(0, 4).map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
