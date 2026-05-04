import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { type Href, useLocalSearchParams, useRouter } from 'expo-router'

import { ordersApiNew } from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'
import { formatPrice, getOrderStatusColor } from '@/utils'

type OrderItem = {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

type OrderDetail = {
  id: string
  order_number: string
  order_status: string
  payment_status: string
  total_amount: number
  tax_amount: number
  shipping_amount: number
  grand_total: number
  created_at: string
  items: OrderItem[]
}

export default function OrderDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isAuthenticated } = useAuthStore()

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCancelling, setIsCancelling] = useState(false)

  const loadOrder = async () => {
    if (!id) return

    try {
      setIsLoading(true)
      const data = await ordersApiNew.getById(id)
      setOrder(data as OrderDetail)
    } catch (error) {
      console.error('Failed to load order details:', error)
      setOrder(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login')
      return
    }

    loadOrder()
  }, [id, isAuthenticated])

  const canCancel = useMemo(() => {
    if (!order) return false
    return ['pending', 'confirmed', 'processing'].includes(order.order_status)
  }, [order])

  const onCancelOrder = async () => {
    if (!order) return

    Alert.alert('Cancel Order', `Cancel order ${order.order_number}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsCancelling(true)
            await ordersApiNew.cancel(order.id, 'Cancelled from mobile app')
            await loadOrder()
          } catch (error) {
            Alert.alert('Order', 'Unable to cancel this order right now.')
          } finally {
            setIsCancelling(false)
          }
        },
      },
    ])
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons
          name='alert-circle-outline'
          size={40}
          color={AppColors.gray400}
        />
        <Text style={styles.emptyTitle}>Order not found</Text>
        <TouchableOpacity
          style={styles.backToOrdersButton}
          onPress={() => router.replace('/orders' as Href)}
        >
          <Text style={styles.backToOrdersText}>Back to orders</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const statusColor = getOrderStatusColor(order.order_status)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name='arrow-back' size={20} color={AppColors.gray700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.orderNumber}>{order.order_number}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${statusColor}18` },
              ]}
            >
              <Text style={[styles.statusText, { color: statusColor }]}>
                {order.order_status}
              </Text>
            </View>
          </View>

          <Text style={styles.meta}>
            Placed on {new Date(order.created_at).toLocaleString()}
          </Text>
          <Text style={styles.meta}>Payment: {order.payment_status}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemMeta}>
                  Qty {item.quantity} x {formatPrice(item.unit_price)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                {formatPrice(item.total_price)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatPrice(order.total_amount)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>
              {formatPrice(order.tax_amount)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>
              {formatPrice(order.shipping_amount)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.grandLabel}>Grand Total</Text>
            <Text style={styles.grandValue}>
              {formatPrice(order.grand_total)}
            </Text>
          </View>
        </View>

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancelOrder}
            disabled={isCancelling}
          >
            <Text style={styles.cancelButtonText}>
              {isCancelling ? 'Cancelling...' : 'Cancel Order'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  center: {
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
  backButton: {
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
  spacer: {
    width: 34,
  },
  content: {
    padding: AppSpacing.base,
    gap: AppSpacing.md,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  meta: {
    marginTop: AppSpacing.xs,
    fontSize: 12,
    color: AppColors.gray500,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.gray800,
    marginBottom: AppSpacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: AppSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  itemMain: {
    flex: 1,
    paddingRight: AppSpacing.sm,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray800,
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 12,
    color: AppColors.gray500,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.xs,
  },
  summaryLabel: {
    fontSize: 13,
    color: AppColors.gray600,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray800,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.gray100,
    marginVertical: AppSpacing.sm,
  },
  grandLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  grandValue: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.primary,
  },
  cancelButton: {
    height: 46,
    borderRadius: AppBorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    marginBottom: AppSpacing.lg,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.error,
  },
  emptyTitle: {
    marginTop: AppSpacing.base,
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray700,
  },
  backToOrdersButton: {
    marginTop: AppSpacing.base,
    paddingHorizontal: AppSpacing.base,
    height: 40,
    borderRadius: AppBorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
  },
  backToOrdersText: {
    color: AppColors.white,
    fontWeight: '700',
  },
})
