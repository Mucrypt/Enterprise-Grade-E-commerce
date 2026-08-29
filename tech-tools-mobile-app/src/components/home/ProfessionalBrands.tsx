// ============================================
// Professional Brands
//
// Mirrors e-commerce-web-store/src/components/home/ProfessionalBrands.tsx.
// Real brand records only (brandsApi.getAll). Uses a real logo
// when the brand record provides one, otherwise a clean
// text-based presentation -- no fabricated logos or manufacturer
// partnerships. Renders nothing when there are no active brands,
// matching the honest-empty-state pattern used elsewhere in this
// codebase. There is no dedicated brand-detail screen in this app,
// so tapping a brand navigates to the products list filtered by
// that brand slug (same convention the previous home screen used).
// ============================================

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { brandsApi } from '@/api'
import { Brand } from '@/types'

export default function ProfessionalBrands() {
  const router = useRouter()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadBrands() {
      try {
        const data = await brandsApi.getAll()
        if (cancelled) return
        setBrands(
          data
            .filter((brand) => brand.is_active)
            .slice(0, homepageConfig.brands.displayLimit),
        )
      } catch (error) {
        console.error('Failed to load brands:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBrands()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && brands.length === 0) return null

  const { heading, description } = homepageConfig.brands

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.description}>{description}</Text>

      {loading ? (
        <View style={styles.grid}>
          {[...Array(homepageConfig.brands.displayLimit)].map((_, i) => (
            <View key={i} style={[styles.tile, styles.skeletonTile]} />
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {brands.map((brand) => (
            <TouchableOpacity
              key={brand.id}
              style={styles.tile}
              activeOpacity={0.8}
              onPress={() =>
                router.push(`/products?brand=${brand.slug}` as never)
              }
            >
              {brand.logo_url ? (
                <Image
                  source={{ uri: brand.logo_url }}
                  style={styles.logo}
                  resizeMode='contain'
                />
              ) : (
                <Text style={styles.brandName} numberOfLines={2}>
                  {brand.name}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.white,
    borderTopWidth: 1,
    borderTopColor: AppColors.slate200,
    paddingVertical: AppSpacing['2xl'],
    paddingHorizontal: AppSpacing.base,
  },
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: AppSpacing.sm,
    rowGap: AppSpacing.sm,
  },
  tile: {
    width: '23%',
    height: 72,
    borderWidth: 1,
    borderColor: AppColors.slate200,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.xs,
  },
  skeletonTile: {
    backgroundColor: AppColors.gray100,
    borderColor: AppColors.gray100,
  },
  logo: {
    width: '100%',
    height: '70%',
  },
  brandName: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.gray700,
    textAlign: 'center',
  },
})
