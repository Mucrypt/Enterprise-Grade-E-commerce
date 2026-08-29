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

interface ProductCardProps {
  product: Product
  showAddToCart?: boolean
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
  const stars = generateStarRating(product.average_rating || 0)

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

  const getBadgeStyle = () => {
    switch (badge) {
      case 'HOT':
        return { bg: AppColors.badgeHot, icon: 'flame' }
      case 'FLASH':
        return { bg: AppColors.badgeFlash, icon: 'flash' }
      case 'DEAL':
        return { bg: AppColors.badgeDeal, icon: 'pricetag' }
      case 'NEW':
        return { bg: AppColors.badgeNew, icon: 'sparkles' }
      case 'SALE':
        return { bg: AppColors.badgeSale, icon: 'percent' }
      default:
        return null
    }
  }

  const badgeStyle = getBadgeStyle()

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

        {/* Badge */}
        {badgeStyle && (
          <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
            <Ionicons
              name={badgeStyle.icon as any}
              size={10}
              color={AppColors.white}
            />
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}

        {/* Discount badge */}
        {hasDiscount && !badge && (
          <View
            style={[styles.badge, { backgroundColor: AppColors.badgeSale }]}
          >
            <Text style={styles.badgeText}>-{discountPercent}%</Text>
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

        {/* Rating */}
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
          {product.review_count && (
            <Text style={styles.reviewCount}>({product.review_count})</Text>
          )}
        </View>

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
  badge: {
    position: 'absolute',
    top: AppSpacing.sm,
    left: AppSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.sm,
    gap: 4,
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
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.primary,
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
