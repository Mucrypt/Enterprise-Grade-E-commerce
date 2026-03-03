// ============================================
// TechTools Mobile App - Explore Tab Screen
// ============================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { CategoryCard, ProductCard } from '@/components'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppGradients,
} from '@/constants/appTheme'
import { categoriesApi, productsApi, brandsApi } from '@/api'
import { Category, Product, Brand } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'

const { width } = Dimensions.get('window')

const TRENDING_SEARCHES = [
  'iPhone Cases',
  'Wireless Chargers',
  'USB-C Cables',
  'Laptop Stands',
  'Power Banks',
  'Screen Protectors',
]

export default function ExploreTabScreen() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [recentProducts, setRecentProducts] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const fetchInitialData = async () => {
    try {
      const [categoriesRes, brandsRes, productsRes] = await Promise.all([
        categoriesApi.getAll(),
        brandsApi.getAll(),
        productsApi.getAll({ limit: 12 }),
      ])
      setCategories(categoriesRes.slice(0, 12))
      setBrands(brandsRes.slice(0, 10))
      setRecentProducts((productsRes.products || []).slice(0, 8))
    } catch (error) {
      console.error('Error fetching explore data:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await productsApi.search(query)
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    searchProducts(debouncedSearch)
  }, [debouncedSearch])

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name='search-outline' size={20} color={AppColors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder='Search products, brands...'
            placeholderTextColor={AppColors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType='search'
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons
                name='close-circle'
                size={20}
                color={AppColors.gray400}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results */}
      {searchQuery.length > 0 ? (
        <View style={styles.searchResultsContainer}>
          {isSearching ? (
            <View style={styles.searchingContainer}>
              <ActivityIndicator size='small' color={AppColors.primary} />
              <Text style={styles.searchingText}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.searchResultsGrid}
              renderItem={({ item }) => <ProductCard product={item} />}
              contentContainerStyle={styles.searchResultsList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.noResultsContainer}>
              <Ionicons
                name='search-outline'
                size={48}
                color={AppColors.gray300}
              />
              <Text style={styles.noResultsTitle}>No results found</Text>
              <Text style={styles.noResultsText}>
                Try different keywords or browse categories
              </Text>
            </View>
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Trending Searches */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Searches</Text>
            <View style={styles.trendingContainer}>
              {TRENDING_SEARCHES.map((term, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.trendingChip}
                  onPress={() => setSearchQuery(term)}
                >
                  <Ionicons
                    name='trending-up'
                    size={14}
                    color={AppColors.primary}
                  />
                  <Text style={styles.trendingText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Categories */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Shop by Category</Text>
              <TouchableOpacity onPress={() => router.push('/products')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.categoriesGrid}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryItem}
                  onPress={() =>
                    router.push(`/products?category=${category.slug}`)
                  }
                >
                  <LinearGradient
                    colors={
                      AppGradients.primary as [string, string, ...string[]]
                    }
                    style={styles.categoryIcon}
                  >
                    <Ionicons
                      name='grid-outline'
                      size={24}
                      color={AppColors.white}
                    />
                  </LinearGradient>
                  <Text style={styles.categoryName} numberOfLines={2}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Top Brands */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Brands</Text>
              <TouchableOpacity onPress={() => router.push('/products')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={brands}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.brandsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.brandItem}
                  onPress={() => router.push(`/products?brand=${item.slug}`)}
                >
                  <View style={styles.brandLogo}>
                    <Text style={styles.brandInitial}>
                      {item.name.charAt(0)}
                    </Text>
                  </View>
                  <Text style={styles.brandName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Recently Viewed / Popular */}
          <View style={[styles.section, styles.lastSection]}>
            <Text style={styles.sectionTitle}>Popular Products</Text>
            <View style={styles.productsGrid}>
              {recentProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
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
    backgroundColor: AppColors.background,
  },
  header: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.gray100,
    borderRadius: AppBorderRadius.lg,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: AppSpacing.sm,
    fontSize: 16,
    color: AppColors.gray800,
  },
  searchResultsContainer: {
    flex: 1,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: AppSpacing.xl,
  },
  searchingText: {
    marginLeft: AppSpacing.sm,
    color: AppColors.gray600,
  },
  searchResultsGrid: {
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
  },
  searchResultsList: {
    paddingTop: AppSpacing.md,
    paddingBottom: AppSpacing['3xl'],
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppSpacing.xl,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray800,
    marginTop: AppSpacing.md,
  },
  noResultsText: {
    fontSize: 14,
    color: AppColors.gray500,
    marginTop: AppSpacing.xs,
    textAlign: 'center',
  },
  section: {
    marginTop: AppSpacing.lg,
    paddingHorizontal: AppSpacing.base,
  },
  lastSection: {
    marginBottom: AppSpacing['3xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppSpacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray800,
    marginBottom: AppSpacing.md,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
  },
  trendingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${AppColors.primary}10`,
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: AppSpacing.md,
    borderRadius: 20,
    gap: AppSpacing.xs,
  },
  trendingText: {
    fontSize: 13,
    color: AppColors.primary,
    fontWeight: '500',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: AppSpacing.sm,
  },
  categoryItem: {
    width: (width - AppSpacing.base * 2 - AppSpacing.sm * 3) / 4,
    alignItems: 'center',
    marginBottom: AppSpacing.md,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.xs,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '500',
    color: AppColors.gray700,
    textAlign: 'center',
  },
  brandsList: {
    paddingBottom: AppSpacing.sm,
  },
  brandItem: {
    alignItems: 'center',
    marginRight: AppSpacing.lg,
    width: 70,
  },
  brandLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: AppSpacing.xs,
  },
  brandInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.primary,
  },
  brandName: {
    fontSize: 12,
    color: AppColors.gray600,
    textAlign: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
})
