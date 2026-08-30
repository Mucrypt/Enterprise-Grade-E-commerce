// ============================================
// Promo Product Card
//
// A punchier card for promotional placements (the Hot Right Now
// drawer today, other promo surfaces later) -- real product data only
// (same getProductImage/formatPrice/calculateDiscount utils and real
// cart integration as ToolProductCard), with a GSAP-driven hover lift
// instead of the plain CSS hover used elsewhere, plus a "HOT" ribbon
// distinct from the plain discount badge. Deliberately a separate
// component from ToolProductCard/ProductCard so promo-specific styling
// never risks the listing/detail pages.
// ============================================

import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Flame } from 'lucide-react'
import gsap from 'gsap'
import { useCartStore } from '../../stores'
import { formatPrice, calculateDiscount, getProductImage } from '../../utils'
import type { Product } from '../../types'

interface PromoProductCardProps {
  product: Product
}

export default function PromoProductCard({ product }: PromoProductCardProps) {
  const { addItem } = useCartStore()
  const cardRef = useRef<HTMLDivElement>(null)

  const discount = calculateDiscount(product.base_price, product.sale_price || 0)
  const inStock = product.total_stock > 0

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    addItem(product, 1)
  }

  const handleEnter = () => {
    if (!cardRef.current) return
    gsap.to(cardRef.current, {
      y: -6,
      scale: 1.02,
      boxShadow: '0 20px 30px -12px rgba(0,0,0,0.25)',
      duration: 0.35,
      ease: 'power3.out',
    })
  }

  const handleLeave = () => {
    if (!cardRef.current) return
    gsap.to(cardRef.current, {
      y: 0,
      scale: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      duration: 0.4,
      ease: 'power3.out',
    })
  }

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className='group flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white'
      style={{ willChange: 'transform' }}
    >
      <Link
        to={`/product/${product.slug}`}
        className='relative block aspect-square overflow-hidden bg-slate-100'
      >
        <img
          src={getProductImage(product, { w: 320, h: 320 })}
          alt={product.name}
          loading='lazy'
          className='h-full w-full object-cover'
        />
        <span className='absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white'>
          <Flame className='h-3 w-3 fill-orange-500 text-orange-500' aria-hidden='true' />
          Hot
        </span>
        {discount > 0 && (
          <span className='absolute right-2.5 top-2.5 rounded-full bg-orange-500 px-2 py-1 text-[10px] font-bold text-white'>
            -{discount}%
          </span>
        )}
      </Link>

      <div className='flex flex-1 flex-col p-3'>
        <Link to={`/product/${product.slug}`}>
          <h3 className='line-clamp-2 min-h-9 text-xs font-bold text-slate-900 group-hover:text-orange-600'>
            {product.name}
          </h3>
        </Link>

        <div className='mt-2 flex items-baseline gap-1.5'>
          {product.sale_price ? (
            <>
              <span className='text-base font-black text-slate-900'>
                {formatPrice(product.sale_price)}
              </span>
              <span className='text-xs text-slate-400 line-through'>
                {formatPrice(product.base_price)}
              </span>
            </>
          ) : (
            <span className='text-base font-black text-slate-900'>
              {formatPrice(product.base_price)}
            </span>
          )}
        </div>

        <button
          type='button'
          onClick={handleAddToCart}
          disabled={!inStock}
          className='mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300'
        >
          <ShoppingCart className='h-3.5 w-3.5' aria-hidden='true' />
          {inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  )
}
