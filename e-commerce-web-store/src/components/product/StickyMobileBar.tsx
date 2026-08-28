import { ShoppingCart } from 'lucide-react'
import { formatPrice } from '../../utils'

interface StickyMobileBarProps {
  sellingPrice: number
  outOfStock: boolean
  onAddToCart: () => void
  onBuyNow: () => void
}

export function StickyMobileBar({ sellingPrice, outOfStock, onAddToCart, onBuyNow }: StickyMobileBarProps) {
  return (
    <div className='fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-white p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] sm:hidden'>
      <span className='shrink-0 text-lg font-bold text-orange-600'>{formatPrice(sellingPrice)}</span>
      <button
        type='button'
        onClick={onAddToCart}
        disabled={outOfStock}
        aria-label='Add to cart'
        className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-orange-500 text-orange-500 disabled:cursor-not-allowed disabled:opacity-50'
      >
        <ShoppingCart className='h-5 w-5' />
      </button>
      <button
        type='button'
        onClick={onBuyNow}
        disabled={outOfStock}
        className='h-12 flex-1 rounded-xl bg-linear-to-r from-orange-500 to-red-500 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50'
      >
        Buy Now
      </button>
    </div>
  )
}
