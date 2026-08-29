// ============================================
// Homepage Newsletter
//
// Mirrors e-commerce-web-store/src/components/home/HomepageNewsletter.tsx.
// Uses the same newsletterApi.subscribe integration (endpoint,
// payload shape, loading/success/error handling) added to this
// app's src/api/index.ts. No fake subscriber counts, no
// pre-checked consent boxes, no hidden subscriptions, no
// fabricated discount claim.
// ============================================

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { newsletterApi, getApiErrorContext } from '@/api'

export default function HomepageNewsletter() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!email.trim()) return
    setIsLoading(true)
    setError('')

    try {
      const response = await newsletterApi.subscribe({
        email: email.trim(),
        source: homepageConfig.newsletter.source,
      })

      setIsSubmitted(true)
      setMessage(response.message || 'Thanks for subscribing!')
      setEmail('')
    } catch (err) {
      const context = getApiErrorContext(
        err,
        'Failed to subscribe. Please try again.',
      )
      setError(context.message)
    } finally {
      setIsLoading(false)
    }
  }

  const { heading, description, ctaLabel } = homepageConfig.newsletter

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.description}>{description}</Text>

      {isSubmitted ? (
        <View style={styles.successBox}>
          <Ionicons name='checkmark-circle' size={20} color={AppColors.success} />
          <Text style={styles.successText}>{message}</Text>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Ionicons
              name='mail-outline'
              size={18}
              color={AppColors.slate400}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder='Enter your email'
              placeholderTextColor={AppColors.slate400}
              keyboardType='email-address'
              autoCapitalize='none'
              autoCorrect={false}
              returnKeyType='send'
              onSubmitEditing={handleSubmit}
            />
          </View>
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator size='small' color={AppColors.white} />
            ) : (
              <Text style={styles.submitButtonText}>{ctaLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!!error && (
        <View style={styles.errorRow}>
          <Ionicons name='alert-circle-outline' size={16} color={AppColors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.disclaimer}>
        By subscribing you agree to our Privacy Policy. Unsubscribe at any
        time.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.slate900,
    paddingVertical: AppSpacing['2xl'],
    paddingHorizontal: AppSpacing.base,
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: AppColors.white,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    marginTop: AppSpacing.sm,
    fontSize: 14,
    color: AppColors.slate400,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    marginTop: AppSpacing.xl,
    width: '100%',
    gap: AppSpacing.sm,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: AppSpacing.md,
    zIndex: 1,
  },
  input: {
    backgroundColor: AppColors.white,
    borderRadius: 8,
    paddingVertical: AppSpacing.md,
    paddingLeft: AppSpacing['3xl'],
    paddingRight: AppSpacing.base,
    fontSize: 14,
    color: AppColors.gray900,
  },
  submitButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: AppSpacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: AppColors.white,
  },
  successBox: {
    marginTop: AppSpacing.xl,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.base,
    paddingHorizontal: AppSpacing.lg,
  },
  successText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.white,
  },
  errorRow: {
    marginTop: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.xs,
  },
  errorText: {
    fontSize: 12,
    color: '#F87171',
  },
  disclaimer: {
    marginTop: AppSpacing.md,
    fontSize: 11,
    color: AppColors.slate500,
    textAlign: 'center',
  },
})
