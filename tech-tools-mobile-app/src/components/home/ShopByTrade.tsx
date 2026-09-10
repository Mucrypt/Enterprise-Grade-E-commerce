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
//
// Layout: a dense, icon-forward circular grid (5 per row) rather than
// the previous 2-per-row description cards -- matches the reference
// mobile layout's category grid density (scannable at a glance, more
// items visible at once). Per-category description/"Shop X" copy was
// dropped to make room; the category name plus its real icon is still
// enough to identify it, and tapping still goes to the same real
// /category/[slug] screen either way.
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
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

const COLUMNS = 5
const GRID_GAP = AppSpacing.sm
const { width: SCREEN_WIDTH } = Dimensions.get('window')
const ITEM_WIDTH =
  (SCREEN_WIDTH - AppSpacing.base * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS

// Keyed by the curated `icon` tag in homepageConfig.shopByTrade.curatedBySlug
// (see there), not the category slug itself -- one distinct Ionicon per
// real trade vertical, same choices as CategoryIcons in appTheme.ts so
// this screen and the Categories grid read as one visual system.
const iconBySlug: Record<string, string> = {
  woodworking: 'hammer-outline',
  automotive: 'car-sport-outline',
  interior: 'bed-outline',
  safety: 'shield-checkmark-outline',
  emergency: 'warning-outline',
  audio: 'musical-notes-outline',
  exterior: 'car-outline',
  lighting: 'bulb-outline',
  cleaning: 'water-outline',
  mounts: 'phone-portrait-outline',
  performance: 'speedometer-outline',
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
        // Top-level only -- the plain (non-tree) categories endpoint
        // returns all ~84 categories flat, alphabetically, with no
        // parent/child distinction. Without this filter, "Shop by Trade"
        // could show subcategories (e.g. "Adhesives & Sealants") instead
        // of the real trade verticals (e.g. "Home Improvement & Tools").
        setCategories(
          data
            .filter((category) => category.is_active && !category.parent_id)
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
            <View key={i} style={styles.item}>
              <View style={[styles.cardIconBadge, styles.skeletonBadge]} />
              <View style={styles.skeletonLabel} />
            </View>
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

            return (
              <TouchableOpacity
                key={category.id}
                style={styles.item}
                activeOpacity={0.8}
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
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {title}
                </Text>
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
    columnGap: GRID_GAP,
    rowGap: AppSpacing.lg,
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
  cardIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: AppColors.slate900,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonBadge: {
    backgroundColor: AppColors.gray100,
  },
  skeletonLabel: {
    marginTop: AppSpacing.sm,
    width: '80%',
    height: 10,
    borderRadius: AppBorderRadius.sm,
    backgroundColor: AppColors.gray100,
  },
  cardTitle: {
    marginTop: AppSpacing.sm,
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.gray900,
    textAlign: 'center',
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
