// ============================================
// TechTools Mobile App - Track Order Screen
// ============================================

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
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
import { useLocalSearchParams, useRouter } from 'expo-router'

import { getApiErrorMessage, ordersApiNew } from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

interface TrackedOrder {
  id: string
  order_number: string
  order_status: string
  payment_status: string
  grand_total: number
  tax_amount: number
  shipping_amount: number
  total_amount: number
  shipping_address: Record<string, any>
  items: Array<{
    id: string
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
  created_at: string
}

interface RecentOrder {
  id: string
  order_number: string
  order_status: string
  grand_total: number
  created_at: string
  item_count: number
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
]

const STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: 'receipt-outline',
  confirmed: 'checkmark-circle-outline',
  processing: 'construct-outline',
  shipped: 'car-outline',
  delivered: 'home-outline',
  cancelled: 'close-circle-outline',
  refunded: 'return-down-back-outline',
}

const STATUS_COLORS: Record<string, string> = {
  pending: AppColors.warning,
  confirmed: AppColors.info,
  processing: AppColors.secondary,
  shipped: AppColors.primary,
  delivered: AppColors.success,
  cancelled: AppColors.error,
  refunded: AppColors.gray500,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStepIndex = (status: string): number => {
  const idx = STATUS_STEPS.indexOf(status as OrderStatus)
  return idx === -1 ? 0 : idx
}

const isCancelled = (status: string) =>
  status === 'cancelled' || status === 'refunded'

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const formatCurrency = (amount: number) => `$${Number(amount).toFixed(2)}`

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatusTimelineProps {
  status: string
}

function StatusTimeline({ status }: StatusTimelineProps) {
  if (isCancelled(status)) {
    return (
      <View style={tlStyles.cancelledBadge}>
        <Ionicons
          name='close-circle'
          size={20}
          color={STATUS_COLORS[status] || AppColors.error}
        />
        <Text
          style={[
            tlStyles.cancelledText,
            { color: STATUS_COLORS[status] || AppColors.error },
          ]}
        >
          {STATUS_LABELS[status] || status}
        </Text>
      </View>
    )
  }

  const activeIdx = getStepIndex(status)

  return (
    <View style={tlStyles.container}>
      {STATUS_STEPS.map((step, idx) => {
        const isDone = idx <= activeIdx
        const isActive = idx === activeIdx
        const color = isDone ? STATUS_COLORS[step] : AppColors.gray300

        return (
          <React.Fragment key={step}>
            {/* Step node */}
            <View style={tlStyles.step}>
              <View
                style={[
                  tlStyles.dot,
                  {
                    borderColor: color,
                    backgroundColor: isDone ? color : AppColors.white,
                  },
                  isActive && tlStyles.dotActive,
                ]}
              >
                {isDone && (
                  <Ionicons
                    name={isActive ? STATUS_ICONS[step] : 'checkmark'}
                    size={isActive ? 14 : 12}
                    color={AppColors.white}
                  />
                )}
              </View>
              <Text
                style={[
                  tlStyles.stepLabel,
                  { color: isDone ? AppColors.gray800 : AppColors.gray400 },
                  isActive && tlStyles.stepLabelActive,
                ]}
              >
                {STATUS_LABELS[step]}
              </Text>
            </View>

            {/* Connector */}
            {idx < STATUS_STEPS.length - 1 && (
              <View
                style={[
                  tlStyles.connector,
                  {
                    backgroundColor:
                      idx < activeIdx ? AppColors.success : AppColors.gray200,
                  },
                ]}
              />
            )}
          </React.Fragment>
        )
      })}
    </View>
  )
}

interface OrderCardProps {
  order: TrackedOrder
}

function OrderCard({ order }: OrderCardProps) {
  const addr = order.shipping_address || {}
  const hasTracking =
    addr.tracking_number && String(addr.tracking_number).trim().length > 0

  return (
    <View style={cardStyles.container}>
      {/* Header */}
      <View style={cardStyles.header}>
        <View>
          <Text style={cardStyles.orderNum}>#{order.order_number}</Text>
          <Text style={cardStyles.date}>{formatDate(order.created_at)}</Text>
        </View>
        <View
          style={[
            cardStyles.statusBadge,
            {
              backgroundColor:
                (STATUS_COLORS[order.order_status] || AppColors.gray400) + '20',
            },
          ]}
        >
          <Text
            style={[
              cardStyles.statusText,
              { color: STATUS_COLORS[order.order_status] || AppColors.gray600 },
            ]}
          >
            {STATUS_LABELS[order.order_status] || order.order_status}
          </Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={cardStyles.timelineWrap}>
        <StatusTimeline status={order.order_status} />
      </View>

      {/* Shipping info */}
      {hasTracking && (
        <View style={cardStyles.infoRow}>
          <Ionicons
            name='barcode-outline'
            size={16}
            color={AppColors.gray500}
          />
          <Text style={cardStyles.infoText}>
            Tracking:{' '}
            <Text style={cardStyles.infoValue}>{addr.tracking_number}</Text>
          </Text>
        </View>
      )}

      {addr.carrier && (
        <View style={cardStyles.infoRow}>
          <Ionicons name='car-outline' size={16} color={AppColors.gray500} />
          <Text style={cardStyles.infoText}>
            Carrier:{' '}
            <Text style={cardStyles.infoValue}>
              {String(addr.carrier).toUpperCase()}
            </Text>
          </Text>
        </View>
      )}

      {(addr.city || addr.street) && (
        <View style={cardStyles.infoRow}>
          <Ionicons
            name='location-outline'
            size={16}
            color={AppColors.gray500}
          />
          <Text style={cardStyles.infoText} numberOfLines={2}>
            {[addr.street || addr.address, addr.city, addr.state, addr.country]
              .filter(Boolean)
              .join(', ')}
          </Text>
        </View>
      )}

      {/* Divider */}
      <View style={cardStyles.divider} />

      {/* Items */}
      {order.items.length > 0 && (
        <View style={cardStyles.itemsWrap}>
          <Text style={cardStyles.itemsLabel}>
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </Text>
          {order.items.slice(0, 2).map((item) => (
            <View key={item.id} style={cardStyles.itemRow}>
              <Text style={cardStyles.itemName} numberOfLines={1}>
                {item.product_name}
              </Text>
              <Text style={cardStyles.itemQty}>×{item.quantity}</Text>
            </View>
          ))}
          {order.items.length > 2 && (
            <Text style={cardStyles.moreItems}>
              +{order.items.length - 2} more item
              {order.items.length - 2 !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}

      {/* Total */}
      <View style={cardStyles.totalRow}>
        <Text style={cardStyles.totalLabel}>Order Total</Text>
        <Text style={cardStyles.totalValue}>
          {formatCurrency(order.grand_total)}
        </Text>
      </View>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TrackOrderScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ orderNumber?: string }>()
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const inputRef = useRef<TextInput>(null)

  const [query, setQuery] = useState(params.orderNumber ?? '')
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingRecent, setIsLoadingRecent] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Load recent orders for authenticated users to give quick-pick
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return

    const load = async () => {
      setIsLoadingRecent(true)
      try {
        const result = await ordersApiNew.getAll(1, 5)
        setRecentOrders(result.orders)
      } catch {
        // Non-critical – silently ignore
      } finally {
        setIsLoadingRecent(false)
      }
    }

    load()
  }, [hasHydrated, isAuthenticated])

  // Auto-search if an orderNumber was passed via params (deep-link / notification tap)
  useEffect(() => {
    if (params.orderNumber && params.orderNumber.trim().length > 0) {
      handleSearch(params.orderNumber.trim())
    }
  }, [params.orderNumber])

  const handleSearch = useCallback(
    async (orderNumber?: string) => {
      const term = (orderNumber ?? query).trim()
      if (!term) {
        setErrorMsg('Please enter an order number.')
        return
      }

      setIsSearching(true)
      setErrorMsg(null)
      setTrackedOrder(null)
      setHasSearched(true)

      try {
        // First try to find from recent orders list (exact match on order_number)
        const recentMatch = recentOrders.find(
          (o) => o.order_number.toLowerCase() === term.toLowerCase(),
        )

        if (recentMatch) {
          const detail = await ordersApiNew.getById(recentMatch.id)
          setTrackedOrder(detail)
        } else {
          // Search by fetching more orders and matching
          const result = await ordersApiNew.getAll(1, 50)
          const found = result.orders.find(
            (o) => o.order_number.toLowerCase() === term.toLowerCase(),
          )

          if (found) {
            const detail = await ordersApiNew.getById(found.id)
            setTrackedOrder(detail)
          } else {
            setErrorMsg(
              `No order found with number "${term}". Please check the order number and try again.`,
            )
          }
        }
      } catch (err) {
        setErrorMsg(
          getApiErrorMessage(err) || 'Failed to find order. Please try again.',
        )
      } finally {
        setIsSearching(false)
      }
    },
    [query, recentOrders],
  )

  const handleSelectRecent = useCallback(async (order: RecentOrder) => {
    setQuery(order.order_number)
    setIsSearching(true)
    setErrorMsg(null)
    setTrackedOrder(null)
    setHasSearched(true)

    try {
      const detail = await ordersApiNew.getById(order.id)
      setTrackedOrder(detail)
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err) || 'Failed to load order details.')
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleClear = () => {
    setQuery('')
    setTrackedOrder(null)
    setErrorMsg(null)
    setHasSearched(false)
    inputRef.current?.focus()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name='arrow-back' size={24} color={AppColors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Order</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          {/* Search box */}
          <View style={styles.searchCard}>
            <Text style={styles.searchHeading}>Enter your order number</Text>
            <Text style={styles.searchSubtitle}>
              Find your order confirmation email or check your order history.
            </Text>

            <View style={styles.inputRow}>
              <View style={styles.inputWrap}>
                <Ionicons
                  name='search-outline'
                  size={18}
                  color={AppColors.gray400}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder='e.g. TT-20240001'
                  placeholderTextColor={AppColors.gray400}
                  value={query}
                  onChangeText={(text) => {
                    setQuery(text)
                    if (errorMsg) setErrorMsg(null)
                  }}
                  onSubmitEditing={() => handleSearch()}
                  returnKeyType='search'
                  autoCapitalize='characters'
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={handleClear}
                    style={styles.clearBtn}
                  >
                    <Ionicons
                      name='close-circle'
                      size={18}
                      color={AppColors.gray400}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.searchBtn,
                  isSearching && styles.searchBtnDisabled,
                ]}
                onPress={() => handleSearch()}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator size='small' color={AppColors.white} />
                ) : (
                  <Text style={styles.searchBtnText}>Track</Text>
                )}
              </TouchableOpacity>
            </View>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons
                  name='alert-circle-outline'
                  size={16}
                  color={AppColors.error}
                />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}
          </View>

          {/* Result */}
          {trackedOrder && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tracking Result</Text>
              <OrderCard order={trackedOrder} />
            </View>
          )}

          {/* No result state */}
          {hasSearched && !trackedOrder && !isSearching && !errorMsg && (
            <View style={styles.emptyState}>
              <Ionicons
                name='search-outline'
                size={48}
                color={AppColors.gray300}
              />
              <Text style={styles.emptyTitle}>Order not found</Text>
              <Text style={styles.emptySubtitle}>
                Double-check the order number and try again.
              </Text>
            </View>
          )}

          {/* Recent orders quick-pick (authenticated only) */}
          {isAuthenticated && !trackedOrder && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              {isLoadingRecent ? (
                <ActivityIndicator
                  size='small'
                  color={AppColors.primary}
                  style={{ marginTop: AppSpacing.base }}
                />
              ) : recentOrders.length === 0 ? (
                <Text style={styles.noRecentText}>No recent orders found.</Text>
              ) : (
                recentOrders.map((order) => (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.recentRow}
                    onPress={() => handleSelectRecent(order)}
                  >
                    <View style={styles.recentIconWrap}>
                      <Ionicons
                        name='receipt-outline'
                        size={18}
                        color={
                          STATUS_COLORS[order.order_status] || AppColors.gray500
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentOrderNum}>
                        #{order.order_number}
                      </Text>
                      <Text style={styles.recentMeta}>
                        {STATUS_LABELS[order.order_status] ||
                          order.order_status}{' '}
                        · {formatDate(order.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.recentAmount}>
                      {formatCurrency(order.grand_total)}
                    </Text>
                    <Ionicons
                      name='chevron-forward'
                      size={16}
                      color={AppColors.gray400}
                      style={{ marginLeft: AppSpacing.xs }}
                    />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Not logged in tip */}
          {!isAuthenticated && !trackedOrder && (
            <View style={styles.tipBox}>
              <Ionicons
                name='information-circle-outline'
                size={18}
                color={AppColors.info}
              />
              <Text style={styles.tipText}>
                <Text style={{ fontWeight: '600' }}>Tip: </Text>
                Log in to quickly track any of your orders from your order
                history.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.base,
    paddingTop: AppSpacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.white,
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: AppSpacing.base,
    paddingBottom: AppSpacing['4xl'],
  },
  searchCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    marginBottom: AppSpacing.base,
    ...AppShadows.sm,
  },
  searchHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: AppSpacing.xs,
  },
  searchSubtitle: {
    fontSize: 12,
    color: AppColors.gray500,
    marginBottom: AppSpacing.base,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    paddingHorizontal: AppSpacing.sm,
    height: 48,
  },
  inputIcon: {
    marginRight: AppSpacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: AppColors.gray900,
    height: 48,
  },
  clearBtn: {
    padding: AppSpacing.xs,
  },
  searchBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.base,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  searchBtnDisabled: {
    opacity: 0.7,
  },
  searchBtnText: {
    color: AppColors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppSpacing.xs,
    backgroundColor: AppColors.error + '12',
    borderRadius: AppBorderRadius.md,
    padding: AppSpacing.sm,
    marginTop: AppSpacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: AppColors.error,
    lineHeight: 18,
  },
  section: {
    marginBottom: AppSpacing.base,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: AppSpacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: AppSpacing['3xl'],
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray700,
    marginTop: AppSpacing.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: AppSpacing.xs,
    textAlign: 'center',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    marginBottom: AppSpacing.sm,
    ...AppShadows.sm,
  },
  recentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: AppSpacing.sm,
  },
  recentOrderNum: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  recentMeta: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: 2,
  },
  recentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray800,
    marginLeft: AppSpacing.sm,
  },
  noRecentText: {
    fontSize: 13,
    color: AppColors.gray500,
    textAlign: 'center',
    paddingVertical: AppSpacing.base,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppSpacing.xs,
    backgroundColor: AppColors.info + '12',
    borderRadius: AppBorderRadius.md,
    padding: AppSpacing.base,
    marginBottom: AppSpacing.base,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.info,
    lineHeight: 19,
  },
})

