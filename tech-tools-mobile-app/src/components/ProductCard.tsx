// ============================================
// TechTools Mobile App - Product Card Component
// ============================================

import React from 'react'
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

        {/* Add to cart button */}
        {showAddToCart && (
          <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
            <Ionicons name='cart-outline' size={16} color={AppColors.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    gap: 4,
  },
  addButtonText: {
    color: AppColors.white,
    fontSize: 12,
    fontWeight: '600',
  },
})
