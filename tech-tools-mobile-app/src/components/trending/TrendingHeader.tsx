// ============================================
// TechTools Mobile App - Trending Header
// ============================================

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { AppColors, AppSpacing, AppGradients } from '@/constants/appTheme'
import { LinearGradient } from 'expo-linear-gradient'

interface TrendingHeaderProps {
  title?: string
}

export default function TrendingHeader({
  title = 'Trending',
}: TrendingHeaderProps) {
  const router = useRouter()

  return (
    <LinearGradient
      colors={AppGradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo/Title */}
        <View style={styles.titleContainer}>
          <Ionicons name='trending-up' size={24} color={AppColors.white} />
          <Text style={styles.title}>{title}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/search')}
            activeOpacity={0.8}
          >
            <Ionicons name='search-outline' size={24} color={AppColors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/wishlist')}
            activeOpacity={0.8}
          >
            <Ionicons name='heart-outline' size={24} color={AppColors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: AppSpacing.sm,
    paddingBottom: AppSpacing.base,
    paddingHorizontal: AppSpacing.base,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.white,
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
