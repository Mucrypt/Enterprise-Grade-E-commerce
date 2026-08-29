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
import {
  ProductCard,
  SearchBar,
  FilterSheet,
  ActiveFilterChips,
} from '@/components'
import type { ProductFilterState } from '@/components'
import type { RemovableFilterKey } from '@/components/product/ActiveFilterChips'
import { countActiveFilters } from '@/components/product/FilterSheet'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { productsApi, collectionsApi, categoriesApi, brandsApi } from '@/api'
import { Product, ProductFilters, Category, Brand } from '@/types'

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
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at:desc')
  const [showSort, setShowSort] = useState(false)

  // Real, user-selectable filters (category/brand/price/rating/category
  // attributes/in-stock) -- category seeds from the route param (e.g. a
  // category card deep-link) but stays editable/clearable here, it isn't
  // locked to the route.
  const [appliedFilters, setAppliedFilters] = useState<ProductFilterState>({
    category: typeof params.category === 'string' ? params.category : undefined,
  })
  const [filterSheetVisible, setFilterSheetVisible] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])

  useEffect(() => {
    categoriesApi
      .getAll()
      .then(setCategories)
      .catch(() => setCategories([]))
    brandsApi
      .getAll()
      .then(setBrands)
      .catch(() => setBrands([]))
  }, [])

  const fetchProducts = useCallback(
    async (pageNum = 1, refresh = false) => {
      try {
        if (typeof params.collection === 'string' && params.collection) {
          const collection = await collectionsApi.getBySlug(params.collection)
          const collectionProducts = collection.products || []

          setProducts(collectionProducts)
          setTotalCount(collectionProducts.length)
          setHasMore(false)
          setPage(1)
          return
        }

        const filters: ProductFilters & { page: number; limit: number } = {
          page: pageNum,
          limit: 20,
          sortBy,
          search: searchQuery || undefined,
          category: appliedFilters.category,
          brand: appliedFilters.brand,
          minPrice: appliedFilters.minPrice,
          maxPrice: appliedFilters.maxPrice,
          minRating: appliedFilters.minRating,
          inStock: appliedFilters.inStock || undefined,
          attributes: appliedFilters.attributes,
          featured: params.featured === 'true' ? true : undefined,
        }

        const result = await productsApi.getAll(filters)

        if (refresh || pageNum === 1) {
          setProducts(result.products)
        } else {
          setProducts((prev) => [...prev, ...result.products])
        }

        setTotalCount(result.pagination?.total ?? result.products.length)
        setHasMore(result.products.length === 20)
        setPage(pageNum)
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [
      sortBy,
      searchQuery,
      appliedFilters,
      params.featured,
      params.collection,
    ],
  )

  useEffect(() => {
    fetchProducts(1, true)
  }, [fetchProducts])

  // Real backend count preview for a draft filter set (search + featured
  // context preserved) -- powers the filter sheet's sticky "Show N
  // results" button. Never a fabricated number.
  const fetchPreviewCount = useCallback(
    async (draft: ProductFilterState): Promise<number> => {
      const result = await productsApi.getAll({
        page: 1,
        limit: 1,
        search: searchQuery || undefined,
        category: draft.category,
        brand: draft.brand,
        minPrice: draft.minPrice,
        maxPrice: draft.maxPrice,
        minRating: draft.minRating,
        inStock: draft.inStock || undefined,
        attributes: draft.attributes,
        featured: params.featured === 'true' ? true : undefined,
      })
      return result.pagination?.total ?? result.products.length
    },
    [searchQuery, params.featured],
  )

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

  const handleApplyFilters = (newFilters: ProductFilterState) => {
    setAppliedFilters(newFilters)
    setLoading(true)
  }

  const handleRemoveFilter = (key: RemovableFilterKey) => {
    setAppliedFilters((prev) => {
      if (typeof key === 'object') {
        const attrs = { ...(prev.attributes || {}) }
        delete attrs[key.attribute]
        return {
          ...prev,
          attributes: Object.keys(attrs).length ? attrs : undefined,
        }
      }
      switch (key) {
        case 'category':
          return { ...prev, category: undefined }
        case 'brand':
          return { ...prev, brand: undefined }
        case 'price':
          return { ...prev, minPrice: undefined, maxPrice: undefined }
        case 'rating':
          return { ...prev, minRating: undefined }
        case 'inStock':
          return { ...prev, inStock: undefined }
        default:
          return prev
      }
    })
    setLoading(true)
  }

  const handleClearAllFilters = () => {
    setAppliedFilters({})
    setLoading(true)
  }

  const activeFilterCount = countActiveFilters(appliedFilters)

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

      <View style={styles.toolbar}>
        <Text style={styles.resultCount}>
          {totalCount} {totalCount === 1 ? 'result' : 'results'}
        </Text>

        <View style={styles.toolbarActions}>
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => setShowSort(!showSort)}
          >
            <Ionicons
              name='swap-vertical'
              size={16}
              color={showSort ? AppColors.primary : AppColors.slate500}
            />
            <Text
              style={[
                styles.toolbarButtonText,
                showSort && styles.toolbarButtonTextActive,
              ]}
            >
              Sort
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolbarButton,
              activeFilterCount > 0 && styles.toolbarButtonActive,
            ]}
            onPress={() => setFilterSheetVisible(true)}
          >
            <Ionicons
              name='options-outline'
              size={16}
              color={
                activeFilterCount > 0 ? AppColors.primary : AppColors.slate500
              }
            />
            <Text
              style={[
                styles.toolbarButtonText,
                activeFilterCount > 0 && styles.toolbarButtonTextActive,
              ]}
            >
              Filters
            </Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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

      <ActiveFilterChips
        filters={appliedFilters}
        categories={categories}
        brands={brands}
        onRemove={handleRemoveFilter}
        onClearAll={handleClearAllFilters}
      />
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

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        categories={categories}
        brands={brands}
        filters={appliedFilters}
        onApply={handleApplyFilters}
        fetchPreviewCount={fetchPreviewCount}
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
    paddingBottom: AppSpacing.sm,
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingTop: AppSpacing.md,
  },
  resultCount: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.slate500,
    letterSpacing: 0.1,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 7,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.gray50,
    borderWidth: 1,
    borderColor: AppColors.gray100,
  },
  toolbarButtonActive: {
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    borderColor: AppColors.primaryLight,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.slate500,
  },
  toolbarButtonTextActive: {
    color: AppColors.primary,
  },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.white,
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
