// ============================================
// Campaign Tiles Row
//
// Horizontal row of admin-curated campaign tiles, right below the hero.
// Real is_featured product_collections only -- same source
// FeaturedCollectionsShowcase.tsx already established
// (collectionsApi.getFeatured), just rendered as compact image+label
// tiles instead of full product shelves. category_collections campaigns
// are NOT included here: the mobile API client only exposes
// categoryCollectionsApi.getBySlug (a lookup for one already-known slug),
// there is no "list featured category collections" endpoint wired up on
// this client, so there is nothing real to fetch in bulk for that kind.
//
// Each tile shows the collection's own real banner_url/image_url with a
// dark gradient overlay and its real name, or -- when neither image
// exists -- the same industrial-gradient-plus-name fallback the
// collection detail screen (collections/[slug].tsx) already uses, never
// a placeholder image. Renders nothing when there are zero real featured
// collections, matching this codebase's honest-empty-state discipline.
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppGradients,
} from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { collectionsApi } from '@/api'
import { ProductCollection } from '@/types'

export default function CampaignTilesRow() {
  const router = useRouter()
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    collectionsApi
      .getFeatured(homepageConfig.campaignTiles.fetchLimit)
      .then((data) => {
        if (cancelled) return
        setCollections(data.filter((c) => c.is_active))
      })
      .catch(() => {
        if (!cancelled) setCollections([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && collections.length === 0) return null

  return (
    <View style={styles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {loading
          ? [...Array(3)].map((_, i) => (
              <View key={i} style={[styles.tile, styles.tileSkeleton]} />
            ))
          : collections.map((collection) => {
              const image = collection.banner_url || collection.image_url

              return (
                <TouchableOpacity
                  key={collection.id}
                  style={styles.tile}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push(`/collections/${collection.slug}` as never)
                  }
                >
                  {image ? (
                    <>
                      <Image
                        source={{ uri: image }}
                        style={styles.tileImage}
                        resizeMode='cover'
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.75)']}
                        style={styles.tileOverlay}
                      >
                        <Text style={styles.tileLabel} numberOfLines={2}>
                          {collection.name}
                        </Text>
                      </LinearGradient>
                    </>
                  ) : (
                    <LinearGradient
                      colors={AppGradients.industrial}
                      style={styles.tileFallback}
                    >
                      <Text style={styles.tileLabel} numberOfLines={2}>
                        {collection.name}
                      </Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              )
            })}
      </ScrollView>
    </View>
  )
}

const TILE_WIDTH = 150
const TILE_HEIGHT = 110

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.white,
    paddingVertical: AppSpacing.lg,
  },
  scrollContent: {
    paddingHorizontal: AppSpacing.base,
    gap: AppSpacing.md,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: AppBorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: AppColors.gray100,
  },
  tileSkeleton: {
    backgroundColor: AppColors.gray100,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
  },
  tileFallback: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.white,
  },
})
