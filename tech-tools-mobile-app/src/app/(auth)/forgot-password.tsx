// ============================================
// TechTools Mobile App - Forgot Password Screen
// ============================================

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Input, Button } from '@/components'
import { AppColors, AppSpacing, AppGradients } from '@/constants/appTheme'
import { authApi } from '@/api'
import { isValidEmail } from '@/utils'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email) {
      setError('Email is required')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email')
      return
    }

    setLoading(true)
    setError('')

    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.message || 'Failed to send reset email. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.successIcon}>
            <Ionicons name='mail-open' size={48} color={AppColors.accent} />
          </View>
          <Text style={styles.successTitle}>Check Your Email</Text>
          <Text style={styles.successText}>
            We've sent a password reset link to{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
          <Button
            title='Back to Login'
            onPress={() => router.push('/(auth)/login')}
            style={styles.button}
          />
          <TouchableOpacity onPress={() => setSent(false)}>
            <Text style={styles.resendText}>
              Didn't receive the email? Resend
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
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
              colors={AppGradients.accent as [string, string, ...string[]]}
              style={styles.iconContainer}
            >
              <Ionicons name='key' size={36} color={AppColors.white} />
            </LinearGradient>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your
              password.
            </Text>
          </View>

          {/* Form */}
          <Input
            label='Email'
            placeholder='Enter your email'
            value={email}
            onChangeText={(text) => {
              setEmail(text)
              setError('')
            }}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            error={error}
            leftIcon={
              <Ionicons
                name='mail-outline'
                size={20}
                color={AppColors.gray400}
              />
            }
          />

          <Button
            title='Send Reset Link'
            onPress={handleSubmit}
            loading={loading}
            style={styles.button}
          />

          <TouchableOpacity
            style={styles.backToLogin}
            onPress={() => router.push('/(auth)/login')}
          >
            <Ionicons name='arrow-back' size={16} color={AppColors.gray500} />
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    padding: AppSpacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: AppSpacing['2xl'],
  },
  iconContainer: {
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
    marginBottom: AppSpacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: AppColors.gray500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: AppSpacing.lg,
  },
  button: {
    marginTop: AppSpacing.md,
  },
  backToLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AppSpacing.xl,
    gap: AppSpacing.xs,
  },
  backToLoginText: {
    fontSize: 14,
    color: AppColors.gray500,
  },
  // Success state
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${AppColors.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: AppSpacing['4xl'],
    marginBottom: AppSpacing.xl,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.gray900,
    textAlign: 'center',
    marginBottom: AppSpacing.md,
  },
  successText: {
    fontSize: 15,
    color: AppColors.gray500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: AppSpacing['2xl'],
  },
  emailText: {
    fontWeight: '600',
    color: AppColors.gray700,
  },
  resendText: {
    fontSize: 14,
    color: AppColors.primary,
    textAlign: 'center',
    marginTop: AppSpacing.lg,
  },
})
