// ============================================
// Tools Hero - Professional workshop positioning
//
// Mirrors e-commerce-web-store/src/components/home/ToolsHero.tsx.
// No photographic asset is used: this app has no licensed hero
// photography, so the hero is a dark industrial gradient plus
// decorative Ionicons tool glyphs -- no network image request,
// no layout shift, nothing copyrighted invented. Copy comes from
// homepageConfig, not hardcoded here.
// ============================================

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { AppColors, AppSpacing, AppGradients } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'

export default function ToolsHero() {
  const router = useRouter()
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    homepageConfig.hero

  return (
    <LinearGradient
      colors={AppGradients.industrial}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Decorative glyphs, purely presentational */}
      <View pointerEvents='none' style={styles.decor}>
        <Ionicons
          name='build-outline'
          size={140}
          color='rgba(255,255,255,0.08)'
          style={styles.decorWrench}
        />
        <Ionicons
          name='hammer-outline'
          size={100}
          color='rgba(255,255,255,0.08)'
          style={styles.decorHammer}
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
    paddingTop: 64,
    paddingBottom: AppSpacing['3xl'],
    paddingHorizontal: AppSpacing.base,
    overflow: 'hidden',
  },
  decor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  decorWrench: {
    position: 'absolute',
    top: 20,
    right: -30,
    transform: [{ rotate: '-12deg' }],
  },
  decorHammer: {
    position: 'absolute',
    bottom: -10,
    right: 40,
    transform: [{ rotate: '12deg' }],
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
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
    color: AppColors.white,
    letterSpacing: -0.5,
  },
  description: {
    marginTop: AppSpacing.md,
    fontSize: 15,
    lineHeight: 22,
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
