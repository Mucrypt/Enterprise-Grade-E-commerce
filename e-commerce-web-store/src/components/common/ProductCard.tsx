// ============================================
// Product Card Component (SHEIN/Amazon Style)
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ShoppingCart, Eye, Star, Truck, Award } from 'lucide-react';
import { useCartStore, useWishlistStore } from '../../stores';
import { formatPrice, getProductImage, cn } from '../../utils';
import { getDisplayPricing } from '../../utils/pricing';
import { useFreeShippingThreshold } from '../../hooks/useFreeShippingThreshold';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'compact' | 'horizontal';
  showQuickView?: boolean;
  onQuickView?: (product: Product) => void;
}

// TOP RATED requires both a real minimum rating AND a minimum review
// count -- a single 5-star review shouldn't earn the same badge as a
// product with a genuinely large, consistently high-rated review base.
const TOP_RATED_MIN_RATING = 4.5;
const TOP_RATED_MIN_REVIEWS = 5;
const LOW_STOCK_THRESHOLD = 10;

export default function ProductCard({
  product,
  variant = 'default',
  showQuickView = true,
  onQuickView,
}: ProductCardProps) {
  const { t } = useTranslation('products');
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const { addItem } = useCartStore();
  const { toggleItem, isInWishlist } = useWishlistStore();

  const pricing = getDisplayPricing(product.base_price, product.sale_price);
  const freeShippingThreshold = useFreeShippingThreshold();
  const isLowStock = product.total_stock > 0 && product.total_stock < LOW_STOCK_THRESHOLD;
  const isOutOfStock = product.total_stock <= 0;
  const inWishlist = isInWishlist(product.id);

  const rating = typeof product.average_rating === 'string' ? parseFloat(product.average_rating) : product.average_rating;
  const reviewCount = typeof product.review_count === 'string' ? parseInt(product.review_count, 10) : product.review_count;
  // Never render a fake "4 stars (128)" -- only when the API actually
  // returned a real rating backed by at least one review. Same gate as
  // ToolProductCard.tsx and the PDP's RatingSummary.
  const hasRealRating = !!rating && !!reviewCount && reviewCount > 0
  const isTopRated = hasRealRating && rating! >= TOP_RATED_MIN_RATING && reviewCount! >= TOP_RATED_MIN_REVIEWS

  const qualifiesForFreeShipping = freeShippingThreshold != null && pricing.sellingPrice >= freeShippingThreshold

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  if (variant === 'horizontal') {
    return (
      <Link
        to={`/product/${product.slug}`}
        className="flex gap-4 p-4 bg-white rounded-xl hover:shadow-lg transition-all group"
      >
        <div className="w-24 h-24 shrink-0 bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={getProductImage(product, { w: 96, h: 96 })}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 group-hover:text-orange-600 line-clamp-2 transition-colors">
            {product.name}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{product.category_name}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-orange-600">{formatPrice(pricing.sellingPrice)}</span>
            {pricing.compareAtPrice !== null && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(pricing.compareAtPrice)}</span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        'group relative bg-white rounded-xl overflow-hidden transition-all duration-300',
        variant === 'compact' ? 'shadow-sm' : 'hover:shadow-xl hover:-translate-y-1'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <Link to={`/product/${product.slug}`} className="block relative overflow-hidden aspect-square">
        {/* Skeleton loader */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
        
        <img
          src={getProductImage(product, { w: 400, h: 400 })}
          alt={product.name}
          className={cn(
            'w-full h-full object-cover transition-transform duration-500',
            isHovered && 'scale-110',
            !imageLoaded && 'opacity-0'
          )}
          onLoad={() => setImageLoaded(true)}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {pricing.discountPercent !== null && pricing.discountPercent > 0 && (
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
              -{pricing.discountPercent}%
            </span>
          )}
          {product.is_featured && (
            <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg">
              HOT
            </span>
          )}
          {isTopRated && (
            <span className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-white text-xs font-bold rounded-lg">
              <Award className="w-3 h-3" />
              TOP RATED
            </span>
          )}
          {isLowStock && (
            <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-lg">
              Only {product.total_stock} left
            </span>
          )}
          {isOutOfStock && (
            <span className="px-2 py-1 bg-gray-500 text-white text-xs font-bold rounded-lg">
              Out of Stock
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div
          className={cn(
            'absolute top-3 right-3 flex flex-col gap-2 transition-all duration-300',
            isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
          )}
        >
          <button
            onClick={handleToggleWishlist}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md',
              inWishlist
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-500'
            )}
          >
            <Heart className={cn('w-4 h-4', inWishlist && 'fill-current')} />
          </button>
          
          {showQuickView && onQuickView && (
            <button
              onClick={handleQuickView}
              aria-label={`Quick view ${product.name}`}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
            >
              <Eye className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>

        {/* Add to Cart Button */}
        {!isOutOfStock && (
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 p-3 transition-all duration-300',
              isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
            )}
          >
            <button
              onClick={handleAddToCart}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              <ShoppingCart className="w-4 h-4" />
              {t('addToCart')}
            </button>
          </div>
        )}
      </Link>

      {/* Product Info -- denser chrome: tighter padding/spacing than a
          typical marketplace card, per the SHEIN-density direction. */}
      <div className="p-3">
        {/* Category & Brand */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span className="truncate">{product.category_name}</span>
          {product.brand_name && (
            <>
              <span>•</span>
              <span className="truncate">{product.brand_name}</span>
            </>
          )}
        </div>

        {/* Title */}
        <Link to={`/product/${product.slug}`}>
          <h3 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-orange-600 transition-colors min-h-10">
            {product.name}
          </h3>
        </Link>

        {/* Rating -- only when the API actually returned a real,
            review-backed rating; never a fabricated placeholder. */}
        {hasRealRating && (
          <div className="flex items-center gap-1 mt-1.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'w-3 h-3',
                  i < Math.round(rating!) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                )}
              />
            ))}
            <span className="text-xs text-gray-500 ml-1">({reviewCount})</span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-base font-bold text-orange-600">
            {formatPrice(pricing.sellingPrice)}
          </span>
          {pricing.compareAtPrice !== null && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(pricing.compareAtPrice)}
            </span>
          )}
        </div>

        {/* Free Shipping Badge -- driven by the real, admin-configured
            threshold, not a hardcoded number. */}
        {qualifiesForFreeShipping && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
            <Truck className="w-3.5 h-3.5" />
            <span>Free Shipping</span>
          </div>
        )}
      </div>
    </div>
  );
}
