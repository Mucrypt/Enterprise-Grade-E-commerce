import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import {
  AppBorderRadius,
  AppColors,
  AppGradients,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { contactApi, ordersApiNew, supportApi } from '@/api'
import { useAuthStore } from '@/stores'
import type { SupportProfile } from '@/types'
import { Button, Input } from '@/components'

type RequestSubject = 'order' | 'technical' | 'product' | 'billing'

interface RecentOrderCard {
  id: string
  order_number: string
  order_status: string
  payment_status: string
  grand_total: number
  created_at: string
  item_count: number
}

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  tint: string
  onPress: () => void
}

function ActionCard({ icon, title, subtitle, tint, onPress }: ActionCardProps) {
  return (
    <TouchableOpacity
      style={styles.actionCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: `${tint}16` }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
      <View style={styles.actionFooter}>
        <Text style={[styles.actionFooterText, { color: tint }]}>Prepare</Text>
        <Ionicons name='arrow-forward' size={16} color={tint} />
      </View>
    </TouchableOpacity>
  )
}

export default function SupportScreen() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [supportProfile, setSupportProfile] = useState<SupportProfile | null>(
    null,
  )
  const [recentOrders, setRecentOrders] = useState<RecentOrderCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] =
    useState<RequestSubject>('technical')
  const [selectedOrderNumber, setSelectedOrderNumber] = useState('')
  const [requestPhone, setRequestPhone] = useState(user?.phone || '')
  const [requestMessage, setRequestMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login')
      return
    }

    const loadSupportData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const [profile, ordersResponse] = await Promise.all([
          supportApi.getProfile(),
          ordersApiNew.getAll(1, 4),
        ])

        setSupportProfile(profile)
        setRecentOrders(ordersResponse.orders || [])
        setSelectedOrderNumber(profile.recentOrder?.order_number || '')
      } catch (loadError: any) {
        setError(
          loadError?.response?.data?.error ||
            'Unable to load Smart Support right now.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadSupportData()
  }, [isAuthenticated, router])

  useEffect(() => {
    if (user?.phone) {
      setRequestPhone(user.phone)
    }
  }, [user?.phone])

  const headline = useMemo(() => {
    if (supportProfile) {
      return `Support built around ${supportProfile.customer.firstName}'s account`
    }

    if (user?.first_name) {
      return `Support built around ${user.first_name}'s account`
    }

    return 'Support built around your account'
  }, [supportProfile, user])

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url)
    } catch {
      Alert.alert(
        'Smart Support',
        'This action is temporarily unavailable. Please try again.',
      )
    }
  }

  const subjectOptions: Array<{
    value: RequestSubject
    label: string
    icon: keyof typeof Ionicons.glyphMap
  }> = [
    { value: 'technical', label: 'Tech help', icon: 'build-outline' },
    { value: 'order', label: 'Order issue', icon: 'cube-outline' },
    { value: 'product', label: 'Product advice', icon: 'sparkles-outline' },
    { value: 'billing', label: 'Billing', icon: 'card-outline' },
  ]

  const statusTone = (status: string) => {
    switch (status) {
      case 'delivered':
        return { bg: '#ECFDF5', text: AppColors.accent }
      case 'shipped':
      case 'ready_to_ship':
        return { bg: '#EFF6FF', text: AppColors.info }
      case 'processing':
      case 'confirmed':
        return { bg: '#FFF7ED', text: AppColors.primary }
      case 'cancelled':
      case 'refunded':
        return { bg: '#FEF2F2', text: AppColors.error }
      default:
        return { bg: '#F3F4F6', text: AppColors.gray600 }
    }
  }

  const prefillRequest = (subject: RequestSubject, orderNumber?: string) => {
    setSelectedSubject(subject)

    if (orderNumber) {
      setSelectedOrderNumber(orderNumber)
    }

    const orderLine = orderNumber ? ` for order ${orderNumber}` : ''
    const templateMap: Record<RequestSubject, string> = {
      technical: `I need technical help${orderLine}.`,
      order: `I need support with my order${orderLine}.`,
      product: `I need product guidance${orderLine}.`,
      billing: `I need billing assistance${orderLine}.`,
    }

    setRequestMessage(templateMap[subject])
  }

  const submitRequest = async () => {
    if (!user?.email || !requestMessage.trim()) {
      Alert.alert(
        'Smart Support',
        'Please add a message before sending your request.',
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
        phone: requestPhone || undefined,
        subject: selectedSubject,
        orderNumber: selectedOrderNumber || undefined,
        message: requestMessage.trim(),
      })

      setTicketNumber(response.ticketNumber)
      Alert.alert(
        'Request sent',
        `${response.message}\n\nTicket: ${response.ticketNumber}`,
      )
      setRequestMessage('')
    } catch (submitError: any) {
      Alert.alert(
        'Smart Support',
        submitError?.response?.data?.error ||
          'Failed to send your request. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const primaryActions = [
    {
      icon: 'chatbubble-ellipses-outline' as const,
      title: 'Live Concierge',
      subtitle:
        'Prepare an account-aware support request with your order and loyalty context already attached.',
      tint: AppColors.primary,
      onPress: () =>
        prefillRequest(
          'technical',
          selectedOrderNumber || supportProfile?.recentOrder?.order_number,
        ),
    },
    {
      icon: 'videocam-outline' as const,
      title: 'Video Session',
      subtitle:
        'Queue a guided diagnostic or premium product walkthrough from inside the app.',
      tint: AppColors.secondary,
      onPress: () =>
        prefillRequest(
          'technical',
          selectedOrderNumber || supportProfile?.recentOrder?.order_number,
        ),
    },
    {
      icon: 'navigate-outline' as const,
      title: 'Track & Resolve',
      subtitle:
        'Use the order cards below to select an order and open a tracked support request instantly.',
      tint: AppColors.accent,
      onPress: () =>
        prefillRequest(
          'order',
          selectedOrderNumber || supportProfile?.recentOrder?.order_number,
        ),
    },
  ]

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen} edges={['top']}>
        <ActivityIndicator size='large' color={AppColors.primary} />
        <Text style={styles.loadingText}>
          Building your Smart Support desk...
        </Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#111827', '#1F2937', '#FF6B35'] as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.back()}
            >
              <Ionicons name='chevron-back' size={22} color={AppColors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => openUrl('https://techtoolstore.com/faq')}
            >
              <Ionicons
                name='help-circle-outline'
                size={20}
                color={AppColors.white}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.heroBadge}>
            <Ionicons
              name='sparkles-outline'
              size={14}
              color={AppColors.white}
            />
            <Text style={styles.heroBadgeText}>Smart Support</Text>
          </View>

          <Text style={styles.heroTitle}>{headline}</Text>
          <Text style={styles.heroSubtitle}>
            A native concierge layer for premium buyers: live order context,
            verified proof, loyalty-aware help, and tracked requests that never
            force the user out of the app.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>
                {supportProfile?.orderSummary.activeOrders || 0}
              </Text>
              <Text style={styles.heroStatLabel}>Active orders</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>
                {supportProfile?.loyalty.points || 0}
              </Text>
              <Text style={styles.heroStatLabel}>Reward points</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{recentOrders.length}</Text>
              <Text style={styles.heroStatLabel}>Recent orders</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {error ? (
            <View style={styles.errorCard}>
              <Ionicons
                name='alert-circle-outline'
                size={20}
                color={AppColors.error}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Premium actions</Text>
              <Text style={styles.sectionTitle}>Prepare your support flow</Text>
            </View>
          </View>

          <View style={styles.actionGrid}>
            {primaryActions.map((action) => (
              <ActionCard key={action.title} {...action} />
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Order tracking</Text>
              <Text style={styles.sectionTitle}>Recent account orders</Text>
            </View>
          </View>

          {recentOrders.length > 0 ? (
            <View style={styles.orderList}>
              {recentOrders.map((order) => {
                const tone = statusTone(order.order_status)

                return (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderCardHeader}>
                      <View>
                        <Text style={styles.orderNumber}>
                          {order.order_number}
                        </Text>
                        <Text style={styles.orderMeta}>
                          {new Date(order.created_at).toLocaleDateString()} ·{' '}
                          {order.item_count} items
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.orderStatusBadge,
                          { backgroundColor: tone.bg },
                        ]}
                      >
                        <Text
                          style={[styles.orderStatusText, { color: tone.text }]}
                        >
                          {order.order_status.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.orderCardBody}>
                      <View>
                        <Text style={styles.orderAmount}>
                          ${Number(order.grand_total).toFixed(2)}
                        </Text>
                        <Text style={styles.orderPayment}>
                          Payment: {order.payment_status}
                        </Text>
                      </View>

                      <View style={styles.orderActionsRow}>
                        <TouchableOpacity
                          style={styles.orderActionButton}
                          onPress={() =>
                            prefillRequest('order', order.order_number)
                          }
                        >
                          <Ionicons
                            name='chatbox-ellipses-outline'
                            size={16}
                            color={AppColors.primary}
                          />
                          <Text style={styles.orderActionText}>Need help</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.orderActionButton}
                          onPress={() =>
                            setSelectedOrderNumber(order.order_number)
                          }
                        >
                          <Ionicons
                            name='locate-outline'
                            size={16}
                            color={AppColors.info}
                          />
                          <Text
                            style={[
                              styles.orderActionText,
                              { color: AppColors.info },
                            ]}
                          >
                            Use in form
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons
                name='cube-outline'
                size={24}
                color={AppColors.secondary}
              />
              <Text style={styles.emptyTitle}>No recent orders yet</Text>
              <Text style={styles.emptyText}>
                Once orders are placed, Smart Support will surface live order
                cards here for faster tracking and resolution.
              </Text>
            </View>
          )}

          <LinearGradient
            colors={AppGradients.secondary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.storyCard}
          >
            <Text style={styles.storyEyebrow}>Account intelligence</Text>
            <Text style={styles.storyTitle}>
              What Smart Support already knows
            </Text>
            <View style={styles.storyList}>
              {(
                supportProfile?.smartSuggestions || [
                  'Your support desk can prioritize account-aware help as soon as you start a conversation.',
                  'Video support and guided diagnostics are ready for more complex installs.',
                  'Co-browsing style workflows can be requested from here without starting over.',
                ]
              )
                .slice(0, 3)
                .map((item) => (
                  <View key={item} style={styles.storyItem}>
                    <Ionicons
                      name='sparkles'
                      size={14}
                      color={AppColors.white}
                    />
                    <Text style={styles.storyItemText}>{item}</Text>
                  </View>
                ))}
            </View>
          </LinearGradient>

          <View style={styles.dualColumnSection}>
            <View style={styles.panelCard}>
              <Text style={styles.panelEyebrow}>Loyalty</Text>
              <Text style={styles.panelValue}>
                {supportProfile?.loyalty.tier || 'Bronze'}
              </Text>
              <Text style={styles.panelText}>
                {supportProfile?.loyalty.pointsToNextTier
                  ? `${supportProfile.loyalty.pointsToNextTier} points to ${supportProfile.loyalty.nextTier}`
                  : 'You are already at the top support tier.'}
              </Text>
            </View>
            <View style={styles.panelCardDark}>
              <Text style={styles.panelEyebrowLight}>Selected order</Text>
              <Text style={styles.panelValueLight}>
                {selectedOrderNumber || 'Pick an order'}
              </Text>
              <Text style={styles.panelTextLight}>
                {selectedOrderNumber
                  ? 'This order will be attached to your next support request.'
                  : 'Select an order card to attach it to your support ticket.'}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Proof & recommendations</Text>
              <Text style={styles.sectionTitle}>Verified trust signals</Text>
            </View>
          </View>

          {(supportProfile?.verifiedReviews.length || 0) > 0 ? (
            supportProfile!.verifiedReviews.slice(0, 2).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewProduct}>{review.productName}</Text>
                  <View style={styles.reviewBadge}>
                    <Ionicons
                      name='checkmark-circle'
                      size={14}
                      color={AppColors.accent}
                    />
                    <Text style={styles.reviewBadgeText}>Verified</Text>
                  </View>
                </View>
                <Text style={styles.reviewMeta}>{review.rating}/5 stars</Text>
                {review.comment ? (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons
                name='shield-checkmark-outline'
                size={24}
                color={AppColors.secondary}
              />
              <Text style={styles.emptyTitle}>
                Verified proof will appear here
              </Text>
              <Text style={styles.emptyText}>
                As you buy and review products, Smart Support will use those
                trust signals to speed up conversations and recommendations.
              </Text>
            </View>
          )}

          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Request support</Text>
              <Text style={styles.sectionTitle}>
                Send a real support ticket
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formLead}>
              Submit a native support request from inside the app. Your account
              details are prefilled and the team receives a tracked ticket
              immediately.
            </Text>

            <View style={styles.subjectChipRow}>
              {subjectOptions.map((option) => {
                const active = option.value === selectedSubject

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.subjectChip,
                      active && styles.subjectChipActive,
                    ]}
                    onPress={() => setSelectedSubject(option.value)}
                  >
                    <Ionicons
                      name={option.icon}
                      size={14}
                      color={active ? AppColors.white : AppColors.gray600}
                    />
                    <Text
                      style={[
                        styles.subjectChipText,
                        active && styles.subjectChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Input
              label='Contact phone'
              value={requestPhone}
              onChangeText={setRequestPhone}
              placeholder='Add the best number to reach you'
              leftIcon='call-outline'
              keyboardType='phone-pad'
            />

            <Input
              label='Order number'
              value={selectedOrderNumber}
              onChangeText={setSelectedOrderNumber}
              placeholder='Optional unless this is an order issue'
              leftIcon='cube-outline'
            />

            <Text style={styles.textareaLabel}>Message</Text>
            <TextInput
              value={requestMessage}
              onChangeText={setRequestMessage}
              placeholder='Describe the issue, what you need, and any urgency.'
              placeholderTextColor={AppColors.gray400}
              multiline
              textAlignVertical='top'
              style={styles.textarea}
            />

            {ticketNumber ? (
              <View style={styles.ticketCard}>
                <Ionicons
                  name='checkmark-circle'
                  size={18}
                  color={AppColors.accent}
                />
                <Text style={styles.ticketText}>
                  Latest ticket: {ticketNumber}
                </Text>
              </View>
            ) : null}

            <View style={styles.formButtonRow}>
              <Button
                title={
                  isSubmitting ? 'Sending request...' : 'Send Support Request'
                }
                onPress={submitRequest}
                icon='send-outline'
                fullWidth
                loading={isSubmitting}
              />
              <Button
                title='Reset Form'
                onPress={() => {
                  setRequestMessage('')
                  setSelectedOrderNumber('')
                  setSelectedSubject('technical')
                }}
                variant='outline'
                fullWidth
                style={styles.secondaryButton}
              />
            </View>
          </View>

          <View style={styles.ctaFooter}>
            <Button
              title='Back to Profile'
              onPress={() => router.back()}
              variant='outline'
              fullWidth
              style={styles.secondaryButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: AppColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: AppSpacing.base,
  },
  loadingText: {
    fontSize: 15,
    color: AppColors.gray600,
    fontWeight: '600',
  },
  hero: {
    paddingHorizontal: AppSpacing.base,
    paddingTop: AppSpacing.md,
    paddingBottom: AppSpacing['3xl'],
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppSpacing.xl,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: AppSpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.full,
    marginBottom: AppSpacing.base,
  },
  heroBadgeText: {
    color: AppColors.white,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: AppColors.white,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    marginBottom: AppSpacing.md,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: AppSpacing.xl,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
  },
  heroStatValue: {
    color: AppColors.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: AppSpacing.base,
    marginTop: -AppSpacing.xl,
    gap: AppSpacing.lg,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    backgroundColor: '#FFF1F2',
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  errorText: {
    flex: 1,
    color: AppColors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionEyebrow: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionTitle: {
    color: AppColors.gray900,
    fontSize: 24,
    fontWeight: '800',
  },
  actionGrid: {
    gap: AppSpacing.base,
  },
  actionCard: {
    backgroundColor: AppColors.white,
    borderRadius: 26,
    padding: AppSpacing.lg,
    ...AppShadows.md,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.base,
  },
  actionTitle: {
    color: AppColors.gray900,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: AppSpacing.sm,
  },
  actionSubtitle: {
    color: AppColors.gray600,
    fontSize: 14,
    lineHeight: 22,
  },
  actionFooter: {
    marginTop: AppSpacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
  },
  actionFooterText: {
    fontWeight: '700',
    fontSize: 13,
  },
  orderList: {
    gap: AppSpacing.base,
  },
  orderCard: {
    backgroundColor: AppColors.white,
    borderRadius: 24,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: AppSpacing.md,
    alignItems: 'flex-start',
    marginBottom: AppSpacing.base,
  },
  orderNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  orderMeta: {
    marginTop: 4,
    color: AppColors.gray500,
    fontSize: 12,
  },
  orderStatusBadge: {
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 6,
    borderRadius: AppBorderRadius.full,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  orderCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: AppSpacing.base,
  },
  orderAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  orderPayment: {
    marginTop: 4,
    fontSize: 12,
    color: AppColors.gray500,
    textTransform: 'capitalize',
  },
  orderActionsRow: {
    gap: AppSpacing.sm,
  },
  orderActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  orderActionText: {
    color: AppColors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  storyCard: {
    borderRadius: 30,
    padding: AppSpacing.xl,
    ...AppShadows.lg,
  },
  storyEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: AppSpacing.sm,
  },
  storyTitle: {
    color: AppColors.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: AppSpacing.lg,
  },
  storyList: {
    gap: AppSpacing.md,
  },
  storyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppSpacing.sm,
  },
  storyItemText: {
    flex: 1,
    color: AppColors.white,
    fontSize: 14,
    lineHeight: 22,
  },
  dualColumnSection: {
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  panelCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: AppSpacing.lg,
    ...AppShadows.md,
  },
  panelCardDark: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 26,
    padding: AppSpacing.lg,
    ...AppShadows.md,
  },
  panelEyebrow: {
    color: AppColors.gray500,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  panelEyebrowLight: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  panelValue: {
    color: AppColors.gray900,
    fontSize: 24,
    fontWeight: '800',
    marginTop: AppSpacing.sm,
    marginBottom: AppSpacing.sm,
  },
  panelValueLight: {
    color: AppColors.white,
    fontSize: 20,
    fontWeight: '800',
    marginTop: AppSpacing.sm,
    marginBottom: AppSpacing.sm,
  },
  panelText: {
    color: AppColors.gray600,
    fontSize: 13,
    lineHeight: 20,
  },
  panelTextLight: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 20,
  },
  reviewCard: {
    backgroundColor: AppColors.white,
    borderRadius: 22,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  reviewProduct: {
    flex: 1,
    color: AppColors.gray900,
    fontWeight: '800',
    fontSize: 15,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 6,
    borderRadius: AppBorderRadius.full,
  },
  reviewBadgeText: {
    color: AppColors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  reviewMeta: {
    color: AppColors.gray500,
    fontSize: 12,
    marginTop: AppSpacing.sm,
  },
  reviewComment: {
    color: AppColors.gray700,
    fontSize: 14,
    lineHeight: 21,
    marginTop: AppSpacing.sm,
  },
  emptyCard: {
    backgroundColor: AppColors.white,
    borderRadius: 24,
    padding: AppSpacing.xl,
    alignItems: 'center',
    gap: AppSpacing.sm,
    ...AppShadows.sm,
  },
  emptyTitle: {
    color: AppColors.gray900,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: AppColors.gray600,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: AppColors.white,
    borderRadius: 28,
    padding: AppSpacing.lg,
    ...AppShadows.md,
  },
  formLead: {
    color: AppColors.gray600,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: AppSpacing.base,
  },
  subjectChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
    marginBottom: AppSpacing.base,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppColors.gray100,
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
  },
  subjectChipActive: {
    backgroundColor: AppColors.primary,
  },
  subjectChipText: {
    color: AppColors.gray600,
    fontSize: 12,
    fontWeight: '700',
  },
  subjectChipTextActive: {
    color: AppColors.white,
  },
  textareaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray700,
    marginBottom: AppSpacing.sm,
  },
  textarea: {
    minHeight: 140,
    borderRadius: AppBorderRadius.xl,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    backgroundColor: AppColors.gray50,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.base,
    color: AppColors.gray800,
    fontSize: 15,
    marginBottom: AppSpacing.base,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    backgroundColor: '#ECFDF5',
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
    marginBottom: AppSpacing.base,
  },
  ticketText: {
    color: AppColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  formButtonRow: {
    gap: AppSpacing.md,
  },
  ctaFooter: {
    gap: AppSpacing.md,
    paddingBottom: AppSpacing['3xl'],
  },
  secondaryButton: {
    backgroundColor: AppColors.white,
  },
})
