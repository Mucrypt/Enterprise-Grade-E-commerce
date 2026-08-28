// ============================================
// Product Card Component (SHEIN/Amazon Style)
// ============================================

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ShoppingCart, Eye, Star, Truck, Award, Flame, TrendingUp, Sparkles, Globe2, Scale, Plus, Check } from 'lucide-react';
import { useCartStore, useWishlistStore, useCompareStore } from '../../stores';
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
// Real backend numbers (units_sold_90d/7d, views_7d), thresholds applied
// here so they're tunable without a migration -- see product.controller.ts's
// getProducts for where these raw figures come from.
const BEST_SELLER_MIN_UNITS_90D = 5;
const TRENDING_MIN_VIEWS_7D = 20;
const TRENDING_MIN_UNITS_7D = 3;
// Badges are capped so a card never turns into a badge wall -- priority
// order, most important first, only the top 2 actually render (Out of
// Stock overrides everything and shows alone).
const MAX_BADGES_SHOWN = 2;

export default function ProductCard({
  product,
  variant = 'default',
  showQuickView = true,
  onQuickView,
}: ProductCardProps) {
  const { t } = useTranslation('products');
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const justAddedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (justAddedTimeout.current) clearTimeout(justAddedTimeout.current);
    };
  }, []);

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

  const { toggleItem: toggleCompare, isInCompare, isFull: isCompareFull } = useCompareStore();
  const inCompare = isInCompare(product.id);

  const unitsSold90d = Number(product.units_sold_90d || 0);
  const unitsSold7d = Number(product.units_sold_7d || 0);
  const views7d = Number(product.views_7d || 0);
  const isBestSeller = unitsSold90d >= BEST_SELLER_MIN_UNITS_90D;
  const isTrending = views7d >= TRENDING_MIN_VIEWS_7D || unitsSold7d >= TRENDING_MIN_UNITS_7D;

  // Priority order, most important first -- only MAX_BADGES_SHOWN render.
  const badges: { key: string; node: React.ReactNode }[] = [];
  if (pricing.discountPercent !== null && pricing.discountPercent > 0) {
    badges.push({
      key: 'discount',
      node: (
        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
          -{pricing.discountPercent}%
        </span>
      ),
    });
  }
  if (product.is_featured) {
    badges.push({
      key: 'featured',
      node: (
        <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg">HOT</span>
      ),
    });
  }
  if (isTopRated) {
    badges.push({
      key: 'top-rated',
      node: (
        <span className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-white text-xs font-bold rounded-lg">
          <Award className="w-3 h-3" /> TOP RATED
        </span>
      ),
    });
  }
  if (product.is_new) {
    badges.push({
      key: 'new',
      node: (
        <span className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-lg">
          <Sparkles className="w-3 h-3" /> NEW
        </span>
      ),
    });
  }
  if (isBestSeller) {
    badges.push({
      key: 'best-seller',
      node: (
        <span className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg">
          <Flame className="w-3 h-3" /> BEST SELLER
        </span>
      ),
    });
  }
  if (isTrending) {
    badges.push({
      key: 'trending',
      node: (
        <span className="flex items-center gap-1 px-2 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">
          <TrendingUp className="w-3 h-3" /> TRENDING
        </span>
      ),
    });
  }
  if (isLowStock) {
    badges.push({
      key: 'low-stock',
      node: (
        <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-lg">
          Only {product.total_stock} left
        </span>
      ),
    });
  }
  if (product.is_eu_warehouse) {
    badges.push({
      key: 'eu-warehouse',
      node: (
        <span className="flex items-center gap-1 px-2 py-1 bg-teal-600 text-white text-xs font-bold rounded-lg">
          <Globe2 className="w-3 h-3" /> EU WAREHOUSE
        </span>
      ),
    });
  }
  const visibleBadges = badges.slice(0, MAX_BADGES_SHOWN);

  // Up to 2 real technical-spec chips, from the clean, admin-typed
  // attribute system -- not the free-text product_specifications table.
  const attributeChips = (product.attribute_values || []).slice(0, 2);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    setJustAdded(true);
    if (justAddedTimeout.current) clearTimeout(justAddedTimeout.current);
    justAddedTimeout.current = setTimeout(() => setJustAdded(false), 1200);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product);
  };

  const handleToggleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCompare(product);
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

        {/* Badges -- capped to MAX_BADGES_SHOWN by priority so the card
            never turns into a badge wall; Out of Stock overrides
            everything else and shows alone. */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {isOutOfStock ? (
            <span className="px-2 py-1 bg-gray-500 text-white text-xs font-bold rounded-lg">
              Out of Stock
            </span>
          ) : (
            visibleBadges.map((badge) => <span key={badge.key}>{badge.node}</span>)
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

          <button
            onClick={handleToggleCompare}
            disabled={!inCompare && isCompareFull()}
            aria-label={inCompare ? `Remove ${product.name} from comparison` : `Add ${product.name} to comparison`}
            aria-pressed={inCompare}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md disabled:cursor-not-allowed disabled:opacity-40',
              inCompare
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-500'
            )}
          >
            <Scale className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Add to Cart -- SHEIN-style icon button. Always visible
            (not hover-gated like the actions above) so it works on touch
            devices with no hover state at all, and reads as "add this"
            purely from the cart+plus glyph -- no label required to
            understand it. Swaps to a checkmark for a moment after a tap
            as non-text confirmation that the add actually happened. */}
        {!isOutOfStock && (
          <button
            onClick={handleAddToCart}
            aria-label={`${t('addToCart')}: ${product.name}`}
            title={t('addToCart')}
            className="absolute bottom-3 right-3 z-10 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-900 hover:bg-orange-500 hover:text-white active:scale-90 transition-all"
          >
            {justAdded ? (
              <Check className="w-5 h-5" />
            ) : (
              <span className="relative flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-orange-500 ring-2 ring-white flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </span>
              </span>
            )}
          </button>
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

        {/* Technical-spec chips -- real, admin-typed attribute values
            (Voltage, Material...), never the messy free-text specs table.
            Capped at 2 so the card stays scannable. */}
        {attributeChips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {attributeChips.map((chip) => (
              <span
                key={chip.attribute_id}
                className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded"
              >
                {chip.value}
                {chip.unit ? ` ${chip.unit}` : ''}
              </span>
            ))}
          </div>
        )}

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
