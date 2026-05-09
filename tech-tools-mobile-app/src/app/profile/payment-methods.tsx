import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import {
  getApiErrorContext,
  getApiErrorMessage,
  paymentsApi,
  securityApi,
  type PaymentMethod,
} from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'

export default function PaymentMethodsScreen() {
  const router = useRouter()
  const {
    isAuthenticated,
    isLoading: authLoading,
    hasHydrated,
  } = useAuthStore()

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
      return
    }

    if (!hasHydrated || !isAuthenticated) {
      return
    }

    loadMethods()
  }, [authLoading, hasHydrated, isAuthenticated, router])

  const loadMethods = async () => {
    try {
      setIsLoading(true)
      const methods = await paymentsApi.getPaymentMethods()
      setPaymentMethods(methods)
    } catch (error: unknown) {
      const err = getApiErrorContext(error, 'Please try again in a moment.')

      if (err.isAuthError) {
        router.replace('/(auth)/login')
        return
      }

      Alert.alert('Unable to load payment methods', err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const defaultMethod = useMemo(
    () => paymentMethods.find((item) => item.isDefault) || null,
    [paymentMethods],
  )

  const setDefault = async (methodId: string) => {
    try {
      setActionId(methodId)
      await paymentsApi.setDefaultPaymentMethod(methodId)
      void securityApi.logSensitiveAction({
        action: 'profile.payment-method.set-default',
        status: 'success',
        metadata: { paymentMethodId: methodId },
      })
      await loadMethods()
    } catch (error: unknown) {
      void securityApi.logSensitiveAction({
        action: 'profile.payment-method.set-default',
        status: 'failed',
        metadata: { paymentMethodId: methodId },
      })

      Alert.alert(
        'Default update failed',
        getApiErrorMessage(error, 'Unable to update default payment method.'),
      )
    } finally {
      setActionId(null)
    }
  }

  const removeMethod = (methodId: string) => {
    Alert.alert('Remove payment method', 'Do you want to remove this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionId(methodId)
            await paymentsApi.removePaymentMethod(methodId)
            void securityApi.logSensitiveAction({
              action: 'profile.payment-method.remove',
              status: 'success',
              metadata: { paymentMethodId: methodId },
            })
            await loadMethods()
          } catch (error: unknown) {
            void securityApi.logSensitiveAction({
              action: 'profile.payment-method.remove',
              status: 'failed',
              metadata: { paymentMethodId: methodId },
            })

            Alert.alert(
              'Removal failed',
              getApiErrorMessage(
                error,
                'Unable to remove this payment method right now.',
              ),
            )
          } finally {
            setActionId(null)
          }
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
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <TouchableOpacity onPress={loadMethods} style={styles.iconButton}>
          <Ionicons name='refresh' size={18} color={AppColors.gray700} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={paymentMethods}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Saved cards</Text>
            <Text style={styles.summaryText}>
              Manage cards linked to your account for faster checkout.
            </Text>
            {defaultMethod ? (
              <Text style={styles.defaultText}>
                Default:{' '}
                {(defaultMethod.brand || defaultMethod.type).toUpperCase()} ••••{' '}
                {defaultMethod.last4 || '----'}
              </Text>
            ) : (
              <Text style={styles.defaultText}>
                No default payment method set.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name='card-outline'
                  size={20}
                  color={AppColors.primary}
                />
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.cardTitle}>
                  {(item.brand || item.type).toUpperCase()} ••••{' '}
                  {item.last4 || '----'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  Expires {item.expMonth || '--'}/{item.expYear || '--'}
                </Text>
              </View>
              {item.isDefault && (
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>Default</Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              {!item.isDefault && (
                <TouchableOpacity
                  onPress={() => setDefault(item.id)}
                  style={styles.actionButton}
                  disabled={actionId === item.id}
                >
                  {actionId === item.id ? (
                    <ActivityIndicator size='small' color={AppColors.info} />
                  ) : (
                    <Ionicons
                      name='checkmark-circle-outline'
                      size={16}
                      color={AppColors.info}
                    />
                  )}
                  <Text style={[styles.actionText, { color: AppColors.info }]}>
                    Set Default
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => removeMethod(item.id)}
                style={styles.actionButton}
                disabled={actionId === item.id}
              >
                <Ionicons
                  name='trash-outline'
                  size={16}
                  color={AppColors.error}
                />
                <Text style={[styles.actionText, { color: AppColors.error }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name='wallet-outline'
              size={42}
              color={AppColors.gray400}
            />
            <Text style={styles.emptyTitle}>No saved payment methods</Text>
            <Text style={styles.emptySubtitle}>
              Add a card at checkout and it will appear here automatically.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/checkout')}
              style={styles.checkoutButton}
            >
              <Text style={styles.checkoutText}>Go to Checkout</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  content: {
    padding: AppSpacing.base,
    gap: AppSpacing.md,
    paddingBottom: 120,
  },
  summaryCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  summaryText: {
    marginTop: AppSpacing.xs,
    color: AppColors.gray600,
    fontSize: 13,
  },
  defaultText: {
    marginTop: AppSpacing.sm,
    color: AppColors.gray700,
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF1EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMeta: {
    flex: 1,
  },
  cardTitle: {
    color: AppColors.gray900,
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    marginTop: 2,
    color: AppColors.gray500,
    fontSize: 12,
  },
  defaultPill: {
    backgroundColor: '#E8F9F1',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  defaultPillText: {
    color: AppColors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    marginTop: AppSpacing.base,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: AppSpacing.base,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: AppSpacing['3xl'],
  },
  emptyTitle: {
    marginTop: AppSpacing.base,
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray700,
  },
  emptySubtitle: {
    marginTop: AppSpacing.xs,
    fontSize: 13,
    color: AppColors.gray500,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 19,
  },
  checkoutButton: {
    marginTop: AppSpacing.base,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.sm,
  },
  checkoutText: {
    color: AppColors.white,
    fontWeight: '700',
    fontSize: 13,
  },
})
