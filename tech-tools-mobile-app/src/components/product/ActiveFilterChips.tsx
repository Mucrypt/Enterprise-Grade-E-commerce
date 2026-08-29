// ============================================
// TechTools Mobile App - Active Filter Chips
// ============================================
// Mirrors the web storefront's ActiveFilterChips.tsx: one removable pill
// per currently-applied filter dimension, plus a "Clear all" action.

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Category, Brand } from '@/types'
import { formatPrice } from '@/utils'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { ProductFilterState, PRICE_RANGES } from './FilterSheet'

export type RemovableFilterKey =
  | 'category'
  | 'brand'
  | 'price'
  | 'rating'
  | 'inStock'
  | { attribute: string }

interface ActiveFilterChipsProps {
  filters: ProductFilterState
  categories: Category[]
  brands: Brand[]
  onRemove: (key: RemovableFilterKey) => void
  onClearAll: () => void
}

function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode
  onRemove: () => void
}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>
        {children}
      </Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Ionicons name='close' size={14} color={AppColors.primaryDark} />
      </TouchableOpacity>
    </View>
  )
}

export default function ActiveFilterChips({
  filters,
  categories,
  brands,
  onRemove,
  onClearAll,
}: ActiveFilterChipsProps) {
  const attributeEntries = Object.entries(filters.attributes || {})
  const hasAny =
    !!filters.category ||
    !!filters.brand ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    !!filters.minRating ||
    !!filters.inStock ||
    attributeEntries.length > 0

  if (!hasAny) return null

  const priceRange = PRICE_RANGES.find(
    (r) => r.min === filters.minPrice && r.max === filters.maxPrice,
  )

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {filters.category && (
        <Chip onRemove={() => onRemove('category')}>
          {categories.find((c) => c.slug === filters.category)?.name ||
            filters.category}
        </Chip>
      )}
      {filters.brand && (
        <Chip onRemove={() => onRemove('brand')}>
          {brands.find((b) => b.slug === filters.brand)?.name || filters.brand}
        </Chip>
      )}
      {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
        <Chip onRemove={() => onRemove('price')}>
          {priceRange?.label ??
            `${formatPrice(filters.minPrice || 0)} - ${
              filters.maxPrice ? formatPrice(filters.maxPrice) : '∞'
            }`}
        </Chip>
      )}
      {!!filters.minRating && (
        <Chip onRemove={() => onRemove('rating')}>
          {filters.minRating}★ & Up
        </Chip>
      )}
      {!!filters.inStock && (
        <Chip onRemove={() => onRemove('inStock')}>In Stock Only</Chip>
      )}
      {attributeEntries.map(([name, value]) => (
        <Chip key={name} onRemove={() => onRemove({ attribute: name })}>
          {name}: {value}
        </Chip>
      ))}
      <TouchableOpacity onPress={onClearAll} hitSlop={8}>
        <Text style={styles.clearAllText}>Clear all</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: AppSpacing.base,
    paddingBottom: AppSpacing.md,
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 146, 60, 0.14)',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 6,
    borderRadius: AppBorderRadius.full,
    maxWidth: 180,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primaryDark,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray500,
    textDecorationLine: 'underline',
    marginLeft: AppSpacing.xs,
  },
})
