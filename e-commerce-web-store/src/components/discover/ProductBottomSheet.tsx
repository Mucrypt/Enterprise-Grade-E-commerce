// ============================================
// Discover Product Bottom Sheet
// ============================================
// Opens over the feed without navigating away -- the founder's explicit
// requirement ("the product button should not immediately throw users
// away from the feed"). Same hand-rolled fixed-overlay convention as
// CartDrawer.tsx, just a bottom slide-up panel instead of a right
// slide-in one. Reuses PurchasePanel.tsx (variant/quantity/add-to-cart)
// and DeliveryEstimate.tsx verbatim -- the exact same real components the
// full product page uses, not a re-implementation.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, ArrowRight } from 'lucide-react'
import type { Product, ProductVariant } from '../../types'
import { PurchasePanel } from '../product/PurchasePanel'
import DeliveryEstimate from '../product/DeliveryEstimate'
import { useCartStore } from '../../stores'
import { discoverApi } from '../../api'
import { getEventTracker } from '../../services/event-tracking'
import { formatPrice, getProductImage, cn } from '../../utils'

interface ProductBottomSheetProps {
  products: Product[]
  initialProductId?: string
  discoverPostId: string
  onClose: () => void
}

export default function ProductBottomSheet({
  products,
  initialProductId,
  discoverPostId,
  onClose,
}: ProductBottomSheetProps) {
  const addItem = useCartStore((s) => s.addItem)
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || products[0]?.id,
  )
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

  const product = products.find((p) => p.id === selectedProductId) || products[0]
  const variants = product?.variations || []

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId)
    setQuantity(1)
    setSelectedVariant(null)
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!product) return null

  const handleAddToCart = () => {
    addItem(product, quantity, selectedVariant || undefined, discoverPostId)
    getEventTracker().trackAddToCart(
      product.id,
      product.name,
      Number(product.sale_price ?? product.base_price),
      quantity,
    )
    discoverApi.trackAddToCart(discoverPostId).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-100">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl animate-slide-up-sheet">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
          <span className="font-semibold text-gray-900">
            {products.length > 1 ? `${products.length} Products` : 'Product'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {products.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-b px-4 py-3">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProduct(p.id)}
                className={cn(
                  'shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                  p.id === selectedProductId ? 'border-orange-500' : 'border-transparent',
                )}
              >
                <img
                  src={getProductImage(p, { w: 64, h: 64 })}
                  alt={p.name}
                  className="h-16 w-16 object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div className="p-4">
          <div className="flex gap-4">
            <img
              src={getProductImage(product, { w: 200, h: 200 })}
              alt={product.name}
              className="h-28 w-28 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 line-clamp-2">{product.name}</h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black text-orange-600">
                  {formatPrice(product.sale_price ?? product.base_price)}
                </span>
                {!!product.sale_price && (
                  <span className="text-sm text-gray-400 line-through">
                    {formatPrice(product.base_price)}
                  </span>
                )}
              </div>
              <Link
                to={`/product/${product.slug}`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-orange-600"
              >
                View full details
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <DeliveryEstimate productId={product.id} />
          </div>

          <div className="mt-4">
            <PurchasePanel
              product={product}
              quantity={quantity}
              onQuantityChange={setQuantity}
              variants={variants}
              selectedVariant={selectedVariant}
              onSelectVariant={setSelectedVariant}
              onAddToCart={handleAddToCart}
              onBuyNow={handleAddToCart}
            />
          </div>

          {/* PurchasePanel's own action row is hidden on mobile (sm:flex) --
              this feed is mobile-first, so a always-visible sticky Add to
              Cart button matches the "product button stays visible" spec. */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-4 font-bold text-white transition-colors hover:bg-orange-600 sm:hidden"
          >
            Add to Cart -- {formatPrice((Number(product.sale_price ?? product.base_price) + Number(selectedVariant?.price_adjustment ?? 0)) * quantity)}
          </button>
        </div>
      </div>
    </div>
  )
}
