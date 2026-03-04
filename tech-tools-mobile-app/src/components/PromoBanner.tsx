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
const CARD_WIDTH = (width - AppSpacing.base * 2 - AppSpacing.sm) / 2

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
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={20} color={AppColors.white} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    borderRadius: AppBorderRadius.md,
    overflow: 'hidden',
    ...AppShadows.sm,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: AppSpacing.md,
    paddingHorizontal: AppSpacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: AppSpacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.white,
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
})
