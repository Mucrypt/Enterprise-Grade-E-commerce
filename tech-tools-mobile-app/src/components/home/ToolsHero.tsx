// ============================================
// Tools Hero
//
// An admin-managed, auto-advancing photo carousel (FlatList +
// pagingEnabled + a setInterval that also pages it on its own + dot
// indicators). Every slide comes from one real, resolved source of truth
// (Settings > Hero Slides in the admin dashboard) via
// heroSlidesApi.getPublic() -- no more client-side stitching of
// separately-fetched featured products + featured collections + static
// hero copy. An admin picks exactly which products/categories/collections
// appear, in what order, and can build a "product_grid" slide showing
// several real products together (see HeroGridSlide.tsx).
//
// Slide types (see tech-tools-api's hero-slides.controller.ts for the
// exact resolution rules -- a slide is only ever dropped for a missing/
// deactivated reference, never for stock, since an admin-curated pick is
// a deliberate choice):
//  - 'custom' -- a plain marketing banner (own image/copy/CTA).
//  - 'product' -- one real product; falls back to its own photo when the
//    admin didn't set an image override.
//  - 'category' -- one real category.
//  - 'product_collection' / 'category_collection' -- a real, existing
//    collection's own banner.
//  All five render as the same full-bleed banner with bottom-anchored
//  text (unchanged resizeMode='cover' treatment -- only web got the
//  object-contain/blur fix this session, not requested here).
//  - 'product_grid' -- several real products shown together -- its own
//    HeroGridSlide layout.
//
// Dots only render when there is more than one real slide.
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
import { heroSlidesApi, HeroSlide } from '@/api'
import { formatPrice, getProductImage } from '@/utils'
import { resolveMobileRoute } from '@/utils/resolveMobileRoute'
import HeroGridSlide from './HeroGridSlide'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
// A short, wide banner strip (like the reference carousel) instead of a
// tall block that eats most of the first screen -- every slide shares
// this one fixed height so paging never jumps.
const HERO_HEIGHT = 210
const SLIDE_DIMENSIONS = { width: SCREEN_WIDTH, height: HERO_HEIGHT }
const AUTO_ADVANCE_MS = 4500

export default function ToolsHero() {
  const router = useRouter()
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const listRef = useRef<FlatList<HeroSlide>>(null)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    let cancelled = false

    heroSlidesApi
      .getPublic()
      .then((data) => {
        if (!cancelled) setSlides(data)
      })
      .catch(() => {
        if (!cancelled) setSlides([])
      })

    return () => {
      cancelled = true
    }
  }, [])

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

  const renderSlide = ({ item: slide }: { item: HeroSlide }) => {
    if (slide.slideType === 'product_grid') {
      return (
        <HeroGridSlide
          eyebrow={slide.eyebrow}
          title={slide.title}
          ctaLabel={slide.ctaLabel}
          ctaLink={resolveMobileRoute(slide.ctaLink || '/products')}
          products={slide.products || []}
          style={SLIDE_DIMENSIONS}
        />
      )
    }

    const backgroundImage =
      slide.imageUrl ||
      (slide.product ? getProductImage(slide.product) : null)

    const priceLabel =
      slide.slideType === 'product' && slide.product
        ? formatPrice(slide.product.sale_price ?? slide.product.base_price)
        : null

    return (
      <View style={[styles.slide, SLIDE_DIMENSIONS]}>
        {backgroundImage ? (
          <Image
            source={{ uri: backgroundImage }}
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
          {!!slide.eyebrow && (
            <View style={styles.eyebrowPill}>
              <Text style={styles.eyebrowText} numberOfLines={1}>
                {slide.eyebrow}
              </Text>
            </View>
          )}

          {!!slide.title && (
            <Text style={styles.headline} numberOfLines={2}>
              {slide.title}
            </Text>
          )}

          {priceLabel && <Text style={styles.slidePrice}>{priceLabel}</Text>}

          {!priceLabel && !!slide.description && (
            <Text style={styles.slideDescription} numberOfLines={2}>
              {slide.description}
            </Text>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() =>
              router.push(resolveMobileRoute(slideLink(slide)) as never)
            }
          >
            <Text style={styles.primaryButtonText}>
              {slide.ctaLabel || 'Shop Now'}
            </Text>
            <Ionicons name='arrow-forward' size={14} color={AppColors.white} />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    )
  }

  if (slides.length === 0) return null

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
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
              key={slide.id}
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

function slideLink(slide: HeroSlide): string {
  return slide.ctaLink || '/products'
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
