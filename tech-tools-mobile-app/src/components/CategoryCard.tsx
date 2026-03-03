// ============================================
// TechTools Mobile App - Category Card Component
// ============================================

import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Category } from '@/types'
import {
  AppColors,
  AppBorderRadius,
  AppShadows,
  AppSpacing,
  CategoryIcons,
  CategoryColors,
} from '@/constants/appTheme'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - AppSpacing.base * 3) / 2

interface CategoryCardProps {
  category: Category
  size?: 'small' | 'medium' | 'large'
}

export default function CategoryCard({
  category,
  size = 'medium',
}: CategoryCardProps) {
  const router = useRouter()

  const iconName =
    CategoryIcons[category.slug.toLowerCase()] || CategoryIcons.default
  const iconColor =
    CategoryColors[category.slug.toLowerCase()] || CategoryColors.default

  const handlePress = () => {
    router.push(`/category/${category.slug}`)
  }

  const getCardSize = () => {
    switch (size) {
      case 'small':
        return { width: 80, height: 100 }
      case 'large':
        return { width: CARD_WIDTH, height: 140 }
      default:
        return { width: 100, height: 120 }
    }
  }

  const cardSize = getCardSize()

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { width: cardSize.width, height: cardSize.height },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}
      >
        <Ionicons
          name={iconName as any}
          size={size === 'small' ? 24 : 32}
          color={iconColor}
        />
      </View>
      <Text
        style={[styles.name, size === 'small' && styles.nameSmall]}
        numberOfLines={2}
      >
        {category.name}
      </Text>
      {category.product_count !== undefined && size !== 'small' && (
        <Text style={styles.count}>{category.product_count} items</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...AppShadows.sm,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.sm,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray800,
    textAlign: 'center',
  },
  nameSmall: {
    fontSize: 11,
  },
  count: {
    fontSize: 11,
    color: AppColors.gray500,
    marginTop: 2,
  },
})
