// ============================================
// TechTools Mobile App - Promo Banner Component
// ============================================

import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import {
  AppColors,
  AppBorderRadius,
  AppSpacing,
  AppShadows,
} from '@/constants/appTheme'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - AppSpacing.base * 2.5) / 2

interface PromoBannerProps {
  title: string
  subtitle: string
  icon: string
  gradient: string[]
  onPress?: () => void
}

export default function PromoBanner({
  title,
  subtitle,
  icon,
  gradient,
  onPress,
}: PromoBannerProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
      disabled={!onPress}
    >
      <LinearGradient
        colors={gradient as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={28} color={AppColors.white} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </LinearGradient>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    borderRadius: AppBorderRadius.lg,
    overflow: 'hidden',
    ...AppShadows.md,
  },
  gradient: {
    padding: AppSpacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.white,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 2,
  },
})
