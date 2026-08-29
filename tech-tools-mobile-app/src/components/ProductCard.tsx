// ============================================
// TechTools Mobile App - Product Card Component
// ============================================

import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Product } from '@/types'
import {
  formatPrice,
  calculateDiscount,
  getProductImage,
  generateStarRating,
} from '@/utils'
import {
  AppColors,
  AppBorderRadius,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useCartStore, useWishlistStore } from '@/stores'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - AppSpacing.base * 3) / 2

// Real, threshold-gated badge system -- mirrors the web storefront's
// ProductCard.tsx exactly, computed from real product fields rather than
// a caller-supplied label. See product.controller.ts's getProducts for
// where units_sold_90d/7d and views_7d come from.
// TOP RATED requires both a real minimum rating AND a minimum review
// count -- a single 5-star review shouldn't earn the same badge as a
// product with a genuinely large, consistently high-rated review base.
const TOP_RATED_MIN_RATING = 4.5
const TOP_RATED_MIN_REVIEWS = 5
const LOW_STOCK_THRESHOLD = 10
const BEST_SELLER_MIN_UNITS_90D = 5
const TRENDING_MIN_VIEWS_7D = 20
const TRENDING_MIN_UNITS_7D = 3
// Badges are capped so a card never turns into a badge wall -- priority
// order, most important first, only the top 2 actually render (Out of
// Stock overrides everything and shows alone).
const MAX_BADGES_SHOWN = 2

interface ComputedBadge {
  key: string
  label: string
  icon?: string
  bg: string
}

// Legacy caller-supplied badge styles -- kept only for backward
// compatibility with the old caller-supplied `badge` prop. No current
// call site passes it (grepped every <ProductCard> usage in the app), but
// if one ever does, it renders as the top-priority badge.
const LEGACY_BADGE_STYLES: Record<
  string,
  { bg: string; icon: string }
> = {
  HOT: { bg: AppColors.badgeHot, icon: 'flame' },
  FLASH: { bg: AppColors.badgeFlash, icon: 'flash' },
  DEAL: { bg: AppColors.badgeDeal, icon: 'pricetag' },
  NEW: { bg: AppColors.badgeNew, icon: 'sparkles' },
  SALE: { bg: AppColors.badgeSale, icon: 'percent' },
}

interface ProductCardProps {
  product: Product
  showAddToCart?: boolean
  /** @deprecated Badges are now computed from real product fields. Only
   * kept for backward compatibility -- if passed, renders as the
   * top-priority badge. */
  badge?: 'HOT' | 'FLASH' | 'DEAL' | 'NEW' | 'SALE'
}

