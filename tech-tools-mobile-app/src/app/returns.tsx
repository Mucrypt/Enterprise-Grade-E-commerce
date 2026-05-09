import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
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
import { formatPrice } from '@/utils'

interface ReturnOrderItem {
  id: string
  order_number: string
  order_status: string
  payment_status: string
  grand_total: number
  created_at: string
  item_count: number
}

const returnReasons = [
  'Wrong item received',
  'Item arrived damaged',
  'Item not as described',
  'Changed my mind',
  'Other issue',
]

export default function ReturnsScreen() {
  const router = useRouter()
  const {
    user,
    isAuthenticated,
    hasHydrated,
    isLoading: authLoading,
  } = useAuthStore()

  const [orders, setOrders] = useState<ReturnOrderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ReturnOrderItem | null>(
    null,
  )
  const [reason, setReason] = useState(returnReasons[0])
  const [details, setDetails] = useState('')

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
      return
    }

    if (!hasHydrated || !isAuthenticated) {
      return
    }

    loadOrders()
  }, [authLoading, hasHydrated, isAuthenticated, router])

  const loadOrders = async () => {
    try {
      setIsLoading(true)
      const response = await ordersApiNew.getAll(1, 30)
      const returnEligible = (response.orders || []).filter((order) =>
        ['delivered', 'shipped', 'ready_to_ship'].includes(order.order_status),
      )
      setOrders(returnEligible)
      setSelectedOrder((current) => {
        if (current) {
          const found = returnEligible.find((item) => item.id === current.id)
          if (found) return found
        }
        return returnEligible[0] || null
      })
    } catch (error: unknown) {
      const err = getApiErrorContext(error, 'Try again in a moment.')
      if (err.isAuthError) {
        router.replace('/(auth)/login')
        return
      }

      Alert.alert('Unable to load orders', err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = useMemo(() => {
    return !!selectedOrder && details.trim().length >= 12
  }, [selectedOrder, details])

  const submitReturnRequest = async () => {
    if (!canSubmit || !selectedOrder || !user?.email) {
      Alert.alert(
        'Incomplete request',
        'Choose an order and provide return details before submitting.',
      )
      return
    }

    try {
      setIsSubmitting(true)

      const payloadMessage = [
        `Return request reason: ${reason}.`,
        `Order status: ${selectedOrder.order_status}.`,
        `Details: ${details.trim()}`,
      ].join(' ')

      const response = await contactApi.submit({
        name:
          `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
          user.email,
        email: user.email,
        phone: user.phone || undefined,
        subject: 'order',
        orderNumber: selectedOrder.order_number,
        message: payloadMessage,
      })

      void securityApi.logSensitiveAction({
        action: 'profile.return-request.submit',
        status: 'success',
        metadata: {
          orderNumber: selectedOrder.order_number,
          subject: 'order',
        },
      })

      Alert.alert(
        'Return request submitted',
        `${response.message}\n\nTicket: ${response.ticketNumber}`,
      )
      setDetails('')
    } catch (error: unknown) {
      void securityApi.logSensitiveAction({
        action: 'profile.return-request.submit',
        status: 'failed',
      })

      Alert.alert(
        'Submission failed',
        getApiErrorMessage(
          error,
          'We could not submit your return request right now.',
        ),
      )
    } finally {
      setIsSubmitting(false)
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
        <Text style={styles.headerTitle}>Returns</Text>
        <TouchableOpacity onPress={loadOrders} style={styles.iconButton}>
          <Ionicons name='refresh' size={18} color={AppColors.gray700} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Start a return request</Text>
            <Text style={styles.sectionSubtitle}>
              Choose an eligible order and provide return details for faster
              review.
            </Text>

            <Text style={styles.label}>Reason</Text>
            <View style={styles.reasonRow}>
              {returnReasons.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setReason(item)}
                  style={[
                    styles.reasonChip,
                    reason === item && styles.reasonChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      reason === item && styles.reasonTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Details</Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder='Share what happened and the expected resolution...'
              multiline
              numberOfLines={5}
              style={styles.detailsInput}
              textAlignVertical='top'
              maxLength={1000}
            />
            <Text style={styles.counter}>{details.length}/1000</Text>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!canSubmit || isSubmitting) && styles.disabled,
              ]}
              onPress={submitReturnRequest}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size='small' color={AppColors.white} />
              ) : (
                <Text style={styles.submitText}>Submit Return Request</Text>
              )}
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedOrder?.id === item.id

          return (
            <TouchableOpacity
              style={[styles.orderCard, isSelected && styles.orderCardSelected]}
              onPress={() => setSelectedOrder(item)}
              activeOpacity={0.86}
            >
              <View style={styles.orderTopRow}>
                <Text style={styles.orderNumber}>{item.order_number}</Text>
                <Text style={styles.orderDate}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.orderBottomRow}>
                <Text style={styles.orderMeta}>
                  {item.item_count || 0} items
                </Text>
                <Text style={styles.orderTotal}>
                  {formatPrice(item.grand_total)}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{item.order_status}</Text>
                </View>
                {isSelected && (
                  <Ionicons
                    name='checkmark-circle'
                    size={18}
                    color={AppColors.primary}
                  />
                )}
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name='return-down-back-outline'
              size={42}
              color={AppColors.gray400}
            />
            <Text style={styles.emptyTitle}>No return-eligible orders</Text>
            <Text style={styles.emptySubtitle}>
              Delivered or shipped orders will appear here when eligible.
            </Text>
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
  formCard: {
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
    marginTop: AppSpacing.xs,
    marginBottom: AppSpacing.base,
    color: AppColors.gray500,
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    color: AppColors.gray700,
    fontWeight: '700',
    marginBottom: AppSpacing.xs,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
    marginBottom: AppSpacing.base,
  },
  reasonChip: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.gray50,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 8,
  },
  reasonChipActive: {
    borderColor: AppColors.primary,
    backgroundColor: '#FFF1EC',
  },
  reasonText: {
    fontSize: 12,
    color: AppColors.gray700,
    fontWeight: '600',
  },
  reasonTextActive: {
    color: AppColors.primary,
  },
  detailsInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.gray50,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: 11,
    color: AppColors.gray900,
    fontSize: 14,
  },
  counter: {
    marginTop: 4,
    alignSelf: 'flex-end',
    color: AppColors.gray500,
    fontSize: 11,
  },
  submitButton: {
    marginTop: AppSpacing.base,
    minHeight: 46,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: AppColors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
  orderCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  orderCardSelected: {
    borderWidth: 1,
    borderColor: '#FFD7C9',
    backgroundColor: '#FFF9F6',
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  orderDate: {
    fontSize: 12,
    color: AppColors.gray500,
  },
  orderBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: AppSpacing.sm,
  },
  orderMeta: {
    color: AppColors.gray600,
    fontSize: 12,
  },
  orderTotal: {
    color: AppColors.gray900,
    fontSize: 15,
    fontWeight: '700',
  },
  statusRow: {
    marginTop: AppSpacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    backgroundColor: AppColors.gray100,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: AppColors.gray700,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
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
    textAlign: 'center',
    color: AppColors.gray500,
    fontSize: 13,
    maxWidth: 260,
  },
})
