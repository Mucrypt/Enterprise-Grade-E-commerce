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
import { trendingApi, collectionsApi, categoriesApi, brandsApi } from '@/api'
import { ProductCollection, Category, Brand, Product } from '@/types'

const { width } = Dimensions.get('window')

type BrandStatsMap = Record<
  string,
  { productCount: number; unitsSold: number; revenueTotal: number; newProductsCount: number }
>

export default function TrendingTabScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Data states
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brandsWithProducts, setBrandsWithProducts] = useState<
    Array<{ brand: Brand; products: Product[] }>
  >([])
  const [brandStats, setBrandStats] = useState<BrandStatsMap>({})
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [collectionsRes, categoriesRes, brandsRes] = await Promise.all([
        collectionsApi.getFeatured(8),
        categoriesApi.getAll(),
        trendingApi.getBrandsWithProducts(6, 4),
      ])

      setCollections(collectionsRes)
      setCategories(categoriesRes.slice(0, 8))
      setBrandsWithProducts(brandsRes)

      // Real units-sold/new-product numbers for the stores just loaded --
      // fetched separately since getBrandsWithProducts doesn't return them.
      // Never fabricated: a brand with no real sales yet just comes back
      // at zero rather than a random placeholder.
      const brandIds = brandsRes.map((b) => b.brand.id)
      if (brandIds.length > 0) {
        const stats = await brandsApi.getStats(brandIds)
        setBrandStats(stats)
      }
    } catch (error) {
      console.error('Error fetching trending data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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
      <TrendingHeader title='Trending' />

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
                      }
                    : undefined
                }
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
