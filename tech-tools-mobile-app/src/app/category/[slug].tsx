// ============================================
// TechTools Mobile App - Category Details Screen
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
import { ProductCard } from '@/components'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { api } from '@/api'
import type { Product, Category } from '@/types'

export default function CategoryDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategoryProducts = useCallback(async () => {
    if (!slug) return

    try {
      setLoading(true)
      setError(null)

      // Fetch category details
      const categories = await api.categories.getAll()
      const foundCategory = categories.find((c) => c.slug === slug)
      if (foundCategory) {
        setCategory(foundCategory)
      }

      // Fetch products for this category
      const productsRes = await api.products.getAll({
        category: slug,
        limit: 50,
      })
      setProducts(productsRes.products || [])
    } catch (err) {
      console.error('Error fetching category products:', err)
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchCategoryProducts()
  }, [fetchCategoryProducts])

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productWrapper}>
      <ProductCard product={item} />
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name='arrow-back' size={24} color={AppColors.gray800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={AppColors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name='arrow-back' size={24} color={AppColors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{category?.name || slug}</Text>
        <View style={{ width: 24 }} />
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name='alert-circle-outline'
            size={48}
            color={AppColors.gray400}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchCategoryProducts}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name='cube-outline' size={48} color={AppColors.gray400} />
          <Text style={styles.emptyText}>
            No products found in this category
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
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyText: {
    fontSize: 16,
    color: AppColors.gray600,
    marginTop: AppSpacing.md,
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
