// ============================================
// Shop by Trade
//
// Mirrors e-commerce-web-store/src/components/home/ShopByTrade.tsx.
// Fully data-driven from the real categories API. Curated
// professional copy/icon is applied only when a category with a
// matching slug is actually returned by the API (see
// homepageConfig.shopByTrade.curatedBySlug). Any other real,
// active category still renders honestly using its own
// name/description from the API. No category is invented and no
// database id is hardcoded.
// ============================================

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
} from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { categoriesApi } from '@/api'
import { Category } from '@/types'

const iconBySlug: Record<string, string> = {
  woodworking: 'hammer-outline',
  construction: 'construct-outline',
  metalworking: 'flame-outline',
  electrical: 'flash-outline',
  automotive: 'car-outline',
  safety: 'shield-checkmark-outline',
}

const FALLBACK_ICON = 'build-outline'

export default function ShopByTrade() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      try {
        const data = await categoriesApi.getAll()
        if (cancelled) return
        setCategories(
          data
            .filter((category) => category.is_active)
            .slice(0, homepageConfig.shopByTrade.displayLimit),
        )
      } catch (error) {
        console.error('Failed to load trade categories:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCategories()
    return () => {
      cancelled = true
    }
  }, [])

  const { heading, description, curatedBySlug } = homepageConfig.shopByTrade

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.description}>{description}</Text>

      {loading ? (
        <View style={styles.grid}>
          {[...Array(homepageConfig.shopByTrade.displayLimit)].map((_, i) => (
            <View key={i} style={[styles.card, styles.skeletonCard]} />
          ))}
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Trade categories are being finalized.{' '}
            <Text
              style={styles.emptyStateLink}
              onPress={() => router.push(homepageConfig.routes.products as never)}
            >
              Browse all products
            </Text>
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {categories.map((category) => {
            const curated = curatedBySlug[category.slug]
            const iconName = curated
              ? iconBySlug[curated.icon] ?? FALLBACK_ICON
              : FALLBACK_ICON
            const title = curated?.title ?? category.name
            const description = curated?.description ?? category.description

            return (
              <TouchableOpacity
                key={category.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() =>
                  router.push(`/category/${category.slug}` as never)
                }
              >
                <View style={styles.cardIconBadge}>
                  <Ionicons
                    name={iconName as any}
                    size={22}
                    color={AppColors.orangeAccent}
                  />
                </View>
                <Text style={styles.cardTitle}>{title}</Text>
                {!!description && (
                  <Text style={styles.cardDescription} numberOfLines={3}>
                    {description}
                  </Text>
                )}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>Shop {title}</Text>
                  <Ionicons
                    name='chevron-forward'
                    size={14}
                    color={AppColors.gray900}
                  />
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.white,
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
    columnGap: AppSpacing.md,
    rowGap: AppSpacing.md,
  },
  card: {
    width: '47%',
    borderWidth: 1,
    borderColor: AppColors.slate200,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
  },
  skeletonCard: {
    height: 150,
    backgroundColor: AppColors.gray100,
    borderColor: AppColors.gray100,
  },
  cardIconBadge: {
    width: 44,
    height: 44,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.slate900,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    marginTop: AppSpacing.sm,
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  cardDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: AppColors.slate500,
  },
  cardFooter: {
    marginTop: AppSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  emptyState: {
    marginTop: AppSpacing.xl,
    borderWidth: 1,
    borderColor: AppColors.slate200,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.background,
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
})
