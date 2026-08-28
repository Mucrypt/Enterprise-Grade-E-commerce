import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Minus, Plus, ShoppingCart, X } from 'lucide-react'
import type { Product, ProductMedia } from '../../types'
import { useCartStore } from '../../stores'
import { getDisplayPricing } from '../../utils/pricing'
import { formatPrice, getProductImage } from '../../utils'
import { RatingSummary } from './RatingSummary'
import { Badge } from '../ui/Badge'

interface QuickViewProps {
  product: Product
  onClose: () => void
}

// Deliberately lightweight -- reuses data already on the product object
// from the listing grid (no extra fetch, no full PDP data like reviews or
// specifications) so it opens instantly. "View Full Details" is the path
// to everything this modal intentionally leaves out.
export function QuickView({ product, onClose }: QuickViewProps) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const { addItem } = useCartStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const pricing = getDisplayPricing(product.base_price, product.sale_price)
  const outOfStock = product.total_stock <= 0

  const galleryItems: ProductMedia[] = product.media?.length
    ? product.media
    : product.images?.length
      ? product.images.map((img) => ({ ...img, type: 'image' as const, position: img.display_order || 0 }))
      : [{ url: getProductImage(product), is_primary: true, id: '1', alt_text: product.name, position: 0, type: 'image' as const }]

  const handleAddToCart = () => {
    addItem(product, quantity)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick view: ${product.name}`}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow hover:bg-gray-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
              <img
                src={galleryItems[selectedImage]?.url}
                alt={galleryItems[selectedImage]?.alt_text || product.name}
                className="h-full w-full object-contain"
              />
            </div>
            {galleryItems.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {galleryItems.slice(0, 5).map((item, index) => (
                  <button
                    key={item.id || index}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                      selectedImage === index ? 'border-orange-500' : 'border-transparent'
                    }`}
                  >
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {product.brand_name && <p className="text-sm font-medium text-orange-500">{product.brand_name}</p>}
            <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>

            <RatingSummary averageRating={product.average_rating} reviewCount={product.review_count} />

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-orange-600">{formatPrice(pricing.sellingPrice)}</span>
              {pricing.compareAtPrice !== null && (
                <>
                  <span className="text-sm text-gray-400 line-through">{formatPrice(pricing.compareAtPrice)}</span>
                  <Badge variant="sale">-{pricing.discountPercent}%</Badge>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              {outOfStock ? (
                <span className="font-medium text-red-500">Out of Stock</span>
              ) : (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-600">In Stock</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Quantity:</span>
              <div className="flex items-center rounded-lg border">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center hover:bg-gray-100"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-semibold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.total_stock || 99, q + 1))}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center hover:bg-gray-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={outOfStock}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </button>
              <Link
                to={`/product/${product.slug}`}
                onClick={onClose}
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-gray-200 py-3 font-semibold text-gray-700 hover:bg-gray-50"
              >
                View Full Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
