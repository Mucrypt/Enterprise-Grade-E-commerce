import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { type Href, useRouter } from 'expo-router'

import { securityApi } from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'

const settingsKey = 'accountPreferences.v1'

interface LocalSettings {
  orderUpdates: boolean
  promotions: boolean
  supportFollowUps: boolean
  biometricPrompt: boolean
}

const defaultSettings: LocalSettings = {
  orderUpdates: true,
  promotions: true,
  supportFollowUps: true,
  biometricPrompt: false,
}

export default function AccountSettingsScreen() {
  const router = useRouter()
  const {
    isAuthenticated,
    hasHydrated,
    isLoading: authLoading,
    logout,
  } = useAuthStore()

  const [settings, setSettings] = useState<LocalSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
      return
    }

    if (!hasHydrated || !isAuthenticated) {
      return
    }

    const loadSettings = async () => {
      try {
        const raw = await SecureStore.getItemAsync(settingsKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          setSettings({
            orderUpdates:
              typeof parsed.orderUpdates === 'boolean'
                ? parsed.orderUpdates
                : true,
            promotions:
              typeof parsed.promotions === 'boolean' ? parsed.promotions : true,
            supportFollowUps:
              typeof parsed.supportFollowUps === 'boolean'
                ? parsed.supportFollowUps
                : true,
            biometricPrompt:
              typeof parsed.biometricPrompt === 'boolean'
                ? parsed.biometricPrompt
                : false,
          })
        }
      } catch {
        setSettings(defaultSettings)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [authLoading, hasHydrated, isAuthenticated, router])

  const persistSettings = async (next: LocalSettings) => {
    setSettings(next)

    try {
      await SecureStore.setItemAsync(settingsKey, JSON.stringify(next))
      void securityApi.logSensitiveAction({
        action: 'profile.settings.update',
        status: 'success',
      })
    } catch {
      void securityApi.logSensitiveAction({
        action: 'profile.settings.update',
        status: 'failed',
      })

      Alert.alert(
        'Save warning',
        'Could not persist this setting on this device.',
      )
    }
  }

  const confirmLogout = () => {
    Alert.alert('Sign out', 'Do you want to sign out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          void securityApi.logSensitiveAction({
            action: 'profile.settings.logout',
            status: 'success',
          })
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  if (!hasHydrated || authLoading || isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Communication</Text>
          <Text style={styles.sectionSubtitle}>
            Control the notifications you want to receive on this device.
          </Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelWrap}>
              <Text style={styles.toggleTitle}>Order updates</Text>
              <Text style={styles.toggleSubtitle}>
                Shipping and delivery changes
              </Text>
            </View>
            <Switch
              value={settings.orderUpdates}
              onValueChange={(value) =>
                persistSettings({ ...settings, orderUpdates: value })
              }
              trackColor={{ true: '#FFD7C9', false: '#CBD5E1' }}
              thumbColor={settings.orderUpdates ? AppColors.primary : '#F8FAFC'}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelWrap}>
              <Text style={styles.toggleTitle}>Promotions</Text>
              <Text style={styles.toggleSubtitle}>
                Deals and campaign highlights
              </Text>
            </View>
            <Switch
              value={settings.promotions}
              onValueChange={(value) =>
                persistSettings({ ...settings, promotions: value })
              }
              trackColor={{ true: '#FFD7C9', false: '#CBD5E1' }}
              thumbColor={settings.promotions ? AppColors.primary : '#F8FAFC'}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelWrap}>
              <Text style={styles.toggleTitle}>Support follow-ups</Text>
              <Text style={styles.toggleSubtitle}>
                Ticket updates from Smart Support
              </Text>
            </View>
            <Switch
              value={settings.supportFollowUps}
              onValueChange={(value) =>
                persistSettings({ ...settings, supportFollowUps: value })
              }
              trackColor={{ true: '#FFD7C9', false: '#CBD5E1' }}
              thumbColor={
                settings.supportFollowUps ? AppColors.primary : '#F8FAFC'
              }
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelWrap}>
              <Text style={styles.toggleTitle}>Biometric prompt</Text>
              <Text style={styles.toggleSubtitle}>
                Prompt on sensitive account actions
              </Text>
            </View>
            <Switch
              value={settings.biometricPrompt}
              onValueChange={(value) =>
                persistSettings({ ...settings, biometricPrompt: value })
              }
              trackColor={{ true: '#FFD7C9', false: '#CBD5E1' }}
              thumbColor={
                settings.biometricPrompt ? AppColors.primary : '#F8FAFC'
              }
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Tools</Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/profile/edit' as Href)}
          >
            <Text style={styles.linkText}>Edit profile</Text>
            <Ionicons
              name='chevron-forward'
              size={18}
              color={AppColors.gray500}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/profile/addresses' as Href)}
          >
            <Text style={styles.linkText}>Addresses</Text>
            <Ionicons
              name='chevron-forward'
              size={18}
              color={AppColors.gray500}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/profile/payment-methods' as Href)}
          >
            <Text style={styles.linkText}>Payment methods</Text>
            <Ionicons
              name='chevron-forward'
              size={18}
              color={AppColors.gray500}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/profile/notifications' as Href)}
          >
            <Text style={styles.linkText}>Notification center</Text>
            <Ionicons
              name='chevron-forward'
              size={18}
              color={AppColors.gray500}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={confirmLogout}>
          <Ionicons name='log-out-outline' size={18} color={AppColors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: AppSpacing.base,
    gap: AppSpacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  sectionSubtitle: {
    marginTop: AppSpacing.xs,
    fontSize: 12,
    color: AppColors.gray500,
    marginBottom: AppSpacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
    paddingVertical: AppSpacing.base,
  },
  toggleLabelWrap: {
    flex: 1,
    paddingRight: AppSpacing.base,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  toggleSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: AppColors.gray500,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
    paddingVertical: AppSpacing.base,
  },
  linkText: {
    fontSize: 14,
    color: AppColors.gray800,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: AppBorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.xs,
  },
  signOutText: {
    color: AppColors.error,
    fontSize: 15,
    fontWeight: '700',
  },
})
