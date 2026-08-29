// ============================================
// Featured Professional Tools
//
// Mirrors e-commerce-web-store/src/components/home/FeaturedProfessionalTools.tsx.
// Real data only: uses the existing productsApi.getFeatured
// endpoint, no hardcoded products/prices/stock/ratings. Only a
// single "Featured" section is shown (no Best Sellers / New
// Arrivals tabs) because the backend has no real sales-ranking or
// "new" classification wired to this endpoint -- adding tabs would
// mean fabricating labels, which is explicitly disallowed.
//
// Uses the shared src/components/ProductCard.tsx as-is (the
// SHEIN-style quick-add card already used across the app) rather
// than introducing a second, homepage-only card component -- this
// app doesn't have the web's separate listing-page card, so there
// is no existing split to mirror, and reusing it keeps the
// featured-products tap/add-to-cart behavior consistent everywhere.
// ============================================

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { productsApi } from '@/api'
import { Product } from '@/types'
import ProductCard from '@/components/ProductCard'

export default function FeaturedProfessionalTools() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      try {
        const data = await productsApi.getFeatured(
          homepageConfig.featuredTools.fetchLimit,
        )
        if (cancelled) return

        const active = data.filter((product) => product.is_active)
        // Show in-stock items first so the lead item is never out of
        // stock, without fabricating stock for anything.
        const sorted = [...active].sort((a, b) => {
          const aInStock = a.total_stock > 0 ? 1 : 0
          const bInStock = b.total_stock > 0 ? 1 : 0
          return bInStock - aInStock
        })

        setProducts(
          sorted.slice(0, homepageConfig.featuredTools.displayLimit),
        )
      } catch (error) {
        console.error('Failed to load featured products:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProducts()
    return () => {
      cancelled = true
    }
  }, [])

  const { heading, description } = homepageConfig.featuredTools

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.grid}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No featured products are available right now.{' '}
            <Text
              style={styles.emptyStateLink}
              onPress={() => router.push(homepageConfig.routes.products as never)}
            >
              Browse the full catalogue
            </Text>
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={() => router.push(homepageConfig.routes.products as never)}
      >
        <Text style={styles.viewAllText}>View All Products</Text>
        <Ionicons name='arrow-forward' size={16} color={AppColors.gray900} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.background,
    paddingVertical: AppSpacing['2xl'],
  },
  headerRow: {
    paddingHorizontal: AppSpacing.base,
  },
  headerText: {},
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: AppColors.gray900,
    letterSpacing: -0.3,
  },
  description: {
    marginTop: AppSpacing.sm,
    fontSize: 14,
    color: AppColors.slate500,
    lineHeight: 20,
  },
  grid: {
    marginTop: AppSpacing.xl,
    paddingHorizontal: AppSpacing.base,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skeletonCard: {
    width: '47%',
    height: 260,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.gray100,
    marginBottom: AppSpacing.base,
  },
  emptyState: {
    marginTop: AppSpacing.xl,
    marginHorizontal: AppSpacing.base,
    borderWidth: 1,
    borderColor: AppColors.slate200,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.white,
    padding: AppSpacing.xl,
  },
  emptyStateText: {
    fontSize: 13,
    color: AppColors.slate500,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyStateLink: {
    fontWeight: '700',
    color: AppColors.primary,
  },
  viewAllButton: {
    marginTop: AppSpacing.lg,
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
})
