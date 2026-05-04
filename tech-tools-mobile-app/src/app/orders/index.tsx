import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { type Href, useRouter } from 'expo-router'

import { ordersApiNew } from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'
import { formatPrice, getOrderStatusColor } from '@/utils'

type OrderListItem = {
  id: string
  order_number: string
  order_status: string
  payment_status: string
  grand_total: number
  created_at: string
  item_count: number
}

export default function OrdersScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadOrders = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      const response = await ordersApiNew.getAll(1, 20)
      setOrders(response.orders || [])
    } catch (error) {
      console.error('Failed to load orders:', error)
      setOrders([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login')
      return
    }

    loadOrders()
  }, [isAuthenticated])

  const openOrder = (orderId: string) => {
    router.push(`/orders/${orderId}` as Href)
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name='arrow-back' size={20} color={AppColors.gray700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.spacer} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          orders.length === 0 ? styles.emptyContent : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadOrders(true)}
            tintColor={AppColors.primary}
          />
        }
        renderItem={({ item }) => {
          const statusColor = getOrderStatusColor(item.order_status)

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openOrder(item.id)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.orderNumber}>{item.order_number}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusColor}18` },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {item.order_status}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
                <Text style={styles.metaText}>
                  {item.item_count || 0} items
                </Text>
              </View>

              <View style={styles.bottomRow}>
                <Text style={styles.total}>
                  {formatPrice(item.grand_total)}
                </Text>
                <View style={styles.arrowWrap}>
                  <Ionicons
                    name='chevron-forward'
                    size={18}
                    color={AppColors.gray500}
                  />
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name='receipt-outline'
              size={40}
              color={AppColors.gray400}
            />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>
              Your placed orders will appear here.
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
  listContent: {
    padding: AppSpacing.base,
    gap: AppSpacing.md,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppSpacing.sm,
  },
  orderNumber: {
    fontSize: 14,
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
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.sm,
  },
  metaText: {
    fontSize: 12,
    color: AppColors.gray500,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  arrowWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.xl,
  },
  emptyWrap: {
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: AppSpacing.base,
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray700,
  },
  emptySubtitle: {
    marginTop: AppSpacing.xs,
    fontSize: 13,
    color: AppColors.gray500,
  },
})
