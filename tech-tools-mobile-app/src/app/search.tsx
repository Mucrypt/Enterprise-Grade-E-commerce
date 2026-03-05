// ============================================
// TechTools Mobile App - Search Results Screen
// ============================================

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ProductCard, SearchBar } from '@/components'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { api } from '@/api'
import type { Product } from '@/types'

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q: string }>()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(q || '')

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setProducts([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await api.products.getAll({ search: query, limit: 50 })
      setProducts(response.products || [])
    } catch (err) {
      console.error('Error searching products:', err)
      setError('Failed to search products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (q) {
      setSearchQuery(q)
      searchProducts(q)
    }
  }, [q, searchProducts])

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchProducts(searchQuery.trim())
    }
  }

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productWrapper}>
      <ProductCard product={item} />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name='arrow-back' size={24} color={AppColors.gray800} />
        </TouchableOpacity>
        <View style={styles.searchWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearch}
            placeholder='Search products...'
          />
        </View>
      </View>

      {/* Results count */}
      {!loading && products.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            {products.length} result{products.length !== 1 ? 's' : ''} for "{q}"
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={AppColors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name='alert-circle-outline'
            size={48}
            color={AppColors.gray400}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleSearch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name='search-outline' size={48} color={AppColors.gray400} />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptyText}>
            Try searching for something else or check your spelling
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productsList}
          columnWrapperStyle={styles.productsRow}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
    gap: AppSpacing.sm,
  },
  backButton: {
    padding: AppSpacing.xs,
  },
  searchWrapper: {
    flex: 1,
  },
  resultsHeader: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  resultsText: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: AppSpacing.md,
    fontSize: 14,
    color: AppColors.gray600,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppSpacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: AppColors.gray600,
    marginTop: AppSpacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: AppSpacing.lg,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
  },
  retryButtonText: {
    color: AppColors.white,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppSpacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray800,
    marginTop: AppSpacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.gray600,
    marginTop: AppSpacing.sm,
    textAlign: 'center',
  },
  productsList: {
    padding: AppSpacing.base,
    paddingBottom: 100,
  },
  productsRow: {
    justifyContent: 'space-between',
  },
  productWrapper: {
    width: '48%',
    marginBottom: AppSpacing.base,
  },
})
