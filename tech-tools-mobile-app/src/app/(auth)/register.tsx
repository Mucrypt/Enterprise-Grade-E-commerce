// ============================================
// TechTools Mobile App - Register Screen
// ============================================

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Input, Button } from '@/components'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppGradients,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'
import { isValidEmail, validatePassword } from '@/utils'

export default function RegisterScreen() {
  const router = useRouter()
  const { register, isLoading, error, clearError } = useAuthStore()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email'
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.errors[0]
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!acceptTerms) {
      newErrors.terms = 'Please accept the terms and conditions'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRegister = async () => {
    clearError()

    if (!validateForm()) return

    try {
      await register({ email, password, firstName, lastName })
      router.replace('/(tabs)')
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Please try again.')
    }
  }

  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps='handled'
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name='arrow-back' size={24} color={AppColors.gray800} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={AppGradients.secondary as [string, string, ...string[]]}
              style={styles.logoContainer}
            >
              <Ionicons name='person-add' size={36} color={AppColors.white} />
            </LinearGradient>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to start shopping</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Input
                  label='First Name'
                  placeholder='John'
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text)
                    clearFieldError('firstName')
                  }}
                  error={errors.firstName}
                />
              </View>
              <View style={styles.nameField}>
                <Input
                  label='Last Name'
                  placeholder='Doe'
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(text)
                    clearFieldError('lastName')
                  }}
                  error={errors.lastName}
                />
              </View>
            </View>

            <Input
              label='Email'
              placeholder='john@example.com'
              value={email}
              onChangeText={(text) => {
                setEmail(text)
                clearFieldError('email')
              }}
              keyboardType='email-address'
              autoCapitalize='none'
              autoCorrect={false}
              error={errors.email}
              leftIcon='mail-outline'
            />

            <Input
              label='Password'
              placeholder='Create a strong password'
              value={password}
              onChangeText={(text) => {
                setPassword(text)
                clearFieldError('password')
              }}
              secureTextEntry
              error={errors.password}
              leftIcon='lock-closed-outline'
            />

            <Input
              label='Confirm Password'
              placeholder='Confirm your password'
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text)
                clearFieldError('confirmPassword')
              }}
              secureTextEntry
              error={errors.confirmPassword}
              leftIcon='lock-closed-outline'
            />

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => {
                setAcceptTerms(!acceptTerms)
                clearFieldError('terms')
              }}
            >
              <View
                style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}
              >
                {acceptTerms && (
                  <Ionicons
                    name='checkmark'
                    size={14}
                    color={AppColors.white}
                  />
                )}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            {errors.terms && (
              <Text style={styles.termsError}>{errors.terms}</Text>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons
                  name='alert-circle'
                  size={16}
                  color={AppColors.error}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              title='Create Account'
              onPress={handleRegister}
              loading={isLoading}
              style={styles.registerButton}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Sign In</Text>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: AppSpacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.base,
  },
  header: {
    alignItems: 'center',
    marginBottom: AppSpacing.xl,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: AppSpacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: AppColors.gray500,
  },
  form: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  nameField: {
    flex: 1,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: AppSpacing.base,
    gap: AppSpacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: AppColors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.gray600,
    lineHeight: 20,
  },
  termsLink: {
    color: AppColors.primary,
    fontWeight: '500',
  },
  termsError: {
    fontSize: 12,
    color: AppColors.error,
    marginTop: -AppSpacing.sm,
    marginBottom: AppSpacing.base,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${AppColors.error}10`,
    padding: AppSpacing.md,
    borderRadius: AppBorderRadius.md,
    marginBottom: AppSpacing.base,
    gap: AppSpacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: AppColors.error,
  },
  registerButton: {
    marginTop: AppSpacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: AppSpacing.xl,
    paddingBottom: AppSpacing.xl,
  },
  footerText: {
    fontSize: 14,
    color: AppColors.gray500,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
  },
})
