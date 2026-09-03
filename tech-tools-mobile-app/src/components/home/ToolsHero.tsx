// ============================================
// Tools Hero - Professional workshop positioning
//
// Mirrors e-commerce-web-store/src/components/home/ToolsHero.tsx.
// The hero is a dark industrial gradient plus decorative Ionicons tool
// glyphs, PLUS a real, in-stock catalog product mosaic (never licensed
// or fabricated photography) -- productsApi.getFeatured, filtered to
// is_active && total_stock > 0, first 3. Renders the plain gradient
// hero (no mosaic) while loading or if nothing is in stock, so this
// never shows a broken image or an empty gap. Copy comes from
// homepageConfig, not hardcoded here.
// ============================================

import React, { useEffect, useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { AppColors, AppSpacing, AppGradients } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { productsApi } from '@/api'
import { Product } from '@/types'
import { formatPrice, getProductImage } from '@/utils'

const MOSAIC_PRODUCT_COUNT = 3

export default function ToolsHero() {
  const router = useRouter()
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    homepageConfig.hero
  const [mosaicProducts, setMosaicProducts] = useState<Product[]>([])

  useEffect(() => {
    let cancelled = false

    productsApi
      .getFeatured(12)
      .then((data) => {
        if (cancelled) return
        const inStock = data.filter((p) => p.is_active && p.total_stock > 0)
        setMosaicProducts(inStock.slice(0, MOSAIC_PRODUCT_COUNT))
      })
      .catch(() => {
        if (!cancelled) setMosaicProducts([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <LinearGradient
      colors={AppGradients.industrial}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Decorative glyphs, purely presentational */}
      <View pointerEvents='none' style={styles.decor}>
        <Ionicons
          name='build-outline'
          size={140}
          color='rgba(255,255,255,0.08)'
          style={styles.decorWrench}
        />
        <Ionicons
          name='hammer-outline'
          size={100}
          color='rgba(255,255,255,0.08)'
          style={styles.decorHammer}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowText}>{eyebrow}</Text>
        </View>

        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.push(primaryCta.to as never)}
          >
            <Text style={styles.primaryButtonText}>{primaryCta.label}</Text>
            <Ionicons name='arrow-forward' size={16} color={AppColors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={() => router.push(secondaryCta.to as never)}
          >
            <Text style={styles.secondaryButtonText}>
              {secondaryCta.label}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Real, in-stock product mosaic -- the site's actual catalog, not
            stock photography, so the hero reads as a real store front page
            rather than a text-only B2B SaaS landing hero. */}
        {mosaicProducts.length > 0 && (
          <View style={styles.mosaic}>
            {mosaicProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.mosaicItem}
                activeOpacity={0.85}
                onPress={() => router.push(`/product/${product.slug}` as never)}
              >
                <Image
                  source={{ uri: getProductImage(product) }}
                  style={styles.mosaicImage}
                  resizeMode='cover'
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.mosaicOverlay}
                >
                  <Text style={styles.mosaicName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.mosaicPrice}>
                    {formatPrice(product.sale_price ?? product.base_price)}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 64,
    paddingBottom: AppSpacing['3xl'],
    paddingHorizontal: AppSpacing.base,
    overflow: 'hidden',
  },
  decor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  decorWrench: {
    position: 'absolute',
    top: 20,
    right: -30,
    transform: [{ rotate: '-12deg' }],
  },
  decorHammer: {
    position: 'absolute',
    bottom: -10,
    right: 40,
    transform: [{ rotate: '12deg' }],
  },
  content: {
    position: 'relative',
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: AppColors.orangeAccent,
  },
  headline: {
    marginTop: AppSpacing.lg,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
    color: AppColors.white,
    letterSpacing: -0.5,
  },
  description: {
    marginTop: AppSpacing.md,
    fontSize: 15,
    lineHeight: 22,
    color: AppColors.slate400,
  },
  ctaRow: {
    marginTop: AppSpacing.xl,
    gap: AppSpacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    backgroundColor: AppColors.primary,
    paddingVertical: AppSpacing.base,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: AppColors.white,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: AppSpacing.base,
    borderRadius: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: AppColors.white,
  },
  mosaic: {
    marginTop: AppSpacing.xl,
    flexDirection: 'row',
    gap: AppSpacing.sm,
  },
  mosaicItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mosaicImage: {
    width: '100%',
    height: '100%',
  },
  mosaicOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: AppSpacing.sm,
  },
  mosaicName: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  mosaicPrice: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.orangeAccent,
  },
})
