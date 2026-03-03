// ============================================
// TechTools Mobile App - Section Header Component
// ============================================

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing } from '@/constants/appTheme'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  icon?: string
  showViewAll?: boolean
  onViewAll?: () => void
  onAction?: () => void
}

export default function SectionHeader({
  title,
  subtitle,
  icon,
  showViewAll = false,
  onViewAll,
  onAction,
}: SectionHeaderProps) {
  const handleAction = onAction || onViewAll

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <View style={styles.titleRow}>
          {icon && (
            <View style={styles.iconContainer}>
              <Ionicons
                name={icon as any}
                size={18}
                color={AppColors.primary}
              />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
        </View>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {(showViewAll || onAction) && handleAction && (
        <TouchableOpacity style={styles.viewAllButton} onPress={handleAction}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons
            name='chevron-forward'
            size={16}
            color={AppColors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: AppSpacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  subtitle: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: 2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
  },
})
