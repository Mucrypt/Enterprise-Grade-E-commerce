// ============================================
// Category Tab Row
//
// Horizontal scrollable pill row directly under the home header: an
// "All" pill, real marketing pills, then the store's real top-level
// categories, ending in a hamburger icon that opens the two-pane
// CategoryNavDrawer (mobile equivalent of the web mega menu).
//
// Marketing pills intentionally deviate from a literal copy of the web
// storefront's navigationCategories ("New In" / "Sale" / "Trending"):
// only "New In" and "Trending" have a real destination in this app --
// /products' default sort is newest-first (a real, wired behavior) and
// /trending is a real existing tab screen. There is no onSale filter
// anywhere in this app's ProductFilters type or the tech-tools-api
// products endpoint, so a "Sale" pill would be a dead tap with no real
// feature behind it -- the same rule that keeps a camera/visual-search
// icon out of HomeHeader. It is dropped rather than faked.
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { categoriesApi } from '@/api'
import { Category } from '@/types'
import CategoryNavDrawer from './CategoryNavDrawer'

const MARKETING_PILLS: { key: string; label: string; to: string }[] = [
  { key: 'new-in', label: 'New In', to: '/products' },
  { key: 'trending', label: 'Trending', to: '/trending' },
]

const TOP_LEVEL_DISPLAY_LIMIT = 12

export default function CategoryTabRow() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [drawerVisible, setDrawerVisible] = useState(false)

  useEffect(() => {
    let cancelled = false

    categoriesApi
      .getAll()
      .then((data) => {
        if (!cancelled) setCategories(data)
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const topLevel = categories
    .filter((category) => category.is_active && !category.parent_id)
    .slice(0, TOP_LEVEL_DISPLAY_LIMIT)

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.pill, styles.pillActive]}>
          <Text style={[styles.pillText, styles.pillTextActive]}>All</Text>
        </View>

        {MARKETING_PILLS.map((pill) => (
          <TouchableOpacity
            key={pill.key}
            style={styles.pill}
            activeOpacity={0.8}
            onPress={() => router.push(pill.to as never)}
          >
            <Text style={styles.pillText}>{pill.label}</Text>
          </TouchableOpacity>
        ))}

        {topLevel.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.pill}
            activeOpacity={0.8}
            onPress={() => router.push(`/category/${category.slug}` as never)}
          >
            <Text style={styles.pillText} numberOfLines={1}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.menuButton}
          activeOpacity={0.8}
          onPress={() => setDrawerVisible(true)}
        >
          <Ionicons name='menu' size={20} color={AppColors.gray900} />
        </TouchableOpacity>
      </ScrollView>

      <CategoryNavDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        categories={categories}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.background,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  scrollContent: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  pill: {
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 8,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  pillActive: {
    backgroundColor: AppColors.gray900,
    borderColor: AppColors.gray900,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.gray700,
  },
  pillTextActive: {
    color: AppColors.white,
  },
  menuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: AppSpacing.xs,
  },
})