// ─── Timeline Styles ──────────────────────────────────────────────────────────

const tlStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: AppSpacing.sm,
  },
  step: {
    alignItems: 'center',
    width: 52,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: AppSpacing.xs,
  },
  dotActive: {
    ...AppShadows.sm,
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  stepLabelActive: {
    fontWeight: '700',
  },
  connector: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginBottom: AppSpacing.lg,
  },
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: AppSpacing.base,
    backgroundColor: AppColors.error + '12',
    borderRadius: AppBorderRadius.md,
    alignSelf: 'flex-start',
  },
  cancelledText: {
    fontWeight: '700',
    fontSize: 14,
  },
})

// ─── Order Card Styles ────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: AppSpacing.sm,
  },
  orderNum: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  date: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: AppSpacing.xs,
    borderRadius: AppBorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timelineWrap: {
    marginVertical: AppSpacing.sm,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppSpacing.xs,
    marginTop: AppSpacing.xs,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.gray600,
  },
  infoValue: {
    fontWeight: '600',
    color: AppColors.gray800,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.gray100,
    marginVertical: AppSpacing.sm,
  },
  itemsWrap: {
    marginBottom: AppSpacing.sm,
  },
  itemsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: AppSpacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: AppColors.gray700,
  },
  itemQty: {
    fontSize: 13,
    color: AppColors.gray500,
    marginLeft: AppSpacing.sm,
  },
  moreItems: {
    fontSize: 12,
    color: AppColors.gray400,
    marginTop: AppSpacing.xs,
    fontStyle: 'italic',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: AppSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray600,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.primary,
  },
})
