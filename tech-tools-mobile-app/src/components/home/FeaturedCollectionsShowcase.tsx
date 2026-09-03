// ============================================
// Featured Collections Showcase
//
// Mirrors e-commerce-web-store/src/components/home/FeaturedCollectionsShowcase.tsx.
// Real, admin-curated merchandising rows -- one per product_collection
// that an admin has marked "featured" in the Collections admin page (star
// toggle), ordered by that collection's real `position`. Each row shows
// the collection's own real name/description and its real linked
// products, capped to homepageConfig.featuredCollections.maxCollections
// (fewer than the web storefront's 3 -- mobile screens are far more
// space-constrained, so the home screen doesn't turn into a stack of
// near-identical product shelves).
//
// Every collection's products are filtered to is_active && total_stock > 0
// before rendering -- client-side defense in depth against a (now fixed)
// backend bug where collection endpoints sometimes didn't return real
// stock figures, so a merchandising row never shows a broken/unbuyable
// placeholder item. A collection whose real products are all currently
// out of stock is dropped entirely rather than shown empty.
//
// Renders nothing if there are no featured collections with real,
// in-stock products yet, matching this codebase's honest-empty-state
// discipline (never a placeholder "Best Sellers" row full of fabricated
// items).
// ============================================

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { collectionsApi } from '@/api'
import { ProductCollection } from '@/types'
import ProductCard from '@/components/ProductCard'

export default function FeaturedCollectionsShowcase() {
  const router = useRouter()
  const { maxCollections, maxProductsPerRow } = homepageConfig.featuredCollections
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const shells = await collectionsApi.getFeatured(maxCollections)
        const active = shells.filter((c) => c.is_active).slice(0, maxCollections)

        const full = await Promise.all(
          active.map((c) => collectionsApi.getBySlug(c.slug).catch(() => null)),
        )
        if (cancelled) return

        const withProducts = full
          .filter((c): c is ProductCollection => !!c && !!c.products)
          .map((c) => ({
            ...c,
            products: (c.products || []).filter(
              (p) => p.is_active && p.total_stock > 0,
            ),
          }))
          .filter((c) => c.products.length > 0)
        setCollections(withProducts)
      } catch (error) {
        console.error('Failed to load featured collections:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [maxCollections])

  if (!loading && collections.length === 0) return null

  if (loading) {
    return (
      <View style={styles.section}>
        {[...Array(2)].map((_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={styles.skeletonHeading} />
            <View style={styles.skeletonDescription} />
            <View style={styles.skeletonProducts}>
              {[...Array(2)].map((_, j) => (
                <View key={j} style={styles.skeletonCard} />
              ))}
            </View>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.section}>
      {collections.map((collection, index) => (
        <View
          key={collection.id}
          style={[
            styles.row,
            index % 2 === 1 && styles.rowAlt,
            index === collections.length - 1 && styles.rowLast,
          ]}
        >
          <View style={styles.rowHeader}>
            <View style={styles.rowHeaderText}>
              <Text style={styles.heading}>{collection.name}</Text>
              {!!(collection.short_description || collection.description) && (
                <Text style={styles.description} numberOfLines={2}>
                  {collection.short_description || collection.description}
                </Text>
              )}
            </View>
          </View>

          <FlatList
            horizontal
            data={(collection.products || []).slice(0, maxProductsPerRow)}
            keyExtractor={(product) => product.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
            renderItem={({ item }) => <ProductCard product={item} />}
          />

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => router.push(`/collections/${collection.slug}` as never)}
          >
            <Text style={styles.viewAllText}>Shop the collection</Text>
            <Ionicons name='arrow-forward' size={16} color={AppColors.gray900} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.background,
  },
  row: {
    backgroundColor: AppColors.white,
    paddingVertical: AppSpacing.xl,
    marginBottom: AppSpacing.md,
  },
  rowAlt: {
    backgroundColor: AppColors.background,
  },
  rowLast: {
    marginBottom: 0,
  },
  rowHeader: {
    paddingHorizontal: AppSpacing.base,
  },
  rowHeaderText: {},
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: AppColors.gray900,
    letterSpacing: -0.3,
  },
  description: {
    marginTop: AppSpacing.xs,
    fontSize: 13,
    color: AppColors.slate500,
    lineHeight: 19,
  },
  productsList: {
    marginTop: AppSpacing.lg,
    paddingHorizontal: AppSpacing.base,
    gap: AppSpacing.md,
  },
  viewAllButton: {
    marginTop: AppSpacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  skeletonRow: {
    paddingVertical: AppSpacing.xl,
    paddingHorizontal: AppSpacing.base,
  },
  skeletonHeading: {
    width: 180,
    height: 22,
    borderRadius: AppBorderRadius.sm,
    backgroundColor: AppColors.gray100,
  },
  skeletonDescription: {
    marginTop: AppSpacing.sm,
    width: '80%',
    height: 14,
    borderRadius: AppBorderRadius.sm,
    backgroundColor: AppColors.gray100,
  },
  skeletonProducts: {
    marginTop: AppSpacing.lg,
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  skeletonCard: {
    width: 160,
    height: 260,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.gray100,
  },
})
