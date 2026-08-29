// ============================================
// Workshop Machinery feature section
//
// Mirrors e-commerce-web-store/src/components/home/WorkshopMachinerySection.tsx.
// No specific machinery category/products are asserted to exist in
// the live catalogue, so this section is presented as a premium
// enquiry/category feature that links only to always-valid routes
// (the full catalogue and the real contact screen) rather than a
// specific unverified category slug or any fabricated machinery
// cards.
// ============================================

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { AppColors, AppSpacing, AppGradients } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'

export default function WorkshopMachinerySection() {
  const router = useRouter()
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    homepageConfig.workshopMachinery

  return (
    <LinearGradient
      colors={AppGradients.workshop}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View pointerEvents='none' style={styles.decor}>
        <Ionicons
          name='business-outline'
          size={220}
          color='rgba(255,255,255,0.06)'
        />
      </View>

      <View style={styles.content}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowText}>{eyebrow}</Text>
        </View>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.push(primaryCta.to as never)}
          >
            <Text style={styles.primaryButtonText}>{primaryCta.label}</Text>
            <Ionicons name='arrow-forward' size={16} color={AppColors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={() => router.push(secondaryCta.to as never)}
          >
            <Text style={styles.secondaryButtonText}>
              {secondaryCta.label}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: AppSpacing['3xl'],
    paddingHorizontal: AppSpacing.base,
    overflow: 'hidden',
  },
  decor: {
    position: 'absolute',
    top: -40,
    right: -40,
  },
  content: {
    position: 'relative',
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: AppColors.orangeAccent,
  },
  headline: {
    marginTop: AppSpacing.lg,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 31,
    color: AppColors.white,
    letterSpacing: -0.3,
  },
  description: {
    marginTop: AppSpacing.md,
    fontSize: 14,
    lineHeight: 21,
    color: AppColors.slate400,
  },
  ctaRow: {
    marginTop: AppSpacing.xl,
    gap: AppSpacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    backgroundColor: AppColors.primary,
    paddingVertical: AppSpacing.base,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: AppColors.white,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: AppSpacing.base,
    borderRadius: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: AppColors.white,
  },
})
