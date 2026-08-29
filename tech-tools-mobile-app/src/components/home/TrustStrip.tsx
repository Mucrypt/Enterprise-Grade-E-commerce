// ============================================
// Trust Strip - four truthful, verifiable statements
//
// Mirrors e-commerce-web-store/src/components/home/TrustStrip.tsx.
// Copy comes from homepageConfig.trustStrip only.
// ============================================

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'

const ICONS: string[] = [
  'build-outline',
  'people-outline',
  'cash-outline',
  'chatbubble-outline',
]

export default function TrustStrip() {
  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        {homepageConfig.trustStrip.map((item, index) => {
          const iconName = ICONS[index] ?? 'build-outline'
          return (
            <View key={item.title} style={styles.item}>
              <View style={styles.iconBadge}>
                <Ionicons
                  name={iconName as any}
                  size={18}
                  color={AppColors.orangeAccent}
                />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.slate200,
    paddingVertical: AppSpacing.lg,
    paddingHorizontal: AppSpacing.base,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: AppSpacing.base,
    columnGap: AppSpacing.base,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppSpacing.sm,
    width: '47%',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.slate900,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  itemDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: AppColors.slate500,
  },
})
