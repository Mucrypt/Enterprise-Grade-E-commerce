// ============================================
// Hero Collection Grid Slide
//
// The 'collection_grid' hero slide type -- several real, admin-picked
// collections shown together as tiles in one slide, mirroring
// HeroGridSlide.tsx's layout (text left, 2x2 tile grid right) one level
// up: each tile is a whole collection's own banner photo + name, linking
// to /collections/:slug, instead of a single product + price.
// ============================================

import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { ProductCollection } from '@/types'

interface HeroCollectionGridSlideProps {
  eyebrow?: string | null
  title?: string | null
  ctaLabel?: string | null
  ctaLink: string
  collections: ProductCollection[]
  style: { width: number; height: number }
}

export default function HeroCollectionGridSlide({
  eyebrow,
  title,
  ctaLabel,
  ctaLink,
  collections,
  style,
}: HeroCollectionGridSlideProps) {
  const router = useRouter()
  const displayCollections = collections.slice(0, 4)

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
        {displayCollections.map((collection) => {
          const image = collection.banner_url || collection.image_url
          return (
            <TouchableOpacity
              key={collection.id}
              style={styles.imageItem}
              activeOpacity={0.85}
              onPress={() => router.push(`/collections/${collection.slug}` as never)}
            >
              {!!image && (
                <Image source={{ uri: image }} style={styles.image} resizeMode='cover' />
              )}
              <View style={styles.nameTag}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {collection.name}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
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
    flexWrap: 'wrap',
    alignContent: 'space-between',
    gap: 4,
    padding: AppSpacing.xs,
  },
  // 2 columns x 2 rows (up to 4 collections), matching HeroGridSlide's grid.
  imageItem: {
    width: '48%',
    height: '48%',
    borderRadius: AppBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  nameTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: AppBorderRadius.sm,
  },
  nameText: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.white,
  },
})
