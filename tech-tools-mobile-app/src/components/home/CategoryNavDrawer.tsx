// ============================================
// Category Nav Drawer
//
// Mobile equivalent of the web storefront's mega menu: a left-side list
// of every real top-level category and, on the right, that category's
// real subcategories (parent_id === selected top-level category's id,
// computed from the same flat categories list -- same technique
// category/[slug].tsx already uses, no extra API call). A native slide-in
// panel stands in for the web version's hover dropdown.
//
// Receives the already-fetched flat category list from CategoryTabRow
// (which needs it anyway for its own pills) rather than re-fetching.
// ============================================

import React, { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
} from '@/constants/appTheme'
import { Category } from '@/types'

interface CategoryNavDrawerProps {
  visible: boolean
  onClose: () => void
  categories: Category[]
}

export default function CategoryNavDrawer({
  visible,
  onClose,
  categories,
}: CategoryNavDrawerProps) {
  const router = useRouter()
  const topLevel = categories.filter((c) => c.is_active && !c.parent_id)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setSelectedId((current) => current ?? topLevel[0]?.id ?? null)
    }
  }, [visible, topLevel])

  const selected = topLevel.find((c) => c.id === selectedId) || null
  const children = selected
    ? categories.filter((c) => c.is_active && c.parent_id === selected.id)
    : []

  const goToCategory = (slug: string) => {
    onClose()
    router.push(`/category/${slug}` as never)
  }

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Browse Categories</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
              <Ionicons name='close' size={24} color={AppColors.gray900} />
            </TouchableOpacity>
          </View>

          {topLevel.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Categories are unavailable right now.
              </Text>
            </View>
          ) : (
            <View style={styles.body}>
              <ScrollView
                style={styles.leftPane}
                showsVerticalScrollIndicator={false}
              >
                {topLevel.map((category) => {
                  const active = category.id === selectedId
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.leftItem,
                        active && styles.leftItemActive,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedId(category.id)}
                    >
                      <Text
                        style={[
                          styles.leftItemText,
                          active && styles.leftItemTextActive,
                        ]}
                        numberOfLines={2}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <ScrollView
                style={styles.rightPane}
                showsVerticalScrollIndicator={false}
              >
                {selected && (
                  <TouchableOpacity
                    style={styles.shopAllRow}
                    activeOpacity={0.8}
                    onPress={() => goToCategory(selected.slug)}
                  >
                    <Text style={styles.shopAllText}>
                      Shop all {selected.name}
                    </Text>
                    <Ionicons
                      name='chevron-forward'
                      size={16}
                      color={AppColors.primary}
                    />
                  </TouchableOpacity>
                )}

                {children.length === 0 ? (
                  <Text style={styles.noChildrenText}>
                    No subcategories yet -- browse the full category above.
                  </Text>
                ) : (
                  <View style={styles.chipGrid}>
                    {children.map((child) => (
                      <TouchableOpacity
                        key={child.id}
                        style={styles.chip}
                        activeOpacity={0.8}
                        onPress={() => goToCategory(child.slug)}
                      >
                        <Text style={styles.chipText} numberOfLines={2}>
                          {child.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  panel: {
    backgroundColor: AppColors.white,
    borderTopLeftRadius: AppBorderRadius.xl,
    borderTopRightRadius: AppBorderRadius.xl,
    height: '78%',
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.base,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    width: 128,
    backgroundColor: AppColors.background,
    borderRightWidth: 1,
    borderRightColor: AppColors.gray100,
  },
  leftItem: {
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.base,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  leftItemActive: {
    backgroundColor: AppColors.white,
    borderLeftColor: AppColors.primary,
  },
  leftItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.gray600,
  },
  leftItemTextActive: {
    color: AppColors.gray900,
    fontWeight: '800',
  },
  rightPane: {
    flex: 1,
    padding: AppSpacing.base,
  },
  shopAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: AppSpacing.md,
    marginBottom: AppSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  shopAllText: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.primary,
  },
  noChildrenText: {
    fontSize: 13,
    color: AppColors.slate500,
    lineHeight: 19,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppSpacing.xl,
  },
  emptyStateText: {
    fontSize: 13,
    color: AppColors.slate500,
    textAlign: 'center',
  },
})
