// ============================================
// Tools Hero - Professional workshop positioning
//
// A real, swipeable, auto-advancing carousel (FlatList + pagingEnabled +
// a setInterval that also pages it on its own + dot indicators, matching
// the reference layout the founder shared) of full-bleed real photos --
// never a flat color panel or a fabricated slide:
//
//  1. "Brand" slide -- always present: real homepageConfig/admin-edited
//     marketing copy (eyebrow/headline/CTA) over a real, in-stock
//     featured product's own photo as the full-bleed background
//     (productsApi.getFeatured, filtered to is_active && total_stock >
//     0) -- falls back to a plain gradient only while that's still
//     loading or none are in stock, never a stock/fabricated photo.
//  2. "Collection" slide -- only when a real, active is_featured
//     product_collection with a real banner_url/image_url exists
//     (collectionsApi.getFeatured), shown as a full-bleed image with the
//     collection's own name and a Shop Now button to /collections/[slug].
//  3. "Product" slides -- one per additional real in-stock featured
//     product beyond the one already used as the brand slide's
//     background, each a full-bleed product photo with its real
//     name/price and a Shop Now button to /product/[slug].
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
import { productsApi, collectionsApi, homepageSettingsApi } from '@/api'
import { Product, ProductCollection } from '@/types'
import { formatPrice, getProductImage } from '@/utils'
import { resolveMobileRoute } from '@/utils/resolveMobileRoute'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const EXTRA_SLIDE_PRODUCT_COUNT = 4
// A short, wide banner strip (like the reference carousel) instead of a
// tall block that eats most of the first screen -- every slide shares
// this one fixed height so paging never jumps. The brand slide's copy
// was condensed to fit this (no in-hero product mosaic -- those same
// in-stock products already appear in FeaturedCollectionsShowcase/
// FeaturedProfessionalTools just below; no long description -- that
// stays admin-editable and still renders on the web hero, which has
// room for it; only one CTA instead of two).
const HERO_HEIGHT = 210
const SLIDE_DIMENSIONS = { width: SCREEN_WIDTH, height: HERO_HEIGHT }
// Real auto-advance (paging still works too -- this just also rotates
// on its own, like the reference carousel's dots implied).
const AUTO_ADVANCE_MS = 4500

type HeroSlide =
  | { key: string; type: 'brand' }
  | { key: string; type: 'product'; product: Product }
  | { key: string; type: 'collection'; collection: ProductCollection }

export default function ToolsHero() {
  const router = useRouter()
  const [copy, setCopy] = useState(homepageConfig.hero)
  const { eyebrow, headline, primaryCta } = copy
  const [slideProducts, setSlideProducts] = useState<Product[]>([])
  const [collectionSlide, setCollectionSlide] =
    useState<ProductCollection | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const listRef = useRef<FlatList<HeroSlide>>(null)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  // Real, admin-editable copy (Settings > Homepage Content) -- falls back
  // to the static homepageConfig.hero value already in state if the
  // request fails or hasn't resolved yet, so the hero is never blank.
  useEffect(() => {
    let cancelled = false

    homepageSettingsApi
      .getPublic()
      .then((settings) => {
        if (cancelled || !settings?.hero) return
        const { hero } = settings
        setCopy({
          eyebrow: hero.eyebrow,
          headline: hero.headline,
          description: hero.description,
          primaryCta: {
            label: hero.primaryCtaLabel,
            to: resolveMobileRoute(hero.primaryCtaTo),
          },
          secondaryCta: {
            label: hero.secondaryCtaLabel,
            to: resolveMobileRoute(hero.secondaryCtaTo),
          },
        })
      })
      .catch(() => {
        // Keep the static homepageConfig.hero fallback already in state.
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    productsApi
      .getFeatured(12)
      .then((data) => {
        if (cancelled) return
        const inStock = data.filter((p) => p.is_active && p.total_stock > 0)
        setSlideProducts(inStock.slice(0, EXTRA_SLIDE_PRODUCT_COUNT))
      })
      .catch(() => {
        if (!cancelled) setSlideProducts([])
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

  // The brand slide's own real background photo -- the first in-stock
  // featured product, kept distinct from slideProducts[1..] so the same
  // product isn't shown twice in a row across the carousel.
  const heroBackgroundProduct = slideProducts[0] || null
  const remainingSlideProducts = slideProducts.slice(1)

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
    ...remainingSlideProducts.map((product) => ({
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

  // Real auto-advance: loops back to the first slide after the last one.
  // Reads activeIndexRef (not activeIndex directly) so it always resumes
  // from wherever the user last manually swiped to, instead of a stale
  // closure fighting their swipe.
  useEffect(() => {
    if (slides.length <= 1) return

    const timer = setInterval(() => {
      const next = (activeIndexRef.current + 1) % slides.length
      listRef.current?.scrollToOffset({
        offset: next * SCREEN_WIDTH,
        animated: true,
      })
      setActiveIndex(next)
    }, AUTO_ADVANCE_MS)

    return () => clearInterval(timer)
  }, [slides.length])

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

    // Real, full-bleed background photo -- the same first in-stock
    // featured product used for the "product" slides, so the brand slide
    // reads like SHEIN's own photo-first hero instead of a flat color
    // panel. Falls back to the plain industrial gradient only while
    // products are still loading or none are in stock -- never a
    // fabricated/stock photo standing in for a real one.
    const heroImageUri = heroBackgroundProduct
      ? getProductImage(heroBackgroundProduct)
      : null

    return (
      <View style={[styles.slide, SLIDE_DIMENSIONS]}>
        {heroImageUri ? (
          <Image
            source={{ uri: heroImageUri }}
            style={styles.slideImage}
            resizeMode='cover'
          />
        ) : (
          <LinearGradient
            colors={AppGradients.industrial}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.slideImage}
          />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.slideOverlay}
        >
          <View style={styles.eyebrowPill}>
            <Text style={styles.eyebrowText} numberOfLines={1}>
              {eyebrow}
            </Text>
          </View>

          <Text style={styles.headline} numberOfLines={2}>
            {headline}
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.push(primaryCta.to as never)}
          >
            <Text style={styles.primaryButtonText}>{primaryCta.label}</Text>
            <Ionicons name='arrow-forward' size={15} color={AppColors.white} />
          </TouchableOpacity>
        </LinearGradient>
      </View>
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
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 5,
    borderRadius: 999,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: AppColors.orangeAccent,
  },
  headline: {
    marginTop: AppSpacing.sm,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    color: AppColors.white,
    letterSpacing: -0.4,
    maxWidth: '85%',
  },
  primaryButton: {
    marginTop: AppSpacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
    backgroundColor: AppColors.primary,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.sm,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: AppColors.white,
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
