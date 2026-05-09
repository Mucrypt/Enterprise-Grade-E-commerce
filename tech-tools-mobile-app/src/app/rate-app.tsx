import React, { useEffect, useState } from 'react'
import {
  Alert,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { type Href, useRouter } from 'expo-router'

import { securityApi } from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'

const androidPackage = 'com.mucrypt.techtools'
const playStoreWebUrl =
  'https://play.google.com/store/apps/details?id=com.mucrypt.techtools'

export default function RateAppScreen() {
  const router = useRouter()
  const {
    hasHydrated,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuthStore()
  const [selectedRating, setSelectedRating] = useState<number>(5)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
    }
  }, [authLoading, hasHydrated, isAuthenticated, router])

  const openStore = async () => {
    const marketUrl = `market://details?id=${androidPackage}`

    try {
      const canOpenMarket = await Linking.canOpenURL(marketUrl)
      if (canOpenMarket) {
        void securityApi.logSensitiveAction({
          action: 'profile.rate-app.open-store',
          status: 'success',
          metadata: { channel: 'market' },
        })
        await Linking.openURL(marketUrl)
        return
      }

      void securityApi.logSensitiveAction({
        action: 'profile.rate-app.open-store',
        status: 'success',
        metadata: { channel: 'web' },
      })
      await Linking.openURL(playStoreWebUrl)
    } catch {
      void securityApi.logSensitiveAction({
        action: 'profile.rate-app.open-store',
        status: 'failed',
      })

      Alert.alert(
        'Unable to open store',
        'Please try again later or rate us from the Play Store app.',
      )
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name='arrow-back' size={20} color={AppColors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate the App</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.heroCard}>
          <Ionicons name='star' size={34} color={AppColors.warning} />
          <Text style={styles.heroTitle}>Enjoying TechTools?</Text>
          <Text style={styles.heroSubtitle}>
            Ratings help us improve and help more shoppers trust the app.
          </Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <TouchableOpacity
                key={rating}
                onPress={() => setSelectedRating(rating)}
                style={styles.starButton}
              >
                <Ionicons
                  name={rating <= selectedRating ? 'star' : 'star-outline'}
                  size={34}
                  color={AppColors.warning}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingLabel}>Selected: {selectedRating}/5</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={openStore}>
            <Text style={styles.primaryButtonText}>Open Play Store</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/contact-us' as Href)}
        >
          <Ionicons
            name='chatbubble-outline'
            size={16}
            color={AppColors.primary}
          />
          <Text style={styles.secondaryText}>Send feedback directly</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.gray100,
  },
  iconButtonPlaceholder: {
    width: 34,
    height: 34,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  content: {
    flex: 1,
    padding: AppSpacing.base,
    justifyContent: 'center',
    gap: AppSpacing.base,
  },
  heroCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.xl,
    alignItems: 'center',
    ...AppShadows.sm,
  },
  heroTitle: {
    marginTop: AppSpacing.base,
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  heroSubtitle: {
    marginTop: AppSpacing.sm,
    fontSize: 13,
    color: AppColors.gray600,
    textAlign: 'center',
    lineHeight: 20,
  },
  starsRow: {
    marginTop: AppSpacing.lg,
    flexDirection: 'row',
    gap: AppSpacing.xs,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    marginTop: AppSpacing.sm,
    fontSize: 12,
    color: AppColors.gray600,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: AppSpacing.lg,
    width: '100%',
    borderRadius: AppBorderRadius.md,
    minHeight: 46,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: AppSpacing.xs,
    ...AppShadows.sm,
  },
  secondaryText: {
    color: AppColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
})
