// ============================================
// TechTools Mobile App - Trending Brand Section
// ============================================

import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Brand, Product } from '@/types'
import {
  AppColors,
  AppBorderRadius,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { formatPrice, getProductImage, calculateDiscount } from '@/utils'

const { width } = Dimensions.get('window')
const PRODUCT_WIDTH = (width - AppSpacing.base * 2 - AppSpacing.sm * 3) / 4

interface TrendingBrandSectionProps {
  brand: Brand
  products: Product[]
  // Real numbers only -- soldCount/newProductsCount come from actual
  // orders/catalog data (see brandsApi.getStats). There is deliberately no
  // followerCount here: no real follow/subscribe feature exists yet, and a
  // fabricated number is worse than an absent one.
  stats?: {
    soldCount?: number
    newProductsCount?: number
  }
}

export default function TrendingBrandSection({
  brand,
  products,
  stats,
}: TrendingBrandSectionProps) {
  const router = useRouter()
  const [isFollowing, setIsFollowing] = useState(false)

  const handleBrandPress = () => {
    router.push(`/products?brand=${brand.slug}`)
  }

  const handleProductPress = (product: Product) => {
    router.push(`/product/${product.slug}`)
  }

  const handleFollow = () => {
    setIsFollowing(!isFollowing)
    // TODO: Implement actual follow API call
  }

  const formatCount = (num: number | undefined): string => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toString()
  }

  return (
    <View style={styles.container}>
      {/* Brand Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={handleBrandPress}
        activeOpacity={0.8}
      >
        <View style={styles.brandInfo}>
          {/* Brand Logo */}
          <View style={styles.logoContainer}>
            {brand.logo_url ? (
              <Image
                source={{ uri: brand.logo_url }}
                style={styles.logo}
                resizeMode='contain'
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>
                  {brand.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.verifiedBadge}>
              <Ionicons
                name='checkmark-circle'
                size={14}
                color={AppColors.primary}
              />
            </View>
          </View>

          {/* Brand Name & Stats */}
          <View style={styles.brandDetails}>
            <Text style={styles.brandName}>{brand.name}</Text>
            <View style={styles.statsRow}>
              {stats?.soldCount && (
                <View style={styles.statItem}>
                  <Ionicons name='flash' size={12} color={AppColors.primary} />
                  <Text style={styles.statText}>
                    {formatCount(stats.soldCount)}+ Sold
                  </Text>
                </View>
              )}
              {stats?.newProductsCount && stats.newProductsCount > 0 && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>
                    {stats.newProductsCount}+ New
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Follow Button */}
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={handleFollow}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFollowing ? 'checkmark' : 'add'}
            size={16}
            color={isFollowing ? AppColors.primary : AppColors.white}
          />
          <Text
            style={[styles.followText, isFollowing && styles.followingText]}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Products Grid */}
      <View style={styles.productsContainer}>
        {products.slice(0, 4).map((product) => {
          const basePrice = Number(product.base_price)
          const salePrice = product.sale_price
            ? Number(product.sale_price)
            : null
          const hasDiscount = salePrice !== null && salePrice < basePrice

          return (
            <TouchableOpacity
              key={product.id}
              style={styles.productCard}
              onPress={() => handleProductPress(product)}
              activeOpacity={0.85}
            >
              <View style={styles.productImageContainer}>
                <Image
                  source={{ uri: getProductImage(product) }}
                  style={styles.productImage}
                  resizeMode='cover'
                />
                {hasDiscount && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>
                      -{calculateDiscount(basePrice, salePrice!)}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>
                  {formatPrice(salePrice || basePrice)}
                </Text>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>
                    {formatPrice(basePrice)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* View All */}
      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={handleBrandPress}
        activeOpacity={0.8}
      >
        <Text style={styles.viewAllText}>View All Products</Text>
        <Ionicons name='arrow-forward' size={16} color={AppColors.primary} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.white,
    marginHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.lg,
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppSpacing.md,
  },
  brandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    position: 'relative',
    marginRight: AppSpacing.sm,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: AppBorderRadius.md,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.full,
  },
  brandDetails: {
    flex: 1,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: AppColors.gray500,
  },
  newBadge: {
    backgroundColor: `${AppColors.accent}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: AppBorderRadius.sm,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.accent,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: AppBorderRadius.full,
  },
  followingButton: {
    backgroundColor: `${AppColors.primary}15`,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  followText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.white,
  },
  followingText: {
    color: AppColors.primary,
  },
  productsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.md,
  },
  productCard: {
    width: PRODUCT_WIDTH,
  },
  productImageContainer: {
    width: '100%',
    aspectRatio: 0.85,
    borderRadius: AppBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: AppColors.gray100,
    marginBottom: 6,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: AppColors.error,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: AppBorderRadius.sm,
  },
  discountText: {
    fontSize: 9,
    fontWeight: '600',
    color: AppColors.white,
  },
  priceContainer: {
    alignItems: 'center',
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  originalPrice: {
    fontSize: 10,
    color: AppColors.gray400,
    textDecorationLine: 'line-through',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: AppSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
  },
})
