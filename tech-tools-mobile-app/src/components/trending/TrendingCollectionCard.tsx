// ============================================
// TechTools Mobile App - Trending Collection Card
// ============================================

import React from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ProductCollection, Product } from '@/types'
import {
  AppColors,
  AppBorderRadius,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { formatPrice, getProductImage } from '@/utils'

const { width } = Dimensions.get('window')
const CARD_WIDTH = width * 0.42

interface TrendingCollectionCardProps {
  collection: ProductCollection
  products?: Product[]
  style?: object
}

export default function TrendingCollectionCard({
  collection,
  products = [],
  style,
}: TrendingCollectionCardProps) {
  const router = useRouter()

  const handlePress = () => {
    router.push(`/collections/${collection.slug}` as never)
  }

  const displayProducts = products.slice(0, 3)

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Collection Header */}
        <View style={styles.header}>
          <View style={styles.hashtagContainer}>
            <Text style={styles.hashtag}># {collection.name}</Text>
            <Ionicons
              name='chevron-forward'
              size={14}
              color={AppColors.white}
            />
          </View>
          <Text style={styles.itemCount}>{collection.items_count} items</Text>
        </View>

        {/* Product Previews */}
        <View style={styles.productsGrid}>
          {displayProducts.map((product, index) => (
            <View key={product.id} style={styles.productItem}>
              <Image
                source={{ uri: getProductImage(product) }}
                style={styles.productImage}
                resizeMode='cover'
              />
              <View style={styles.priceTag}>
                <Text style={styles.priceText}>
                  {formatPrice(product.sale_price || product.base_price)}
                </Text>
              </View>
            </View>
          ))}
          {displayProducts.length < 3 && collection.image_url && (
            <View style={styles.productItem}>
              <Image
                source={{ uri: collection.image_url }}
                style={styles.productImage}
                resizeMode='cover'
              />
              <View style={styles.moreOverlay}>
                <Text style={styles.moreText}>+More</Text>
              </View>
            </View>
          )}
        </View>

        {/* Trending Badge */}
        {collection.is_featured && (
          <View style={styles.trendingBadge}>
            <Ionicons name='trending-up' size={12} color={AppColors.white} />
            <Text style={styles.trendingText}>Trending</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: AppSpacing.md,
    borderRadius: AppBorderRadius.xl,
    overflow: 'hidden',
    ...AppShadows.lg,
  },
  gradient: {
    padding: AppSpacing.md,
    minHeight: 200,
  },
  header: {
    marginBottom: AppSpacing.sm,
  },
  hashtagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hashtag: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
    letterSpacing: 0.5,
  },
  itemCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.xs,
    marginTop: AppSpacing.sm,
  },
  productItem: {
    width: '48%',
    aspectRatio: 0.9,
    borderRadius: AppBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  priceTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: AppBorderRadius.sm,
  },
  priceText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.white,
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.white,
  },
  trendingBadge: {
    position: 'absolute',
    top: AppSpacing.sm,
    right: AppSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.full,
  },
  trendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.white,
  },
})
