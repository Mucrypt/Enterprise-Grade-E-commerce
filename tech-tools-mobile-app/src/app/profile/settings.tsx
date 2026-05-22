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
import * as Linking from 'expo-linking'

import { securityApi, sellerApi, userApi } from '@/api'
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
    user,
    updateUser,
    logout,
  } = useAuthStore()

  const [settings, setSettings] = useState<LocalSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isActivatingBusiness, setIsActivatingBusiness] = useState(false)
  const [isOnboardingSeller, setIsOnboardingSeller] = useState(false)
  const [isRequestingVerification, setIsRequestingVerification] =
    useState(false)
  const [sellerTier, setSellerTier] = useState('unverified')
  const [sellerVerificationStatus, setSellerVerificationStatus] =
    useState('none')
  const [businessMessage, setBusinessMessage] = useState('')

  const creatorHubUrl =
    process.env.EXPO_PUBLIC_CREATOR_HUB_URL || 'https://techtoolstore.com/admin'

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

  useEffect(() => {
    const loadSeller = async () => {
      if (!user?.is_business_account) {
        return
      }

      try {
        const result = await sellerApi.getMyProfile()
        if (result.sellerProfile) {
          setSellerTier(result.sellerProfile.tier)
          setSellerVerificationStatus(result.sellerProfile.verification_status)
        }
      } catch {
        // Best effort display only.
      }
    }

    loadSeller()
  }, [user?.is_business_account])

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

  const activateBusinessMode = async () => {
    if (isActivatingBusiness) {
      return
    }

    setBusinessMessage('')
    setIsActivatingBusiness(true)

    try {
      const result = await userApi.activateBusinessMode({
        source: 'mobile_settings',
      })

      updateUser({
        user_type: result.user.userType,
        is_business_account: result.user.isBusinessAccount,
        business_mode_activated_at: result.user.businessModeActivatedAt || null,
      })

      setBusinessMessage(
        'Business mode is active. Seller tools are now available for this account.',
      )
      Alert.alert('Business mode enabled', 'You can now access seller tools.')

      try {
        const onboarded = await sellerApi.onboard({
          termsAccepted: true,
          source: 'mobile_settings',
        })
        setSellerTier(onboarded.sellerProfile.tier)
        setSellerVerificationStatus(onboarded.sellerProfile.verification_status)
      } catch {
        // Keep activation successful even when onboarding retries are needed.
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        'Could not switch to business mode right now. Please try again.'
      setBusinessMessage(message)
      Alert.alert('Activation failed', message)
    } finally {
      setIsActivatingBusiness(false)
    }
  }

  const onboardSeller = async () => {
    if (isOnboardingSeller) {
      return
    }

    setIsOnboardingSeller(true)
    setBusinessMessage('')

    try {
      const result = await sellerApi.onboard({
        termsAccepted: true,
        source: 'mobile_settings',
      })

      setSellerTier(result.sellerProfile.tier)
      setSellerVerificationStatus(result.sellerProfile.verification_status)
      setBusinessMessage(
        'Seller profile is ready. You can request verification when you are ready.',
      )
    } catch (error: any) {
      setBusinessMessage(
        error?.response?.data?.error ||
          'Could not prepare seller profile right now. Please try again.',
      )
    } finally {
      setIsOnboardingSeller(false)
    }
  }

  const requestBasicVerification = async () => {
    if (isRequestingVerification || sellerVerificationStatus === 'pending') {
      return
    }

    setIsRequestingVerification(true)
    setBusinessMessage('')

    try {
      await sellerApi.requestVerification({
        requestedTier: 'basic',
        notes: 'Submitted from mobile settings onboarding.',
      })
      setSellerVerificationStatus('pending')
      setBusinessMessage(
        'Verification request sent. You can continue listing while review is in progress.',
      )
    } catch (error: any) {
      setBusinessMessage(
        error?.response?.data?.error ||
          'Could not submit verification request right now.',
      )
    } finally {
      setIsRequestingVerification(false)
    }
  }

  const openCreatorHub = async () => {
    try {
      await Linking.openURL(creatorHubUrl)
    } catch {
      Alert.alert('Unavailable', 'Could not open creator tools right now.')
    }
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

          <View style={styles.businessModeWrap}>
            <Text style={styles.businessModeTitle}>
              Seller and creator mode
            </Text>
            <Text style={styles.businessModeSubtitle}>
              Upgrade this account to business mode to publish and sell books.
            </Text>

            {user?.is_business_account ? (
              <>
                <Text style={styles.businessModeSuccess}>
                  Business mode is active for this account.
                </Text>
                <Text style={styles.businessModeMeta}>
                  Seller tier: {sellerTier} | Verification:{' '}
                  {sellerVerificationStatus}
                </Text>
                <TouchableOpacity
                  style={styles.creatorHubButton}
                  onPress={onboardSeller}
                  disabled={isOnboardingSeller}
                >
                  <Text style={styles.creatorHubButtonText}>
                    {isOnboardingSeller
                      ? 'Preparing seller profile...'
                      : 'Prepare Seller Profile'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.creatorHubButton}
                  onPress={requestBasicVerification}
                  disabled={
                    isRequestingVerification ||
                    sellerVerificationStatus === 'pending'
                  }
                >
                  <Text style={styles.creatorHubButtonText}>
                    {isRequestingVerification
                      ? 'Submitting verification...'
                      : sellerVerificationStatus === 'pending'
                      ? 'Verification Pending'
                      : 'Request Basic Verification'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.creatorHubButton}
                  onPress={openCreatorHub}
                >
                  <Text style={styles.creatorHubButtonText}>
                    Open Creator Hub
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.creatorHubButton}
                  onPress={() => router.push('/profile/seller' as Href)}
                >
                  <Text style={styles.creatorHubButtonText}>Open Seller Hub</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.activateBusinessButton}
                onPress={activateBusinessMode}
                disabled={isActivatingBusiness}
              >
                <Text style={styles.activateBusinessButtonText}>
                  {isActivatingBusiness
                    ? 'Activating business mode...'
                    : 'Switch To Business Mode'}
                </Text>
              </TouchableOpacity>
            )}

            {businessMessage ? (
              <Text
                style={
                  user?.is_business_account
                    ? styles.businessModeSuccess
                    : styles.businessModeError
                }
              >
                {businessMessage}
              </Text>
            ) : null}
          </View>
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
  businessModeWrap: {
    marginTop: AppSpacing.base,
    paddingTop: AppSpacing.base,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  businessModeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  businessModeSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: AppColors.gray500,
  },
  businessModeMeta: {
    marginTop: AppSpacing.xs,
    fontSize: 12,
    color: AppColors.gray700,
    fontWeight: '600',
  },
  activateBusinessButton: {
    marginTop: AppSpacing.sm,
    minHeight: 42,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateBusinessButtonText: {
    color: AppColors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  creatorHubButton: {
    marginTop: AppSpacing.sm,
    minHeight: 42,
    borderRadius: AppBorderRadius.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorHubButtonText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '700',
  },
  businessModeSuccess: {
    marginTop: AppSpacing.sm,
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  businessModeError: {
    marginTop: AppSpacing.sm,
    fontSize: 12,
    color: AppColors.error,
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
