// ============================================
// Tool Product Card - homepage-only presentation
//
// This is a separate, homepage-scoped component. It does
// NOT modify or wrap the shared src/components/common/
// ProductCard.tsx used on the product listing and product
// detail pages, so there is zero regression risk on those
// pages. Unlike the shared card, this one never renders a
// hardcoded rating/review count - it only shows rating
// data when the product API actually returns it.
// ============================================

import { Link } from 'react-router-dom'
import { ShoppingCart, Star } from 'lucide-react'
import { useCartStore } from '../../stores'
import { formatPrice, calculateDiscount, getProductImage } from '../../utils'
import type { Product } from '../../types'

interface ToolProductCardProps {
  product: Product
}

export default function ToolProductCard({ product }: ToolProductCardProps) {
  const { addItem } = useCartStore()

  const discount = calculateDiscount(product.base_price, product.sale_price || 0)
  const inStock = product.total_stock > 0
  const rating =
    typeof product.average_rating === 'string'
      ? parseFloat(product.average_rating)
      : product.average_rating
  const reviewCount =
    typeof product.review_count === 'string'
      ? parseInt(product.review_count, 10)
      : product.review_count
  const hasRealRating = !!rating && !!reviewCount && reviewCount > 0

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    addItem(product, 1)
  }

  return (
    <div className='group flex h-full flex-col rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-900'>
      <Link
        to={`/product/${product.slug}`}
        className='relative block aspect-square overflow-hidden bg-slate-100'
      >
        <img
          src={getProductImage(product, { w: 400, h: 400 })}
          alt={product.name}
          loading='lazy'
          className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
        />
        {discount > 0 && (
          <span className='absolute left-3 top-3 rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white'>
            -{discount}%
          </span>
        )}
        {!inStock && (
          <span className='absolute left-3 top-3 rounded bg-slate-700 px-2 py-1 text-xs font-bold text-white'>
            Out of Stock
          </span>
        )}
      </Link>

      <div className='flex flex-1 flex-col p-4'>
        <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
          {product.category_name}
        </p>

        <Link to={`/product/${product.slug}`}>
          <h3 className='mt-1 line-clamp-2 min-h-10 text-sm font-bold text-slate-900 group-hover:text-orange-600'>
            {product.name}
          </h3>
        </Link>

        {hasRealRating && (
          <div className='mt-1.5 flex items-center gap-1'>
            <Star
              className='h-3.5 w-3.5 fill-orange-400 text-orange-400'
              aria-hidden='true'
            />
            <span className='text-xs font-medium text-slate-700'>
              {rating?.toFixed(1)}
            </span>
            <span className='text-xs text-slate-400'>({reviewCount})</span>
          </div>
        )}

        <div className='mt-3 flex items-baseline gap-2'>
          {product.sale_price ? (
            <>
              <span className='text-lg font-black text-slate-900'>
                {formatPrice(product.sale_price)}
              </span>
              <span className='text-sm text-slate-400 line-through'>
                {formatPrice(product.base_price)}
              </span>
            </>
          ) : (
            <span className='text-lg font-black text-slate-900'>
              {formatPrice(product.base_price)}
            </span>
          )}
        </div>

        <p
          className={
            inStock
              ? 'mt-1 text-xs font-medium text-emerald-600'
              : 'mt-1 text-xs font-medium text-slate-500'
          }
        >
          {inStock ? 'In Stock' : 'Out of Stock'}
        </p>

        <button
          type='button'
          onClick={handleAddToCart}
          disabled={!inStock}
          className='mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300'
        >
          <ShoppingCart className='h-4 w-4' aria-hidden='true' />
          {inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  )
}
