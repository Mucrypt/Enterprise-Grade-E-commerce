// ============================================
// Hero Grid Slide
//
// The 'product_grid' hero slide type -- several real, admin-picked
// products shown together in one slide. Adapts the same visual language
// as TrendingCollectionCard.tsx (thumbnail + price-tag overlay), which
// stays untouched for the trending rail -- this is a new, separate
// component sized to fill the hero's fixed dimensions instead of
// TrendingCollectionCard's fixed small rail-card width.
// ============================================

import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { Product } from '@/types'
import { formatPrice, getProductImage } from '@/utils'

interface HeroGridSlideProps {
  eyebrow?: string | null
  title?: string | null
  ctaLabel?: string | null
  ctaLink: string
  products: Product[]
  style: { width: number; height: number }
}

export default function HeroGridSlide({
  eyebrow,
  title,
  ctaLabel,
  ctaLink,
  products,
  style,
}: HeroGridSlideProps) {
  const router = useRouter()
  const displayProducts = products.slice(0, 3)

  return (
    <View style={[styles.slide, style]}>
      <View style={styles.textCol}>
        {!!eyebrow && (
          <View style={styles.eyebrowPill}>
            <Text style={styles.eyebrowText} numberOfLines={1}>
              {eyebrow}
            </Text>
          </View>
        )}
        {!!title && (
          <Text style={styles.title} numberOfLines={3}>
            {title}
          </Text>
        )}
        <TouchableOpacity
          style={styles.shopNowButton}
          activeOpacity={0.85}
          onPress={() => router.push(ctaLink as never)}
        >
          <Text style={styles.shopNowText}>{ctaLabel || 'SHOP NOW'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.imagesRow}>
        {displayProducts.map((product) => (
          <TouchableOpacity
            key={product.id}
            style={styles.imageItem}
            activeOpacity={0.85}
            onPress={() => router.push(`/product/${product.slug}` as never)}
          >
            <Image
              source={{ uri: getProductImage(product) }}
              style={styles.image}
              resizeMode='cover'
            />
            <View style={styles.priceTag}>
              <Text style={styles.priceText}>
                {formatPrice(product.sale_price || product.base_price)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slide: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#0f1420',
  },
  textCol: {
    width: '38%',
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.base,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  eyebrowText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: AppColors.orangeAccent,
  },
  title: {
    marginTop: AppSpacing.xs,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
    color: AppColors.white,
    letterSpacing: -0.2,
  },
  shopNowButton: {
    marginTop: AppSpacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: AppColors.primary,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shopNowText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: AppColors.white,
  },
  imagesRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    padding: AppSpacing.xs,
  },
  imageItem: {
    flex: 1,
    borderRadius: AppBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  priceTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: AppBorderRadius.sm,
  },
  priceText: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.white,
  },
})
