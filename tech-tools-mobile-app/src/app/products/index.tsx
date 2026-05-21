// ============================================
// TechTools Mobile App - Products List Screen
// ============================================

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ProductCard, SearchBar } from '@/components'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { productsApi, collectionsApi } from '@/api'
import { Product, ProductFilters } from '@/types'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - AppSpacing.base * 3) / 2

const sortOptions = [
  { label: 'Newest', value: 'created_at:desc' },
  { label: 'Price: Low to High', value: 'price:asc' },
  { label: 'Price: High to Low', value: 'price:desc' },
  { label: 'Name A-Z', value: 'name:asc' },
]

export default function ProductsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at:desc')
  const [showSort, setShowSort] = useState(false)

  const fetchProducts = useCallback(
    async (pageNum = 1, refresh = false) => {
      try {
        if (typeof params.collection === 'string' && params.collection) {
          const collection = await collectionsApi.getBySlug(params.collection)
          const collectionProducts = collection.products || []

          setProducts(collectionProducts)
          setHasMore(false)
          setPage(1)
          return
        }

        const filters: ProductFilters & { page: number; limit: number } = {
          page: pageNum,
          limit: 20,
          sortBy,
          search: searchQuery || undefined,
          category: params.category as string | undefined,
          featured: params.featured === 'true' ? true : undefined,
        }

        const result = await productsApi.getAll(filters)

        if (refresh || pageNum === 1) {
          setProducts(result.products)
        } else {
          setProducts((prev) => [...prev, ...result.products])
        }

        setHasMore(result.products.length === 20)
        setPage(pageNum)
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [sortBy, searchQuery, params.category, params.featured, params.collection],
  )

  useEffect(() => {
    fetchProducts(1, true)
  }, [fetchProducts])

  const onRefresh = () => {
    setRefreshing(true)
    fetchProducts(1, true)
  }

  const onEndReached = () => {
    if (!loading && hasMore) {
      fetchProducts(page + 1)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setLoading(true)
    fetchProducts(1, true)
  }

  const handleSort = (value: string) => {
    setSortBy(value)
    setShowSort(false)
    setLoading(true)
    fetchProducts(1, true)
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name='arrow-back' size={24} color={AppColors.gray800} />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <SearchBar
            placeholder='Search products...'
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={() => handleSearch(searchQuery)}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.resultCount}>{products.length} products</Text>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSort(!showSort)}
        >
          <Ionicons name='swap-vertical' size={18} color={AppColors.gray600} />
          <Text style={styles.sortText}>Sort</Text>
        </TouchableOpacity>
      </View>

      {showSort && (
        <View style={styles.sortOptions}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionActive,
              ]}
              onPress={() => handleSort(option.value)}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === option.value && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.value && (
                <Ionicons
                  name='checkmark'
                  size={18}
                  color={AppColors.primary}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )

  if (loading && products.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            <ProductCard product={item} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name='search-outline'
              size={64}
              color={AppColors.gray300}
            />
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
        ListFooterComponent={
          loading && products.length > 0 ? (
            <ActivityIndicator
              style={styles.footer}
              color={AppColors.primary}
            />
          ) : null
        }
      />
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
    backgroundColor: AppColors.white,
    paddingBottom: AppSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingTop: AppSpacing.sm,
  },
  backButton: {
    marginRight: AppSpacing.sm,
  },
  searchContainer: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingTop: AppSpacing.md,
  },
  resultCount: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  sortOptions: {
    marginTop: AppSpacing.md,
    marginHorizontal: AppSpacing.base,
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    padding: AppSpacing.sm,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: AppSpacing.md,
    borderRadius: AppBorderRadius.sm,
  },
  sortOptionActive: {
    backgroundColor: AppColors.white,
  },
  sortOptionText: {
    fontSize: 14,
    color: AppColors.gray700,
  },
  sortOptionTextActive: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: AppSpacing.base,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: CARD_WIDTH,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: AppColors.gray500,
    marginTop: AppSpacing.md,
  },
  footer: {
    paddingVertical: AppSpacing.lg,
  },
})
