// ============================================
// Cart Drawer Component (Slide-out Cart)
// ============================================

import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
  X,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Truck,
  Tag,
} from 'lucide-react';
import { useCartStore } from '../../stores';
import { formatPrice, getProductImage } from '../../utils';
import { useFreeShippingThreshold } from '../../hooks/useFreeShippingThreshold';

export default function CartDrawer() {
  const { t } = useTranslation(['cart', 'common']);
  const { items, isOpen, closeCart, removeItem, updateQuantity, getSubtotal } = useCartStore();

  // Real, admin-configured threshold (shipping_settings.free_shipping_threshold)
  // -- this used to be a hand-typed constant, disconnected from the actual
  // rule the backend applies at checkout. Falls back to the same figure
  // while the fetch is in flight.
  const freeShippingThreshold = useFreeShippingThreshold() ?? 50;
  const subtotal = getSubtotal();
  const shippingProgress = Math.min((subtotal / freeShippingThreshold) * 100, 100);
  const amountToFreeShipping = Math.max(freeShippingThreshold - subtotal, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            {t('title')}
            <span className="text-sm font-normal text-gray-500">
              ({t('itemCount', { count: items.length })})
            </span>
          </h2>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress */}
        {items.length > 0 && (
          <div className="p-4 bg-linear-to-r from-orange-50 to-yellow-50 border-b">
            {amountToFreeShipping > 0 ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="w-4 h-4 text-orange-500" />
                  <span>
                    <Trans
                      i18nKey="freeShippingProgress"
                      ns="cart"
                      values={{ amount: formatPrice(amountToFreeShipping) }}
                      components={{ 1: <span className="font-semibold text-orange-600" /> }}
                    />
                  </span>
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <Truck className="w-4 h-4" />
                {t('freeShippingUnlocked')}
              </div>
            )}
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingBag className="w-12 h-12 text-gray-300" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('empty')}
              </h3>
              <p className="text-gray-500 mb-6">
                {t('emptyDescription')}
              </p>
              <Link
                to="/shop"
                onClick={closeCart}
                className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                {t('startShopping')}
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const price = item.product.sale_price || item.product.base_price;
                const hasDiscount = item.product.sale_price && item.product.sale_price < item.product.base_price;

                return (
                  <li key={item.id} className="p-4 flex gap-4">
                    {/* Product Image */}
                    <Link
                      to={`/product/${item.product.slug}`}
                      onClick={closeCart}
                      className="w-20 h-20 shrink-0 bg-gray-100 rounded-lg overflow-hidden"
                    >
                      <img
                        src={getProductImage(item.product, { w: 80, h: 80 })}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </Link>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/product/${item.product.slug}`}
                        onClick={closeCart}
                        className="font-medium text-gray-900 hover:text-orange-600 line-clamp-2 transition-colors"
                      >
                        {item.product.name}
                      </Link>

                      {item.variant && (
                        <p className="text-sm text-gray-500 mt-1">
                          {item.variant.name}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-semibold text-orange-600">
                          {formatPrice(price)}
                        </span>
                        {hasDiscount && (
                          <span className="text-sm text-gray-400 line-through">
                            {formatPrice(item.product.base_price)}
                          </span>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border rounded-lg">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-2 hover:bg-gray-100 transition-colors"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-4 py-2 font-medium min-w-12 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-gray-100 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t bg-white p-4 space-y-4">
            {/* Coupon */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('couponPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <button className="px-4 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors">
                {t('common:buttons.apply')}
              </button>
            </div>

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('subtotal')}</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('shipping')}</span>
                <span className="font-medium text-green-600">
                  {subtotal >= freeShippingThreshold ? t('shippingFree') : t('shippingCalculated')}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-lg font-semibold">{t('total')}</span>
              <span className="text-2xl font-bold text-orange-600">
                {formatPrice(subtotal)}
              </span>
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <Link
                to="/checkout"
                onClick={closeCart}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                {t('checkout')}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/cart"
                onClick={closeCart}
                className="block w-full py-3 text-center text-gray-600 font-medium hover:text-gray-900 transition-colors"
              >
                {t('viewCart')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
