// ============================================
// TechTools Mobile App - Trending Category Filter
// ============================================

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Category } from '@/types'
import { AppColors, AppBorderRadius, AppSpacing } from '@/constants/appTheme'

interface TrendingCategoryFilterProps {
  categories: Category[]
  selectedCategory: string | null
  onSelectCategory: (slug: string | null) => void
  onFilterPress?: () => void
}

export default function TrendingCategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  onFilterPress,
}: TrendingCategoryFilterProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All Button */}
        <TouchableOpacity
          style={[styles.chip, selectedCategory === null && styles.chipActive]}
          onPress={() => onSelectCategory(null)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.chipText,
              selectedCategory === null && styles.chipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* Category Chips */}
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.chip,
              selectedCategory === category.slug && styles.chipActive,
            ]}
            onPress={() => onSelectCategory(category.slug)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategory === category.slug && styles.chipTextActive,
              ]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filter Button */}
      {onFilterPress && (
        <TouchableOpacity
          style={styles.filterButton}
          onPress={onFilterPress}
          activeOpacity={0.8}
        >
          <Ionicons
            name='options-outline'
            size={20}
            color={AppColors.gray700}
          />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    paddingVertical: AppSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  scrollContent: {
    paddingHorizontal: AppSpacing.base,
    gap: AppSpacing.sm,
    flexDirection: 'row',
    flex: 1,
  },
  chip: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.gray100,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: `${AppColors.primary}15`,
    borderColor: AppColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: AppColors.gray700,
  },
  chipTextActive: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  filterButton: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: AppColors.gray200,
  },
})
