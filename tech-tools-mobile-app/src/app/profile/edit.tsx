import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import {
  getApiErrorContext,
  getApiErrorMessage,
  securityApi,
  userApi,
} from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'

const maxNameLength = 100
const maxPhoneLength = 20
const maxCompanyLength = 255

export default function EditProfileScreen() {
  const router = useRouter()
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    hasHydrated,
    updateUser,
  } = useAuthStore()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
      return
    }

    if (!hasHydrated || !isAuthenticated) {
      return
    }

    const loadProfile = async () => {
      try {
        const profile = await userApi.getProfile()
        setFirstName((profile.user.firstName || user?.first_name || '').trim())
        setLastName((profile.user.lastName || user?.last_name || '').trim())
        setPhone((profile.user.phone || user?.phone || '').trim())
        setCompanyName((profile.user.companyName || '').trim())
      } catch (error: unknown) {
        const err = getApiErrorContext(error)
        if (err.isAuthError) {
          router.replace('/(auth)/login')
          return
        }

        setFirstName((user?.first_name || '').trim())
        setLastName((user?.last_name || '').trim())
        setPhone((user?.phone || '').trim())
        setCompanyName('')
      } finally {
        setIsLoadingProfile(false)
      }
    }

    loadProfile()
  }, [authLoading, hasHydrated, isAuthenticated, router, user])

  const trimmedFirstName = useMemo(() => firstName.trim(), [firstName])
  const trimmedLastName = useMemo(() => lastName.trim(), [lastName])
  const trimmedPhone = useMemo(() => phone.trim(), [phone])
  const trimmedCompany = useMemo(() => companyName.trim(), [companyName])

  const canSave =
    trimmedFirstName.length > 0 &&
    trimmedLastName.length > 0 &&
    trimmedFirstName.length <= maxNameLength &&
    trimmedLastName.length <= maxNameLength &&
    trimmedPhone.length <= maxPhoneLength &&
    trimmedCompany.length <= maxCompanyLength

  const saveProfile = async () => {
    if (!canSave) {
      Alert.alert(
        'Invalid profile details',
        'Please check your name and contact details before saving.',
      )
      return
    }

    try {
      setIsSaving(true)

      const updated = await userApi.updateProfile({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: trimmedPhone || undefined,
        companyName: trimmedCompany || undefined,
      })

      updateUser({
        first_name: updated.firstName,
        last_name: updated.lastName,
        phone: updated.phone,
      })

      void securityApi.logSensitiveAction({
        action: 'profile.update',
        status: 'success',
      })

      Alert.alert(
        'Profile updated',
        'Your profile details were saved securely.',
        [{ text: 'OK', onPress: () => router.back() }],
      )
    } catch (error: unknown) {
      void securityApi.logSensitiveAction({
        action: 'profile.update',
        status: 'failed',
      })

      Alert.alert(
        'Update failed',
        getApiErrorMessage(
          error,
          'We could not update your profile right now. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!hasHydrated || authLoading || isLoadingProfile) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  if (!user) {
    return null
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
            accessibilityRole='button'
          >
            <Ionicons name='arrow-back' size={20} color={AppColors.gray800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps='handled'
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            <Text style={styles.cardSubtitle}>
              Keep your details accurate for smoother order updates and support.
            </Text>

            <Text style={styles.label}>First Name</Text>
            <TextInput
              value={firstName}
              onChangeText={(value) =>
                setFirstName(value.slice(0, maxNameLength))
              }
              placeholder='First name'
              style={styles.input}
              autoCapitalize='words'
            />

            <Text style={styles.label}>Last Name</Text>
            <TextInput
              value={lastName}
              onChangeText={(value) =>
                setLastName(value.slice(0, maxNameLength))
              }
              placeholder='Last name'
              style={styles.input}
              autoCapitalize='words'
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={(value) => setPhone(value.slice(0, maxPhoneLength))}
              placeholder='Phone number'
              style={styles.input}
              keyboardType='phone-pad'
            />

            <Text style={styles.label}>Company (Optional)</Text>
            <TextInput
              value={companyName}
              onChangeText={(value) =>
                setCompanyName(value.slice(0, maxCompanyLength))
              }
              placeholder='Company name'
              style={styles.input}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!canSave || isSaving) && styles.saveDisabled,
              ]}
              onPress={saveProfile}
              disabled={!canSave || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size='small' color={AppColors.white} />
              ) : (
                <Text style={styles.saveText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  keyboardWrap: {
    flex: 1,
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
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  cardSubtitle: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: AppSpacing.xs,
    marginBottom: AppSpacing.base,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray700,
    marginBottom: AppSpacing.xs,
    marginTop: AppSpacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: 12,
    fontSize: 14,
    color: AppColors.gray900,
    backgroundColor: AppColors.gray50,
  },
  saveButton: {
    marginTop: AppSpacing.lg,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
})
