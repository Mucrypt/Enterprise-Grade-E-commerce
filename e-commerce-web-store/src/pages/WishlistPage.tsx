// ============================================
// Wishlist Page - User's Saved Products
// ============================================

import { Link } from 'react-router-dom'
import {
  Heart,
  ShoppingCart,
  Trash2,
  Share2,
  AlertCircle,
  ChevronRight,
  Grid,
  List,
} from 'lucide-react'
import { useWishlistStore, useCartStore } from '../stores'
import { cn, formatPrice, calculateDiscount, getProductImage } from '../utils'
import { useState } from 'react'

export default function WishlistPage() {
  const { items, removeItem, clearWishlist } = useWishlistStore()
  const { addItem: addToCart } = useCartStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const handleMoveToCart = (product: (typeof items)[0]) => {
    addToCart(product, 1)
    removeItem(product.id)
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My TechTools Wishlist',
        text: `Check out my wishlist with ${items.length} items!`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  if (items.length === 0) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-2xl shadow-sm p-12 text-center'>
            <div className='w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6'>
              <Heart className='w-12 h-12 text-red-300' />
            </div>
            <h1 className='text-2xl font-bold text-gray-900 mb-2'>
              Your Wishlist is Empty
            </h1>
            <p className='text-gray-500 mb-8 max-w-md mx-auto'>
              Save your favorite items here to buy later or share with friends
              and family.
            </p>
            <Link
              to='/products'
              className='inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all'
            >
              Start Shopping
              <ChevronRight className='w-5 h-5' />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-6xl mx-auto px-4'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>My Wishlist</h1>
            <p className='text-gray-500'>
              {items.length} item{items.length > 1 ? 's' : ''} saved
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <button
              onClick={handleShare}
              className='flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors'
            >
              <Share2 className='w-4 h-4' />
              Share
            </button>
            <button
              onClick={clearWishlist}
              className='flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-colors'
            >
              <Trash2 className='w-4 h-4' />
              Clear All
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className='flex items-center justify-end gap-2 mb-4'>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              viewMode === 'grid'
                ? 'bg-orange-100 text-orange-600'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <Grid className='w-5 h-5' />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              viewMode === 'list'
                ? 'bg-orange-100 text-orange-600'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <List className='w-5 h-5' />
          </button>
        </div>

        {/* Products */}
        {viewMode === 'grid' ? (
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
            {items.map((product) => {
              const discount = calculateDiscount(
                product.base_price,
                product.sale_price || 0,
              )

              return (
                <div
                  key={product.id}
                  className='bg-white rounded-xl shadow-sm overflow-hidden group'
                >
                  <div className='relative aspect-square'>
                    <Link to={`/product/${product.slug}`}>
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                      />
                    </Link>
                    {discount > 0 && (
                      <span className='absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded'>
                        -{discount}%
                      </span>
                    )}
                    <button
                      onClick={() => removeItem(product.id)}
                      className='absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-sm'
                    >
                      <Heart className='w-4 h-4 fill-current' />
                    </button>
                    {product.total_stock === 0 && (
                      <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
                        <span className='px-3 py-1 bg-white text-gray-900 text-sm font-medium rounded'>
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                  <div className='p-4'>
                    <Link
                      to={`/product/${product.slug}`}
                      className='font-medium text-gray-900 line-clamp-2 hover:text-orange-500 transition-colors mb-2 block'
                    >
                      {product.name}
                    </Link>
                    <div className='flex items-baseline gap-2 mb-3'>
                      <span className='text-lg font-bold text-orange-600'>
                        {formatPrice(product.sale_price || product.base_price)}
                      </span>
                      {product.sale_price && (
                        <span className='text-sm text-gray-400 line-through'>
                          {formatPrice(product.base_price)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleMoveToCart(product)}
                      disabled={product.total_stock === 0}
                      className='w-full flex items-center justify-center gap-2 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <ShoppingCart className='w-4 h-4' />
                      Move to Cart
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className='space-y-4'>
            {items.map((product) => {
              const discount = calculateDiscount(
                product.base_price,
                product.sale_price || 0,
              )

              return (
                <div
                  key={product.id}
                  className='bg-white rounded-xl shadow-sm p-4 flex items-center gap-4'
                >
                  <div className='relative w-24 h-24 shrink-0'>
                    <Link to={`/product/${product.slug}`}>
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className='w-full h-full object-cover rounded-lg'
                      />
                    </Link>
                    {discount > 0 && (
                      <span className='absolute -top-2 -left-2 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded'>
                        -{discount}%
                      </span>
                    )}
                  </div>

                  <div className='flex-1 min-w-0'>
                    <Link
                      to={`/product/${product.slug}`}
                      className='font-medium text-gray-900 hover:text-orange-500 transition-colors block truncate'
                    >
                      {product.name}
                    </Link>
                    {product.brand_name && (
                      <p className='text-sm text-gray-500'>
                        {product.brand_name}
                      </p>
                    )}
                    <div className='flex items-center gap-2 mt-1'>
                      {product.total_stock > 0 ? (
                        <span className='text-sm text-green-600'>In Stock</span>
                      ) : (
                        <span className='flex items-center gap-1 text-sm text-red-500'>
                          <AlertCircle className='w-3 h-3' />
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className='text-right'>
                    <div className='flex items-baseline gap-2 justify-end'>
                      <span className='text-lg font-bold text-orange-600'>
                        {formatPrice(product.sale_price || product.base_price)}
                      </span>
                      {product.sale_price && (
                        <span className='text-sm text-gray-400 line-through'>
                          {formatPrice(product.base_price)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className='flex items-center gap-2'>
                    <button
                      onClick={() => handleMoveToCart(product)}
                      disabled={product.total_stock === 0}
                      className='flex items-center gap-2 px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <ShoppingCart className='w-4 h-4' />
                      Add to Cart
                    </button>
                    <button
                      onClick={() => removeItem(product.id)}
                      className='p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors'
                    >
                      <Trash2 className='w-5 h-5' />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Summary */}
        <div className='mt-8 bg-white rounded-xl shadow-sm p-6'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
            <div>
              <p className='text-gray-500'>Wishlist Total</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatPrice(
                  items.reduce(
                    (sum, item) => sum + Number(item.sale_price || item.base_price),
                    0,
                  ),
                )}
              </p>
              {items.some((item) => item.sale_price) && (
                <p className='text-sm text-green-600'>
                  You save{' '}
                  {formatPrice(
                    items.reduce(
                      (sum, item) =>
                        sum +
                        (item.sale_price
                          ? Number(item.base_price) - Number(item.sale_price)
                          : 0),
                      0,
                    ),
                  )}{' '}
                  with current discounts!
                </p>
              )}
            </div>
            <button
              onClick={() => {
                items.forEach((item) => {
                  if (item.total_stock > 0) {
                    addToCart(item, 1)
                  }
                })
              }}
              className='flex items-center gap-2 px-6 py-3 bg-linear-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all'
            >
              <ShoppingCart className='w-5 h-5' />
              Add All to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
