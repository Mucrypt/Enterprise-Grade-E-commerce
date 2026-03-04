// ============================================
// TechTools Mobile App - Login Screen
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
import { isValidEmail } from '@/utils'

export default function LoginScreen() {
  const router = useRouter()
  const { login, isLoading, error, clearError } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  )

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}

    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleLogin = async () => {
    clearError()

    if (!validateForm()) return

    try {
      await login(email, password)
      router.replace('/(tabs)')
    } catch (err: any) {
      Alert.alert(
        'Login Failed',
        err.message || 'Please check your credentials and try again.',
      )
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
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={AppGradients.primary as [string, string, ...string[]]}
              style={styles.logoContainer}
            >
              <Ionicons name='flash' size={40} color={AppColors.white} />
            </LinearGradient>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue shopping</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label='Email'
              placeholder='Enter your email'
              value={email}
              onChangeText={(text) => {
                setEmail(text)
                if (errors.email) setErrors({ ...errors, email: undefined })
              }}
              keyboardType='email-address'
              autoCapitalize='none'
              autoCorrect={false}
              error={errors.email}
              leftIcon='mail-outline'
            />

            <Input
              label='Password'
              placeholder='Enter your password'
              value={password}
              onChangeText={(text) => {
                setPassword(text)
                if (errors.password)
                  setErrors({ ...errors, password: undefined })
              }}
              secureTextEntry
              error={errors.password}
              leftIcon='lock-closed-outline'
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

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
              title='Sign In'
              onPress={handleLogin}
              loading={isLoading}
              style={styles.loginButton}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <View style={styles.socialButtons}>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons
                  name='logo-google'
                  size={20}
                  color={AppColors.gray700}
                />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons
                  name='logo-apple'
                  size={20}
                  color={AppColors.gray700}
                />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Sign Up</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: AppSpacing['2xl'],
    marginTop: AppSpacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: AppSpacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.gray500,
  },
  form: {
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: AppSpacing.lg,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '500',
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
  loginButton: {
    marginBottom: AppSpacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: AppSpacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AppColors.gray200,
  },
  dividerText: {
    marginHorizontal: AppSpacing.base,
    fontSize: 14,
    color: AppColors.gray400,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: AppSpacing.md,
    borderRadius: AppBorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    gap: AppSpacing.sm,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.gray700,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: AppSpacing.xl,
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
