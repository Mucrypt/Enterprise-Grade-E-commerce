// ============================================
// Full Cart Page
// ============================================

import { Link, useNavigate } from 'react-router-dom'
import { useCallback } from 'react'
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ChevronRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Tag,
  ArrowLeft,
} from 'lucide-react'
import { useCartStore } from '../stores'
import { formatPrice, getProductImage, cn } from '../utils'
import { useEventTracking } from '../hooks/useEventTracking'

export default function CartPage() {
  const navigate = useNavigate()
  const { items, updateQuantity, removeItem, getSubtotal, clearCart } =
    useCartStore()
  const { trackAddToCart, trackRemoveFromCart, trackCheckoutStart } =
    useEventTracking()

  const subtotal = getSubtotal()
  const shipping = subtotal >= 50 ? 0 : 5.99
  const tax = subtotal * 0.21 // 21% VAT
  const total = subtotal + shipping + tax

  if (items.length === 0) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center px-4 py-16'>
        <div className='w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6'>
          <ShoppingBag className='w-12 h-12 text-gray-400' />
        </div>
        <h1 className='text-2xl font-bold text-gray-900 mb-2'>
          Your cart is empty
        </h1>
        <p className='text-gray-600 mb-8 text-center max-w-md'>
          Looks like you haven't added anything to your cart yet. Start shopping
          and find great deals!
        </p>
        <Link
          to='/products'
          className='inline-flex items-center gap-2 px-8 py-3 bg-orange-500 text-white font-semibold rounded-full hover:bg-orange-600 transition-colors'
        >
          Start Shopping
          <ChevronRight className='w-5 h-5' />
        </Link>
      </div>
    )
  }

  return (
    <div className='bg-gray-50 min-h-screen py-8'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='flex items-center justify-between mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Shopping Cart</h1>
            <p className='text-gray-600 mt-1'>
              {items.length} item{items.length !== 1 ? 's' : ''} in your cart
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className='flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors'
          >
            <ArrowLeft className='w-5 h-5' />
            Continue Shopping
          </button>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Cart Items */}
          <div className='lg:col-span-2 space-y-4'>
            {items.map((item) => {
              const price = Number(
                item.product.sale_price || item.product.base_price,
              )
              const itemTotal = price * item.quantity

              return (
                <div
                  key={item.id}
                  className='bg-white rounded-xl p-4 sm:p-6 shadow-sm flex gap-4'
                >
                  {/* Product Image */}
                  <Link
                    to={`/product/${item.product.slug}`}
                    className='shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 rounded-lg overflow-hidden'
                  >
                    <img
                      src={getProductImage(item.product, { w: 128, h: 128 })}
                      alt={item.product.name}
                      className='w-full h-full object-cover hover:scale-105 transition-transform'
                    />
                  </Link>

                  {/* Product Details */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex justify-between gap-4'>
                      <div>
                        <Link
                          to={`/product/${item.product.slug}`}
                          className='font-semibold text-gray-900 hover:text-orange-500 transition-colors line-clamp-2'
                        >
                          {item.product.name}
                        </Link>
                        {item.product.brand_name && (
                          <p className='text-sm text-gray-500 mt-1'>
                            {item.product.brand_name}
                          </p>
                        )}
                        {item.variant && (
                          <p className='text-sm text-gray-500'>
                            {Object.entries(item.variant.attributes || {}).map(
                              ([key, value]) => (
                                <span key={key}>
                                  {key}: {value}
                                </span>
                              ),
                            )}
                          </p>
                        )}
                      </div>
                      <div className='text-right'>
                        <p className='font-bold text-lg text-gray-900'>
                          {formatPrice(itemTotal)}
                        </p>
                        {item.product.sale_price && (
                          <p className='text-sm text-gray-400 line-through'>
                            {formatPrice(
                              Number(item.product.base_price) * item.quantity,
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity & Actions */}
                    <div className='flex items-center justify-between mt-4'>
                      <div className='flex items-center gap-2'>
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              updateQuantity(item.id, item.quantity - 1)
                              const price = Number(
                                item.product.sale_price ||
                                  item.product.base_price,
                              )
                              trackRemoveFromCart(
                                item.product.id,
                                item.product.name,
                                item.product.sku || '',
                                price,
                                1,
                              )
                            }
                          }}
                          className='w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
                        >
                          <Minus className='w-4 h-4' />
                        </button>
                        <span className='w-10 text-center font-medium'>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => {
                            updateQuantity(item.id, item.quantity + 1)
                            const price = Number(
                              item.product.sale_price ||
                                item.product.base_price,
                            )
                            trackAddToCart(
                              item.product.id,
                              item.product.name,
                              item.product.sku || '',
                              price,
                              1,
                            )
                          }}
                          className='w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
                        >
                          <Plus className='w-4 h-4' />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          removeItem(item.id)
                          const price = Number(
                            item.product.sale_price || item.product.base_price,
                          )
                          trackRemoveFromCart(
                            item.product.id,
                            item.product.name,
                            item.product.sku || '',
                            price,
                            item.quantity,
                          )
                        }}
                        className='flex items-center gap-1 text-red-500 hover:text-red-600 text-sm font-medium transition-colors'
                      >
                        <Trash2 className='w-4 h-4' />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Clear Cart */}
            <button
              onClick={clearCart}
              className='text-red-500 hover:text-red-600 text-sm font-medium'
            >
              Clear entire cart
            </button>
          </div>

          {/* Order Summary */}
          <div className='lg:col-span-1'>
            <div className='bg-white rounded-xl p-6 shadow-sm sticky top-24'>
              <h2 className='text-lg font-bold text-gray-900 mb-4'>
                Order Summary
              </h2>

              {/* Coupon Code */}
              <div className='mb-6'>
                <div className='flex gap-2'>
                  <div className='relative flex-1'>
                    <Tag className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                    <input
                      type='text'
                      placeholder='Enter coupon code'
                      className='w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                    />
                  </div>
                  <button className='px-4 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors'>
                    Apply
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Subtotal</span>
                  <span className='font-medium'>{formatPrice(subtotal)}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Shipping</span>
                  <span
                    className={cn(
                      'font-medium',
                      shipping === 0 && 'text-green-600',
                    )}
                  >
                    {shipping === 0 ? 'FREE' : formatPrice(shipping)}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>VAT (21%)</span>
                  <span className='font-medium'>{formatPrice(tax)}</span>
                </div>
                <div className='border-t pt-3 mt-3'>
                  <div className='flex justify-between'>
                    <span className='text-lg font-bold text-gray-900'>
                      Total
                    </span>
                    <span className='text-lg font-bold text-orange-500'>
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Free Shipping Progress */}
              {subtotal < 50 && (
                <div className='mt-4 p-3 bg-orange-50 rounded-lg'>
                  <p className='text-sm text-orange-800'>
                    Add{' '}
                    <span className='font-bold'>
                      {formatPrice(50 - subtotal)}
                    </span>{' '}
                    more for FREE shipping!
                  </p>
                  <div className='mt-2 h-2 bg-orange-200 rounded-full overflow-hidden'>
                    <div
                      className='h-full bg-orange-500 transition-all'
                      style={{
                        width: `${Math.min((subtotal / 50) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={() => {
                  trackCheckoutStart(subtotal, items.length, 'EUR')
                  navigate('/checkout')
                }}
                className='mt-6 w-full flex items-center justify-center gap-2 py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors'
              >
                Proceed to Checkout
                <ChevronRight className='w-5 h-5' />
              </button>

              {/* Trust Badges */}
              <div className='mt-6 grid grid-cols-3 gap-2 text-center'>
                <div className='p-2'>
                  <ShieldCheck className='w-6 h-6 mx-auto text-green-600 mb-1' />
                  <p className='text-xs text-gray-600'>Secure Checkout</p>
                </div>
                <div className='p-2'>
                  <Truck className='w-6 h-6 mx-auto text-blue-600 mb-1' />
                  <p className='text-xs text-gray-600'>Fast Delivery</p>
                </div>
                <div className='p-2'>
                  <RotateCcw className='w-6 h-6 mx-auto text-orange-600 mb-1' />
                  <p className='text-xs text-gray-600'>Easy Returns</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