export default function ProductCard({
  product,
  showAddToCart = true,
  badge,
}: ProductCardProps) {
  const router = useRouter()
  const addToCart = useCartStore((state) => state.addItem)
  const { isInWishlist, toggleItem } = useWishlistStore()
  const [justAdded, setJustAdded] = useState(false)
  const justAddedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (justAddedTimeout.current) clearTimeout(justAddedTimeout.current)
    }
  }, [])

  const basePrice = Number(product.base_price)
  const salePrice = product.sale_price ? Number(product.sale_price) : null
  const hasDiscount = salePrice !== null && salePrice < basePrice
  const discountPercent = hasDiscount
    ? calculateDiscount(basePrice, salePrice!)
    : 0
  const inWishlist = isInWishlist(product.id)

  // Anti-fabrication gate: never render a fake "0.0 (0)" -- only show
  // stars/review count when the API actually returned a real,
  // review-backed rating. Mirrors the web storefront's hasRealRating gate.
  const rating =
    typeof product.average_rating === 'string'
      ? parseFloat(product.average_rating)
      : product.average_rating
  const reviewCount =
    typeof product.review_count === 'string'
      ? parseInt(product.review_count, 10)
      : product.review_count
  const hasRealRating = !!rating && !!reviewCount && reviewCount > 0
  const isTopRated =
    hasRealRating &&
    rating! >= TOP_RATED_MIN_RATING &&
    reviewCount! >= TOP_RATED_MIN_REVIEWS
  const stars = hasRealRating ? generateStarRating(rating!) : []

  const isOutOfStock = product.total_stock <= 0
  const isLowStock = product.total_stock > 0 && product.total_stock < LOW_STOCK_THRESHOLD
  const unitsSold90d = Number(product.units_sold_90d || 0)
  const unitsSold7d = Number(product.units_sold_7d || 0)
  const views7d = Number(product.views_7d || 0)
  const isBestSeller = unitsSold90d >= BEST_SELLER_MIN_UNITS_90D
  const isTrending =
    views7d >= TRENDING_MIN_VIEWS_7D || unitsSold7d >= TRENDING_MIN_UNITS_7D

  // Priority order, most important first -- only MAX_BADGES_SHOWN render.
  const badges: ComputedBadge[] = []
  if (badge && LEGACY_BADGE_STYLES[badge]) {
    badges.push({
      key: 'legacy',
      label: badge,
      icon: LEGACY_BADGE_STYLES[badge].icon,
      bg: LEGACY_BADGE_STYLES[badge].bg,
    })
  }
  if (hasDiscount) {
    badges.push({
      key: 'discount',
      label: `-${discountPercent}%`,
      bg: AppColors.badgeSale,
    })
  }
  if (product.is_featured) {
    badges.push({ key: 'featured', label: 'HOT', bg: AppColors.badgeFeatured })
  }
  if (isTopRated) {
    badges.push({
      key: 'top-rated',
      label: 'TOP RATED',
      icon: 'ribbon-outline',
      bg: AppColors.badgeTopRated,
    })
  }
  if (product.is_new) {
    badges.push({
      key: 'new',
      label: 'NEW',
      icon: 'sparkles',
      bg: AppColors.badgeProductNew,
    })
  }
  if (isBestSeller) {
    badges.push({
      key: 'best-seller',
      label: 'BEST SELLER',
      icon: 'flame',
      bg: AppColors.badgeBestSeller,
    })
  }
  if (isTrending) {
    badges.push({
      key: 'trending',
      label: 'TRENDING',
      icon: 'trending-up',
      bg: AppColors.badgeTrending,
    })
  }
  if (isLowStock) {
    badges.push({
      key: 'low-stock',
      label: `Only ${product.total_stock} left`,
      bg: AppColors.badgeLowStock,
    })
  }
  if (product.is_eu_warehouse) {
    badges.push({
      key: 'eu-warehouse',
      label: 'EU WAREHOUSE',
      icon: 'globe-outline',
      bg: AppColors.badgeEuWarehouse,
    })
  }

  const visibleBadges: ComputedBadge[] = isOutOfStock
    ? [{ key: 'out-of-stock', label: 'Out of Stock', bg: AppColors.badgeOutOfStock }]
    : badges.slice(0, MAX_BADGES_SHOWN)

  const handlePress = () => {
    router.push(`/product/${product.slug}`)
  }

  const handleAddToCart = (e: any) => {
    e.stopPropagation()
    addToCart(product)
    setJustAdded(true)
    if (justAddedTimeout.current) clearTimeout(justAddedTimeout.current)
    justAddedTimeout.current = setTimeout(() => setJustAdded(false), 1200)
  }

  const handleToggleWishlist = (e: any) => {
    e.stopPropagation()
    toggleItem(product)
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: getProductImage(product) }}
          style={styles.image}
          resizeMode='cover'
        />

        {/* Wishlist button */}
        <TouchableOpacity
          style={styles.wishlistButton}
          onPress={handleToggleWishlist}
        >
          <Ionicons
            name={inWishlist ? 'heart' : 'heart-outline'}
            size={20}
            color={inWishlist ? AppColors.error : AppColors.gray600}
          />
        </TouchableOpacity>

        {/* Badges -- computed from real product fields, capped to
            MAX_BADGES_SHOWN by priority; Out of Stock overrides everything
            else and renders alone. */}
        {visibleBadges.length > 0 && (
          <View style={styles.badgesColumn}>
            {visibleBadges.map((b) => (
              <View key={b.key} style={[styles.badge, { backgroundColor: b.bg }]}>
                {b.icon && (
                  <Ionicons name={b.icon as any} size={10} color={AppColors.white} />
                )}
                <Text style={styles.badgeText}>{b.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick add to cart -- SHEIN-style icon button, mirrors the web
            storefront's ProductCard exactly: a white circle overlaid on
            the image (same treatment as the wishlist button, just
            bottom-right), a cart glyph with a small orange plus badge so
            "add this" reads without any label, and a brief checkmark swap
            as non-text confirmation that the tap registered. */}
        {showAddToCart && (
          <TouchableOpacity
            style={styles.quickAddButton}
            onPress={handleAddToCart}
            activeOpacity={0.7}
          >
            {justAdded ? (
              <Ionicons name='checkmark' size={20} color={AppColors.gray800} />
            ) : (
              <View>
                <Ionicons name='cart-outline' size={20} color={AppColors.gray800} />
                <View style={styles.quickAddBadge}>
                  <Ionicons name='add' size={10} color={AppColors.white} />
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {/* Category */}
        <Text style={styles.category} numberOfLines={1}>
          {product.category_name}
        </Text>

        {/* Product name */}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Rating -- omitted entirely when there's no real, review-backed
            rating (never a fabricated "0.0 (0)"). */}
        {hasRealRating && (
          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {stars.map((star, index) => (
                <Ionicons
                  key={index}
                  name={
                    star === 'full'
                      ? 'star'
                      : star === 'half'
                      ? 'star-half'
                      : 'star-outline'
                  }
                  size={12}
                  color={AppColors.warning}
                />
              ))}
            </View>
            <Text style={styles.reviewCount}>({reviewCount})</Text>
          </View>
        )}

        {/* Price */}
        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            {formatPrice(salePrice ?? basePrice)}
          </Text>
          {hasDiscount && (
            <Text style={styles.originalPrice}>{formatPrice(basePrice)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    overflow: 'hidden',
    marginBottom: AppSpacing.base,
    ...AppShadows.md,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  wishlistButton: {
    position: 'absolute',
    top: AppSpacing.sm,
    right: AppSpacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...AppShadows.sm,
  },
  badgesColumn: {
    position: 'absolute',
    top: AppSpacing.sm,
    left: AppSpacing.sm,
    gap: 6,
    maxWidth: '70%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.sm,
    gap: 4,
    ...AppShadows.sm,
  },
  badgeText: {
    color: AppColors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    padding: AppSpacing.md,
  },
  category: {
    fontSize: 10,
    color: AppColors.gray500,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray800,
    marginBottom: AppSpacing.xs,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: AppSpacing.sm,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewCount: {
    fontSize: 10,
    color: AppColors.gray500,
    marginLeft: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    marginBottom: AppSpacing.sm,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.primary,
    letterSpacing: -0.3,
  },
  originalPrice: {
    fontSize: 12,
    color: AppColors.gray400,
    textDecorationLine: 'line-through',
  },
  quickAddButton: {
    position: 'absolute',
    bottom: AppSpacing.sm,
    right: AppSpacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...AppShadows.sm,
  },
  quickAddBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: AppColors.primary,
    borderWidth: 2,
    borderColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
