// ============================================
// Tools Hero - Professional workshop positioning
//
// A real, swipeable, paginated carousel (FlatList + pagingEnabled + dot
// indicators, mirroring the reference layout the founder shared) built
// entirely from real data -- never a fabricated slide:
//
//  1. "Brand" slide -- always present, unchanged from the previous
//     static hero: real homepageConfig marketing copy plus a real,
//     in-stock catalog product mosaic (productsApi.getFeatured, filtered
//     to is_active && total_stock > 0).
//  2. "Collection" slide -- only when a real, active is_featured
//     product_collection with a real banner_url/image_url exists
//     (collectionsApi.getFeatured), shown as a full-bleed image with the
//     collection's own name and a Shop Now button to /collections/[slug].
//  3. "Product" slides -- one per additional real in-stock featured
//     product beyond the 3 already used in the brand slide's mosaic, each
//     a full-bleed product photo with its real name/price and a Shop Now
//     button to /product/[slug].
//
// Dots only render when there is more than one real slide -- a single
// real slide (e.g. while loading, or if no other real data exists yet)
// never grows a fake multi-dot carousel around it.
// ============================================

import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { AppColors, AppSpacing, AppGradients } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { productsApi, collectionsApi } from '@/api'
import { Product, ProductCollection } from '@/types'
import { formatPrice, getProductImage } from '@/utils'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const MOSAIC_PRODUCT_COUNT = 3
const EXTRA_SLIDE_PRODUCT_COUNT = 3
// Every slide -- the brand slide (copy + CTA + mosaic) and the real
// product/collection image slides -- shares this one fixed height so the
// carousel doesn't jump or leave a blank gap when paging between a
// text-heavy slide and a plain full-bleed photo. Sized generously above
// the brand slide's real measured content height (~550px at default font
// scale) so nothing gets clipped in normal use.
const HERO_HEIGHT = 600
const SLIDE_DIMENSIONS = { width: SCREEN_WIDTH, height: HERO_HEIGHT }

type HeroSlide =
  | { key: string; type: 'brand' }
  | { key: string; type: 'product'; product: Product }
  | { key: string; type: 'collection'; collection: ProductCollection }

export default function ToolsHero() {
  const router = useRouter()
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    homepageConfig.hero
  const [mosaicProducts, setMosaicProducts] = useState<Product[]>([])
  const [slideProducts, setSlideProducts] = useState<Product[]>([])
  const [collectionSlide, setCollectionSlide] =
    useState<ProductCollection | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<FlatList<HeroSlide>>(null)

  useEffect(() => {
    let cancelled = false

    productsApi
      .getFeatured(12)
      .then((data) => {
        if (cancelled) return
        const inStock = data.filter((p) => p.is_active && p.total_stock > 0)
        setMosaicProducts(inStock.slice(0, MOSAIC_PRODUCT_COUNT))
        setSlideProducts(
          inStock.slice(
            MOSAIC_PRODUCT_COUNT,
            MOSAIC_PRODUCT_COUNT + EXTRA_SLIDE_PRODUCT_COUNT,
          ),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setMosaicProducts([])
          setSlideProducts([])
        }
      })

    collectionsApi
      .getFeatured(4)
      .then((data) => {
        if (cancelled) return
        const withImage = data.find(
          (c) => c.is_active && (c.banner_url || c.image_url),
        )
        setCollectionSlide(withImage || null)
      })
      .catch(() => {
        if (!cancelled) setCollectionSlide(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const slides: HeroSlide[] = [
    { key: 'brand', type: 'brand' },
    ...(collectionSlide
      ? [
          {
            key: `collection-${collectionSlide.id}`,
            type: 'collection' as const,
            collection: collectionSlide,
          },
        ]
      : []),
    ...slideProducts.map((product) => ({
      key: `product-${product.id}`,
      type: 'product' as const,
      product,
    })),
  ]

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
    )
    setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)))
  }

  const renderSlide = ({ item }: { item: HeroSlide }) => {
    if (item.type === 'product') {
      const { product } = item
      return (
        <View style={[styles.slide, SLIDE_DIMENSIONS]}>
          <Image
            source={{ uri: getProductImage(product) }}
            style={styles.slideImage}
            resizeMode='cover'
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.slideOverlay}
          >
            <Text style={styles.slideHeadline} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.slidePrice}>
              {formatPrice(product.sale_price ?? product.base_price)}
            </Text>
            <TouchableOpacity
              style={styles.shopNowButton}
              activeOpacity={0.85}
              onPress={() => router.push(`/product/${product.slug}` as never)}
            >
              <Text style={styles.shopNowText}>SHOP NOW</Text>
              <Ionicons name='arrow-forward' size={14} color={AppColors.white} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )
    }

    if (item.type === 'collection') {
      const { collection } = item
      const image = collection.banner_url || collection.image_url
      return (
        <View style={[styles.slide, SLIDE_DIMENSIONS]}>
          <Image
            source={{ uri: image as string }}
            style={styles.slideImage}
            resizeMode='cover'
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.slideOverlay}
          >
            <Text style={styles.slideHeadline} numberOfLines={2}>
              {collection.name}
            </Text>
            {!!(collection.short_description || collection.description) && (
              <Text style={styles.slideDescription} numberOfLines={2}>
                {collection.short_description || collection.description}
              </Text>
            )}
            <TouchableOpacity
              style={styles.shopNowButton}
              activeOpacity={0.85}
              onPress={() =>
                router.push(`/collections/${collection.slug}` as never)
              }
            >
              <Text style={styles.shopNowText}>SHOP NOW</Text>
              <Ionicons name='arrow-forward' size={14} color={AppColors.white} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )
    }

    return (
      <LinearGradient
        colors={AppGradients.industrial}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.slide, styles.brandSlide, SLIDE_DIMENSIONS]}
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

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {slides.length > 1 && (
        <View style={styles.dots} pointerEvents='none'>
          {slides.map((slide, index) => (
            <View
              key={slide.key}
              style={[
                styles.dot,
                index === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  slide: {
    overflow: 'hidden',
  },
  brandSlide: {
    paddingTop: AppSpacing.xl,
    paddingBottom: AppSpacing['3xl'],
    paddingHorizontal: AppSpacing.base,
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
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slideOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.lg,
  },
  slideHeadline: {
    fontSize: 24,
    fontWeight: '900',
    color: AppColors.white,
    letterSpacing: -0.3,
  },
  slideDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.85)',
  },
  slidePrice: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.orangeAccent,
  },
  shopNowButton: {
    marginTop: AppSpacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
    backgroundColor: AppColors.primary,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    borderRadius: 8,
  },
  shopNowText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: AppColors.white,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: AppSpacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    width: 18,
    backgroundColor: AppColors.white,
  },
})
