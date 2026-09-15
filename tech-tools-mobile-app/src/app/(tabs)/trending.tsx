// ============================================
// TechTools Mobile App - Trending Tab Screen
// ============================================

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  Text,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  TrendingHeader,
  TrendingCollectionCard,
  TrendingBrandSection,
  TrendingCategoryFilter,
  SectionHeader,
} from '@/components'
import { AppColors, AppSpacing } from '@/constants/appTheme'
import { trendingApi, collectionsApi, categoriesApi, brandsApi, productsApi } from '@/api'
import { ProductCollection, Category, Brand, Product } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'expo-router'

const { width } = Dimensions.get('window')

type BrandStatsMap = Record<
  string,
  { productCount: number; unitsSold: number; revenueTotal: number; newProductsCount: number; followerCount: number }
>
type TopReviewsMap = Record<string, { rating: number; comment: string; authorName: string }>

export default function TrendingTabScreen() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Data states
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brandsWithProducts, setBrandsWithProducts] = useState<
    Array<{ brand: Brand; products: Product[] }>
  >([])
  const [brandStats, setBrandStats] = useState<BrandStatsMap>({})
  const [topReviews, setTopReviews] = useState<TopReviewsMap>({})
  const [followedBrandIds, setFollowedBrandIds] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [trendingItemCount, setTrendingItemCount] = useState<number | undefined>()
  const [featuredStoreCount, setFeaturedStoreCount] = useState<number | undefined>()

  const fetchData = useCallback(async () => {
    try {
      const [collectionsRes, categoriesRes, brandsRes, allBrandsRes, featuredRes] = await Promise.all([
        collectionsApi.getFeatured(8),
        categoriesApi.getAll(),
        trendingApi.getBrandsWithProducts(6, 4),
        brandsApi.getAll(),
        productsApi.getAll({ featured: true, limit: 1 }),
      ])

      setCollections(collectionsRes)
      setCategories(categoriesRes.slice(0, 8))
      setBrandsWithProducts(brandsRes)
      setFeaturedStoreCount(allBrandsRes.filter((b) => b.is_active).length)
      setTrendingItemCount(featuredRes.pagination?.total)

      // Real units-sold/new-product/follower numbers for the stores just
      // loaded, plus a real testimonial where one exists -- fetched
      // separately since getBrandsWithProducts doesn't return them. Never
      // fabricated: a brand with no real sales/followers/reviews yet just
      // comes back at zero/absent rather than a random placeholder.
      const brandIds = brandsRes.map((b) => b.brand.id)
      if (brandIds.length > 0) {
        const { stats, topReviews: reviews } = await brandsApi.getStats(brandIds)
        setBrandStats(stats)
        setTopReviews(reviews)
      }

      if (isAuthenticated) {
        try {
          const followed = await brandsApi.getFollowed()
          setFollowedBrandIds(new Set(followed))
        } catch {
          // Best-effort -- an empty set just means every card shows "Follow".
        }
      }
    } catch (error) {
      console.error('Error fetching trending data:', error)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const handleToggleFollow = useCallback(
    async (brandId: string) => {
      if (!isAuthenticated) {
        router.push('/(auth)/login')
        return
      }

      const isFollowing = followedBrandIds.has(brandId)
      // Optimistic -- flip immediately, revert if the request fails.
      setFollowedBrandIds((prev) => {
        const next = new Set(prev)
        if (isFollowing) next.delete(brandId)
        else next.add(brandId)
        return next
      })
      setBrandStats((prev) => {
        if (!prev[brandId]) return prev
        const delta = isFollowing ? -1 : 1
        return {
          ...prev,
          [brandId]: { ...prev[brandId], followerCount: Math.max(0, prev[brandId].followerCount + delta) },
        }
      })

      try {
        if (isFollowing) await brandsApi.unfollow(brandId)
        else await brandsApi.follow(brandId)
      } catch {
        setFollowedBrandIds((prev) => {
          const next = new Set(prev)
          if (isFollowing) next.add(brandId)
          else next.delete(brandId)
          return next
        })
      }
    },
    [followedBrandIds, isAuthenticated, router],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  const handleCategorySelect = (slug: string | null) => {
    setSelectedCategory(slug)
    // TODO: Filter brands by category
  }

  // Filter brands based on selected category
  const filteredBrands = selectedCategory
    ? brandsWithProducts.filter((item) =>
        item.products.some((p) => p.category_slug === selectedCategory),
      )
    : brandsWithProducts

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TrendingHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading trending...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <TrendingHeader
        title='Trending'
        trendingItemCount={trendingItemCount}
        featuredStoreCount={featuredStoreCount}
      />

      {/* Category Filter */}
      <TrendingCategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[AppColors.primary]}
            tintColor={AppColors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Trending Collections Section */}
        {collections.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title='Trending Collections'
              subtitle='Curated for you'
              icon='sparkles'
            />
            <FlatList
              horizontal
              data={collections}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <TrendingCollectionCard
                  collection={item}
                  products={item.products || []}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Featured Brands/Stores Section */}
        <View style={styles.section}>
          <SectionHeader
            title='Featured Stores'
            subtitle='Top brands & sellers'
            icon='storefront-outline'
          />

          {filteredBrands.length > 0 ? (
            filteredBrands.map((item) => (
              <TrendingBrandSection
                key={item.brand.id}
                brand={item.brand}
                products={item.products}
                stats={
                  brandStats[item.brand.id]
                    ? {
                        soldCount: brandStats[item.brand.id].unitsSold,
                        newProductsCount: brandStats[item.brand.id].newProductsCount,
                        followerCount: brandStats[item.brand.id].followerCount,
                      }
                    : undefined
                }
                review={topReviews[item.brand.id]}
                isFollowing={followedBrandIds.has(item.brand.id)}
                onToggleFollow={() => handleToggleFollow(item.brand.id)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No stores found for this category
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Spacer for Tab Bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: AppColors.gray500,
  },
  scrollContent: {
    paddingTop: AppSpacing.base,
  },
  section: {
    marginBottom: AppSpacing.lg,
  },
  horizontalList: {
    paddingHorizontal: AppSpacing.base,
  },
  emptyState: {
    padding: AppSpacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: AppColors.gray500,
  },
  bottomSpacer: {
    height: 100,
  },
})
