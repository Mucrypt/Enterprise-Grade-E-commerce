// ============================================
// TechTools Mobile App - Collection Detail Screen
// ============================================
// Real landing screen for an admin-curated collection -- a
// category_collections campaign (a set of categories, e.g. "Featured
// Categories") or a product_collections campaign (a set of products,
// e.g. "Best Sellers" / "Hot Right Now"). Mirrors
// e-commerce-web-store/src/pages/CollectionPage.tsx: tries the
// category-collection lookup first, falls back to the product-collection
// lookup if that 404s, so every collection type gets a real screen under
// one /collections/:slug route. A collection that's inactive, private, or
// outside its scheduled window 404s server-side either way, so this
// screen never has to guess about availability.
//
// This replaces the previous dead-end of routing collection taps to
// /products?collection=slug, a filter productsApi never actually
// implemented -- FeaturedCollectionsShowcase and TrendingCollectionCard
// both now route here instead.
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { categoryCollectionsApi, collectionsApi } from '@/api'
import type { CategoryCollection, ProductCollection } from '@/types'
import { CategoryCard, ProductCard } from '@/components'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppGradients,
} from '@/constants/appTheme'

type LoadedCollection =
  | { kind: 'category'; data: CategoryCollection }
  | { kind: 'product'; data: ProductCollection }

export default function CollectionDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()

  const [collection, setCollection] = useState<LoadedCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load(collectionSlug: string) {
      setLoading(true)
      setNotFound(false)
      try {
        try {
          const data = await categoryCollectionsApi.getBySlug(collectionSlug)
          if (!cancelled) {
            setCollection({ kind: 'category', data })
            return
          }
        } catch {
          // Not a category collection -- try product collection next.
        }
        const data = await collectionsApi.getBySlug(collectionSlug)
        if (!cancelled) setCollection({ kind: 'product', data })
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load(slug)
    return () => {
      cancelled = true
    }
  }, [slug])

  const Header = ({ title }: { title: string }) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons name='arrow-back' size={24} color={AppColors.white} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <LinearGradient colors={AppGradients.industrial} style={styles.heroFallback}>
          <Header title='Loading...' />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={AppColors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (notFound || !collection) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <LinearGradient colors={AppGradients.industrial} style={styles.heroFallback}>
          <Header title='Not available' />
        </LinearGradient>
        <View style={styles.notFoundContainer}>
          <Ionicons name='pricetags-outline' size={56} color={AppColors.gray300} />
          <Text style={styles.notFoundTitle}>This collection isn&apos;t available</Text>
          <Text style={styles.notFoundText}>
            It may have ended, or the link may be out of date.
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/products' as never)}
          >
            <Text style={styles.browseButtonText}>Browse All Products</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const { data } = collection
  const heroImage = data.banner_url || data.image_url

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {heroImage ? (
          <View style={styles.heroImageWrap}>
            <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode='cover' />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.heroOverlay}
            >
              <Header title={data.name} />
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroTitle}>{data.name}</Text>
                {!!data.short_description && (
                  <Text style={styles.heroSubtitle} numberOfLines={2}>
                    {data.short_description}
                  </Text>
                )}
              </View>
            </LinearGradient>
          </View>
        ) : (
          <LinearGradient colors={AppGradients.industrial} style={styles.heroFallback}>
            <Header title={data.name} />
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>{data.name}</Text>
              {!!data.short_description && (
                <Text style={styles.heroSubtitle} numberOfLines={2}>
                  {data.short_description}
                </Text>
              )}
            </View>
          </LinearGradient>
        )}

        <View style={styles.content}>
          {!!data.description && <Text style={styles.description}>{data.description}</Text>}

          {collection.kind === 'category' ? (
            collection.data.categories.length === 0 ? (
              <Text style={styles.emptyText}>
                No categories have been added to this collection yet.
              </Text>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Shop this collection</Text>
                <View style={styles.categoryGrid}>
                  {collection.data.categories.map((category) => (
                    <View key={category.id} style={styles.categoryGridItem}>
                      <CategoryCard category={category} size='large' />
                    </View>
                  ))}
                </View>
              </>
            )
          ) : (collection.data.products || []).length === 0 ? (
            <Text style={styles.emptyText}>
              No products have been added to this collection yet.
            </Text>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Shop this collection</Text>
              <FlatList
                data={collection.data.products}
                keyExtractor={(product) => product.id}
                numColumns={2}
                columnWrapperStyle={styles.productRow}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.productItem}>
                    <ProductCard product={item} />
                  </View>
                )}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const HERO_HEIGHT = 220

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingTop: AppSpacing.base,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: AppSpacing.sm,
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
    textAlign: 'center',
  },
  heroImageWrap: {
    height: HERO_HEIGHT,
    width: '100%',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: AppSpacing.lg,
  },
  heroFallback: {
    height: HERO_HEIGHT,
    justifyContent: 'space-between',
    paddingBottom: AppSpacing.lg,
  },
  heroTextBlock: {
    paddingHorizontal: AppSpacing.base,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: AppColors.white,
  },
  heroSubtitle: {
    marginTop: AppSpacing.xs,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  content: {
    padding: AppSpacing.base,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.gray600,
    marginBottom: AppSpacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: AppSpacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.gray500,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.md,
  },
  categoryGridItem: {
    width: '31%',
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: AppSpacing.md,
  },
  productItem: {
    width: '48%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.xl,
  },
  notFoundTitle: {
    marginTop: AppSpacing.base,
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  notFoundText: {
    marginTop: AppSpacing.xs,
    fontSize: 13,
    color: AppColors.gray500,
    textAlign: 'center',
  },
  browseButton: {
    marginTop: AppSpacing.xl,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.xl,
    paddingVertical: AppSpacing.md,
  },
  browseButtonText: {
    color: AppColors.white,
    fontWeight: '700',
    fontSize: 14,
  },
})
