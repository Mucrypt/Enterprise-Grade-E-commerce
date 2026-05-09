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
  contactApi,
  getApiErrorContext,
  getApiErrorMessage,
  ordersApiNew,
  securityApi,
} from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'

type Subject = 'technical' | 'order' | 'product' | 'billing'

const subjects: Array<{ value: Subject; label: string }> = [
  { value: 'technical', label: 'Technical' },
  { value: 'order', label: 'Order' },
  { value: 'product', label: 'Product Advice' },
  { value: 'billing', label: 'Billing' },
]

export default function ContactUsScreen() {
  const router = useRouter()
  const {
    user,
    isAuthenticated,
    hasHydrated,
    isLoading: authLoading,
  } = useAuthStore()

  const [subject, setSubject] = useState<Subject>('technical')
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState(user?.phone || '')
  const [message, setMessage] = useState('')
  const [recentOrders, setRecentOrders] = useState<
    Array<{ order_number: string }>
  >([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
      return
    }

    if (!hasHydrated || !isAuthenticated) {
      return
    }

    setPhone(user?.phone || '')

    const loadRecentOrders = async () => {
      try {
        const response = await ordersApiNew.getAll(1, 5)
        setRecentOrders(response.orders || [])
      } catch (error: unknown) {
        const err = getApiErrorContext(error)
        if (err.isAuthError) {
          router.replace('/(auth)/login')
          return
        }

        setRecentOrders([])
      } finally {
        setIsLoadingOrders(false)
      }
    }

    loadRecentOrders()
  }, [authLoading, hasHydrated, isAuthenticated, router, user?.phone])

  const canSubmit = useMemo(() => {
    return message.trim().length >= 12
  }, [message])

  const submit = async () => {
    if (!user?.email || !canSubmit) {
      Alert.alert(
        'Incomplete request',
        'Please add a clear message before sending.',
      )
      return
    }

    try {
      setIsSubmitting(true)
      const response = await contactApi.submit({
        name:
          `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
          user.email,
        email: user.email,
        phone: phone.trim() || undefined,
        subject,
        orderNumber: orderNumber.trim() || undefined,
        message: message.trim(),
      })

      void securityApi.logSensitiveAction({
        action: 'profile.support-request.submit',
        status: 'success',
        metadata: {
          subject,
          hasOrderNumber: Boolean(orderNumber.trim()),
        },
      })

      Alert.alert(
        'Request submitted',
        `${response.message}\n\nTicket: ${response.ticketNumber}`,
      )
      setMessage('')
    } catch (error: unknown) {
      void securityApi.logSensitiveAction({
        action: 'profile.support-request.submit',
        status: 'failed',
        metadata: { subject },
      })

      Alert.alert(
        'Submission failed',
        getApiErrorMessage(error, 'Could not submit your request right now.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!hasHydrated || authLoading || isLoadingOrders) {
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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Ionicons name='arrow-back' size={20} color={AppColors.gray800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Us</Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps='handled'
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create support request</Text>
            <Text style={styles.sectionSubtitle}>
              We include your account context securely so support can respond
              faster.
            </Text>

            <Text style={styles.label}>Subject</Text>
            <View style={styles.subjectRow}>
              {subjects.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setSubject(item.value)}
                  style={[
                    styles.subjectChip,
                    subject === item.value && styles.subjectChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.subjectText,
                      subject === item.value && styles.subjectTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!recentOrders.length && (
              <>
                <Text style={styles.label}>Recent order</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.orderChipRow}>
                    {recentOrders.map((order) => (
                      <TouchableOpacity
                        key={order.order_number}
                        onPress={() => setOrderNumber(order.order_number)}
                        style={[
                          styles.orderChip,
                          orderNumber === order.order_number &&
                            styles.orderChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.orderChipText,
                            orderNumber === order.order_number &&
                              styles.orderChipTextActive,
                          ]}
                        >
                          {order.order_number}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder='Phone number'
              keyboardType='phone-pad'
              style={styles.input}
            />

            <Text style={styles.label}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder='Describe your issue in detail...'
              multiline
              numberOfLines={5}
              style={[styles.input, styles.messageInput]}
              textAlignVertical='top'
              maxLength={1200}
            />
            <Text style={styles.counter}>{message.length}/1200</Text>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!canSubmit || isSubmitting) && styles.disabled,
              ]}
              onPress={submit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size='small' color={AppColors.white} />
              ) : (
                <Text style={styles.submitText}>Submit Request</Text>
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
    paddingBottom: 120,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: AppSpacing.xs,
    marginBottom: AppSpacing.base,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.gray700,
    marginBottom: AppSpacing.xs,
    marginTop: AppSpacing.sm,
  },
  subjectRow: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
    flexWrap: 'wrap',
  },
  subjectChip: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.gray50,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 8,
  },
  subjectChipActive: {
    borderColor: AppColors.primary,
    backgroundColor: '#FFF1EC',
  },
  subjectText: {
    color: AppColors.gray700,
    fontSize: 12,
    fontWeight: '600',
  },
  subjectTextActive: {
    color: AppColors.primary,
  },
  orderChipRow: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
    marginBottom: AppSpacing.xs,
  },
  orderChip: {
    borderRadius: AppBorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 8,
    backgroundColor: AppColors.gray50,
  },
  orderChipActive: {
    borderColor: AppColors.primary,
    backgroundColor: '#FFF1EC',
  },
  orderChipText: {
    color: AppColors.gray700,
    fontSize: 12,
    fontWeight: '600',
  },
  orderChipTextActive: {
    color: AppColors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.gray50,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: 11,
    fontSize: 14,
    color: AppColors.gray900,
  },
  messageInput: {
    minHeight: 130,
  },
  counter: {
    marginTop: 4,
    alignSelf: 'flex-end',
    fontSize: 11,
    color: AppColors.gray500,
  },
  submitButton: {
    marginTop: AppSpacing.base,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  submitText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
})
