// ============================================
// Business & Bulk Orders (B2B) section
//
// Mirrors e-commerce-web-store/src/components/home/BusinessBuyerSection.tsx.
// Invites legitimate enquiries only -- no fabricated phone number,
// wholesale portal, credit terms, discounts or exclusive supplier
// claims. CTA routes to the real contact screen.
// ============================================

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'

export default function BusinessBuyerSection() {
  const router = useRouter()
  const { heading, description, customerTypes, cta } =
    homepageConfig.businessBuyer

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <Ionicons name='business' size={22} color={AppColors.orangeAccent} />
        </View>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.description}>{description}</Text>

        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => router.push(cta.to as never)}
        >
          <Text style={styles.ctaText}>{cta.label}</Text>
        </TouchableOpacity>

        <View style={styles.customerTypeGrid}>
          {customerTypes.map((type) => (
            <View key={type} style={styles.customerTypeItem}>
              <Ionicons
                name='checkmark-circle'
                size={16}
                color={AppColors.primary}
              />
              <Text style={styles.customerTypeText}>{type}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.white,
    paddingVertical: AppSpacing['2xl'],
    paddingHorizontal: AppSpacing.base,
  },
  card: {
    borderWidth: 1,
    borderColor: AppColors.slate200,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.background,
    padding: AppSpacing.xl,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.slate900,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    marginTop: AppSpacing.base,
    fontSize: 22,
    fontWeight: '900',
    color: AppColors.gray900,
    letterSpacing: -0.3,
  },
  description: {
    marginTop: AppSpacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.slate500,
  },
  cta: {
    marginTop: AppSpacing.lg,
    alignSelf: 'flex-start',
    backgroundColor: AppColors.slate900,
    paddingHorizontal: AppSpacing.xl,
    paddingVertical: AppSpacing.base,
    borderRadius: 8,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: AppColors.white,
  },
  customerTypeGrid: {
    marginTop: AppSpacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: AppSpacing.sm,
    rowGap: AppSpacing.sm,
  },
  customerTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
    borderWidth: 1,
    borderColor: AppColors.slate200,
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    width: '47%',
  },
  customerTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.gray700,
    flexShrink: 1,
  },
})
