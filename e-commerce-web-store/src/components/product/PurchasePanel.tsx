import { Check, Minus, Plus, ShoppingCart } from 'lucide-react'
import type { Product, ProductVariant } from '../../types'
import { cn } from '../../utils'

interface PurchasePanelProps {
  product: Product
  quantity: number
  onQuantityChange: (quantity: number) => void
  variants: ProductVariant[]
  selectedVariant: ProductVariant | null
  onSelectVariant: (variant: ProductVariant | null) => void
  onAddToCart: () => void
  onBuyNow: () => void
}

export function PurchasePanel({
  product,
  quantity,
  onQuantityChange,
  variants,
  selectedVariant,
  onSelectVariant,
  onAddToCart,
  onBuyNow,
}: PurchasePanelProps) {
  const availableStock = selectedVariant ? selectedVariant.stock : product.total_stock
  const outOfStock = availableStock <= 0

  return (
    <div className='space-y-6 lg:sticky lg:top-24'>
      {/* Stock status -- real, from product.total_stock / variant.stock */}
      <div className='flex items-center gap-2'>
        {availableStock > 0 ? (
          <>
            <Check className='h-5 w-5 text-green-500' />
            <span className='font-medium text-green-600'>In Stock</span>
            {availableStock < 20 && (
              <span className='text-sm text-orange-500'>(Only {availableStock} left!)</span>
            )}
          </>
        ) : (
          <span className='font-medium text-red-500'>Out of Stock</span>
        )}
      </div>

      {variants.length > 0 && (
        <div>
          <span className='mb-2 block font-medium text-gray-700'>Options:</span>
          <div className='flex flex-wrap gap-2'>
            {variants.map((variant) => (
              <button
                key={variant.id}
                type='button'
                onClick={() => onSelectVariant(variant)}
                disabled={variant.stock <= 0}
                aria-pressed={selectedVariant?.id === variant.id}
                className={cn(
                  'rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  selectedVariant?.id === variant.id
                    ? 'border-orange-500 bg-orange-50 text-orange-600'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300',
                )}
              >
                {variant.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className='flex items-center gap-4'>
        <span className='font-medium text-gray-700'>Quantity:</span>
        <div className='flex items-center rounded-lg border'>
          <button
            type='button'
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            aria-label='Decrease quantity'
            className='flex h-10 w-10 items-center justify-center transition-colors hover:bg-gray-100'
          >
            <Minus className='h-4 w-4' />
          </button>
          <span className='w-14 text-center font-semibold' aria-live='polite'>
            {quantity}
          </span>
          <button
            type='button'
            onClick={() => onQuantityChange(Math.min(availableStock || 99, quantity + 1))}
            aria-label='Increase quantity'
            className='flex h-10 w-10 items-center justify-center transition-colors hover:bg-gray-100'
          >
            <Plus className='h-4 w-4' />
          </button>
        </div>
      </div>

      <div className='hidden gap-4 sm:flex'>
        <button
          type='button'
          onClick={onAddToCart}
          disabled={outOfStock}
          className='flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-orange-500 py-4 font-bold text-orange-500 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <ShoppingCart className='h-5 w-5' />
          Add to Cart
        </button>
        <button
          type='button'
          onClick={onBuyNow}
          disabled={outOfStock}
          className='flex-1 rounded-xl bg-linear-to-r from-orange-500 to-red-500 py-4 font-bold text-white transition-colors hover:from-orange-600 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-50'
        >
          Buy Now
        </button>
      </div>
    </div>
  )
}
