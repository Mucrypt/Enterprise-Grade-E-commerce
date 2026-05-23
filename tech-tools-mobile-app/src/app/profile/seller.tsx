import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { creatorApi, sellerApi, userApi } from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import type {
  CreatorActivityItem,
  SellerProfile,
  SellerTier,
  SellerTierConfig,
  SellerVerificationRequest,
} from '@/types'
import { useAuthStore } from '@/stores'

const tierOrder: SellerTier[] = ['unverified', 'basic', 'trusted', 'pro']

const formatTier = (tier: string) =>
  tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, ' ')

const formatMoney = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') {
    return 'Custom'
  }

  return `$${Number(value).toFixed(2)}`
}

export default function SellerHubScreen() {
  const router = useRouter()
  const { user, isAuthenticated, hasHydrated, isLoading, updateUser } =
    useAuthStore()
  const [screenLoading, setScreenLoading] = useState(true)
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
  const [tiers, setTiers] = useState<SellerTierConfig[]>([])
  const [requests, setRequests] = useState<SellerVerificationRequest[]>([])
  const [activityFeed, setActivityFeed] = useState<CreatorActivityItem[]>([])
  const [activityNextCursor, setActivityNextCursor] = useState<string | null>(
    null,
  )
  const [activityHasMore, setActivityHasMore] = useState(false)
  const [activityLoadingMore, setActivityLoadingMore] = useState(false)
  const [message, setMessage] = useState('')
  const [busyAction, setBusyAction] = useState<
    'activate' | 'onboard' | SellerTier | null
  >(null)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !isLoading) {
      router.replace('/(auth)/login')
    }
  }, [hasHydrated, isAuthenticated, isLoading, router])

  useEffect(() => {
    const load = async () => {
      if (!hasHydrated || !isAuthenticated) {
        return
      }

      setScreenLoading(true)
      try {
        const [tierData, profileData, requestData, activityData] =
          await Promise.all([
          sellerApi.getTierConfig().catch(() => []),
          sellerApi
            .getMyProfile()
            .catch(() => ({ sellerProfile: null, eligible: false })),
          sellerApi.getVerificationRequests().catch(() => []),
          creatorApi.getDashboardActivity().catch(() => ({
            items: [],
            pagination: {
              hasMore: false,
              nextCursor: null,
              limit: 10,
            },
            generatedAt: new Date().toISOString(),
          })),
        ])

        setTiers(tierData)
        setSellerProfile(profileData.sellerProfile)
        setRequests(requestData)
        setActivityFeed(activityData.items)
        setActivityHasMore(activityData.pagination?.hasMore ?? false)
        setActivityNextCursor(activityData.pagination?.nextCursor ?? null)
      } catch {
        setMessage('Could not load seller tools right now.')
      } finally {
        setScreenLoading(false)
      }
    }

    load()
  }, [hasHydrated, isAuthenticated])

  const currentTierIndex = useMemo(() => {
    const tier = sellerProfile?.tier || 'unverified'
    return tierOrder.indexOf(tier as SellerTier)
  }, [sellerProfile?.tier])

  const pendingRequest = requests.find(
    (request) => request.status === 'pending',
  )

  const creatorDashboardReady =
    sellerProfile?.verification_status === 'approved'
  const isBusinessAccount = user?.is_business_account ?? false

  const summaryCards = useMemo(
    () => [
      {
        label: 'Business mode',
        value: isBusinessAccount ? 'Active' : 'Inactive',
        tone: isBusinessAccount ? 'emerald' : 'amber',
      },
      {
        label: 'Seller tier',
        value: formatTier(sellerProfile?.tier || 'unverified'),
        tone: 'blue',
      },
      {
        label: 'Approval status',
        value: formatTier(sellerProfile?.verification_status || 'none'),
        tone: creatorDashboardReady ? 'emerald' : 'slate',
      },
    ],
    [
      creatorDashboardReady,
      sellerProfile?.tier,
      sellerProfile?.verification_status,
      isBusinessAccount,
    ],
  )

  const nextTiers = useMemo(
    () =>
      tiers.filter((tier) => tierOrder.indexOf(tier.tier) > currentTierIndex),
    [currentTierIndex, tiers],
  )

  const activateBusinessMode = async () => {
    setBusyAction('activate')
    setMessage('')

    try {
      const result = await userApi.activateBusinessMode({
        source: 'mobile_seller_hub',
      })

      updateUser({
        user_type: result.user.userType,
        is_business_account: result.user.isBusinessAccount,
        business_mode_activated_at: result.user.businessModeActivatedAt || null,
      })

      setMessage('Business mode is active. Finish seller setup below.')
    } catch (error: any) {
      setMessage(
        error?.response?.data?.error ||
          'Could not activate business mode right now.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const onboardSeller = async () => {
    setBusyAction('onboard')
    setMessage('')

    try {
      const result = await sellerApi.onboard({
        termsAccepted: true,
        source: 'mobile_seller_hub',
      })

      setSellerProfile(result.sellerProfile)
      setMessage('Seller profile ready with protected starter limits.')
    } catch (error: any) {
      setMessage(
        error?.response?.data?.error ||
          'Could not create your seller profile right now.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const requestTier = async (requestedTier: 'basic' | 'trusted' | 'pro') => {
    setBusyAction(requestedTier)
    setMessage('')

    try {
      const result = await sellerApi.requestVerification({
        requestedTier,
        notes: `Requested from mobile seller hub for ${requestedTier} tier.`,
      })

      setRequests((current) => [result.request, ...current])
      setSellerProfile((current) =>
        current
          ? {
              ...current,
              verification_status: 'pending',
            }
          : current,
      )
      setMessage(
        `${formatTier(
          requestedTier,
        )} verification submitted. You can continue selling while it is reviewed.`,
      )
    } catch (error: any) {
      setMessage(
        error?.response?.data?.error ||
          'Could not submit verification request right now.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const openCreatorHub = async () => {
    if (!creatorDashboardReady) {
      Alert.alert(
        'Verification pending',
        'An admin must approve your seller verification before creator tools unlock.',
      )
      return
    }

    try {
      await Linking.openURL('https://techtoolstore.com/creator-dashboard')
    } catch {
      Alert.alert('Unavailable', 'Could not open creator dashboard right now.')
    }
  }

  const loadMoreActivity = async () => {
    if (!activityHasMore || !activityNextCursor || activityLoadingMore) {
      return
    }

    setActivityLoadingMore(true)
    setMessage('')

    try {
      const result = await creatorApi.getDashboardActivity(10, activityNextCursor)

      setActivityFeed((current) => {
        const existingIds = new Set(current.map((item) => item.id))
        const newItems = result.items.filter((item) => !existingIds.has(item.id))
        return [...current, ...newItems]
      })

      setActivityHasMore(result.pagination?.hasMore ?? false)
      setActivityNextCursor(result.pagination?.nextCursor ?? null)
    } catch (error: any) {
      setMessage(
        error?.response?.data?.error ||
          'Could not load more creator activity right now.',
      )
    } finally {
      setActivityLoadingMore(false)
    }
  }

  if (!hasHydrated || isLoading || screenLoading) {
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name='arrow-back' size={18} color={AppColors.white} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.heroEyebrow}>Seller Hub</Text>
          <Text style={styles.heroTitle}>
            Start selling fast with built-in trust and buyer protection.
          </Text>
          <Text style={styles.heroSubtitle}>
            Activate business mode, create your seller profile, and move through
            verification tiers without blocking early growth.
          </Text>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.summaryGrid}>
          {summaryCards.map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text
                style={[
                  styles.summaryValue,
                  card.tone === 'emerald' && styles.summaryValueEmerald,
                  card.tone === 'amber' && styles.summaryValueAmber,
                  card.tone === 'blue' && styles.summaryValueBlue,
                ]}
              >
                {card.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Business mode</Text>
            <Text style={styles.statValue}>
              {user.is_business_account ? 'Active' : 'Customer'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tier</Text>
            <Text style={styles.statValue}>
              {formatTier(sellerProfile?.tier || 'unverified')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Activation flow</Text>
          <Text style={styles.sectionSubtitle}>
            This sequence is designed to stay low-friction for honest sellers
            while preserving platform safety.
          </Text>

          {!user.is_business_account ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={activateBusinessMode}
              disabled={busyAction === 'activate'}
            >
              <Text style={styles.primaryButtonText}>
                {busyAction === 'activate'
                  ? 'Activating...'
                  : 'Activate business mode'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {!sellerProfile ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onboardSeller}
              disabled={!user.is_business_account || busyAction === 'onboard'}
            >
              <Text style={styles.secondaryButtonText}>
                {busyAction === 'onboard'
                  ? 'Preparing...'
                  : 'Create seller profile'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.successText}>
              Seller profile ready with safe listing and price caps.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trust tiers</Text>
          {tiers.map((tier) => {
            const isCurrent = sellerProfile?.tier === tier.tier
            const disabled =
              !sellerProfile || Boolean(pendingRequest) || isCurrent
            const isUpgrade = tierOrder.indexOf(tier.tier) > currentTierIndex

            return (
              <View key={tier.tier} style={styles.tierCard}>
                <View style={styles.tierHeader}>
                  <Text style={styles.tierTitle}>{formatTier(tier.tier)}</Text>
                  {isCurrent ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.tierDescription}>
                  {tier.description ||
                    'Protected marketplace access with progressive trust.'}
                </Text>
                <Text style={styles.tierMeta}>
                  Listings: {tier.max_active_listings} | Max price:{' '}
                  {formatMoney(tier.max_product_price)}
                </Text>

                {isUpgrade ? (
                  <TouchableOpacity
                    style={styles.ghostButton}
                    onPress={() =>
                      requestTier(tier.tier as 'basic' | 'trusted' | 'pro')
                    }
                    disabled={disabled || busyAction === tier.tier}
                  >
                    <Text style={styles.ghostButtonText}>
                      {busyAction === tier.tier
                        ? 'Submitting...'
                        : `Request ${formatTier(tier.tier)}`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Seller snapshot</Text>
          <Text style={styles.snapshotRow}>
            Verification:{' '}
            {formatTier(sellerProfile?.verification_status || 'none')}
          </Text>
          <Text style={styles.snapshotRow}>
            Active listing limit: {sellerProfile?.max_active_listings ?? 0}
          </Text>
          <Text style={styles.snapshotRow}>
            Price cap: {formatMoney(sellerProfile?.max_product_price)}
          </Text>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              !creatorDashboardReady && styles.secondaryButtonDisabled,
            ]}
            onPress={openCreatorHub}
            disabled={!creatorDashboardReady}
          >
            <Text style={styles.secondaryButtonText}>
              {creatorDashboardReady
                ? 'Open creator tools'
                : 'Creator tools locked'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Text style={styles.sectionSubtitle}>
            Real creator activity from the same backend feed as web.
          </Text>
          <View style={styles.activityList}>
            {activityFeed.length > 0 ? (
              activityFeed.map((item) => (
                <View key={item.id} style={styles.activityItem}>
                  <View style={styles.activityDot} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activityDetail}>{item.description}</Text>
                    <Text style={styles.activityTime}>
                      {item.occurredAt
                        ? new Date(item.occurredAt).toLocaleString()
                        : 'Just now'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.sectionSubtitle}>
                Activity appears here after drafts, submissions, and sales.
              </Text>
            )}
          </View>
          {activityHasMore ? (
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={loadMoreActivity}
              disabled={activityLoadingMore}
            >
              <Text style={styles.ghostButtonText}>
                {activityLoadingMore ? 'Loading...' : 'Load more activity'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Verification timeline</Text>
          {requests.length === 0 ? (
            <Text style={styles.sectionSubtitle}>
              No requests yet. Start with Basic when you want higher limits.
            </Text>
          ) : (
            requests.map((request) => (
              <View key={request.id} style={styles.timelineItem}>
                <Text style={styles.timelineTitle}>
                  {formatTier(request.requested_tier)} tier request
                </Text>
                <Text style={styles.timelineMeta}>
                  Status: {request.status}
                </Text>
                <Text style={styles.timelineMeta}>
                  {request.notes || 'Submitted for review.'}
                </Text>
              </View>
            ))
          )}

          {nextTiers.length === 0 && sellerProfile?.tier === 'pro' ? (
            <Text style={styles.successText}>
              You are already on the highest trust tier.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F4EF',
  },
  content: {
    padding: AppSpacing.base,
    paddingBottom: AppSpacing['2xl'],
    gap: AppSpacing.base,
  },
  hero: {
    borderRadius: 28,
    backgroundColor: '#111827',
    padding: AppSpacing.lg,
  },
  backButton: {
    marginBottom: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: AppColors.white,
    fontWeight: '600',
  },
  heroEyebrow: {
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    marginTop: AppSpacing.sm,
    color: AppColors.white,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  heroSubtitle: {
    marginTop: AppSpacing.sm,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 22,
  },
  message: {
    borderRadius: AppBorderRadius.lg,
    backgroundColor: '#FFF7ED',
    color: '#9A3412',
    padding: AppSpacing.md,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: AppSpacing.md,
    marginBottom: AppSpacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: AppColors.white,
    padding: AppSpacing.md,
    ...AppShadows.sm,
  },
  summaryLabel: {
    color: AppColors.gray500,
    fontSize: 12,
  },
  summaryValue: {
    marginTop: 8,
    color: AppColors.gray900,
    fontSize: 18,
    fontWeight: '800',
  },
  summaryValueEmerald: { color: '#047857' },
  summaryValueAmber: { color: '#B45309' },
  summaryValueBlue: { color: '#2563EB' },
  statCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: AppColors.white,
    padding: AppSpacing.md,
    ...AppShadows.sm,
  },
  statLabel: {
    color: AppColors.gray500,
    fontSize: 13,
  },
  statValue: {
    marginTop: 8,
    color: AppColors.gray900,
    fontSize: 22,
    fontWeight: '800',
  },
  card: {
    borderRadius: 24,
    backgroundColor: AppColors.white,
    padding: AppSpacing.lg,
    ...AppShadows.sm,
  },
  sectionTitle: {
    color: AppColors.gray900,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    marginTop: 8,
    color: AppColors.gray500,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: AppSpacing.md,
    borderRadius: 18,
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: AppColors.white,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: AppSpacing.md,
    borderRadius: 18,
    backgroundColor: '#111827',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  secondaryButtonText: {
    color: AppColors.white,
    fontWeight: '700',
  },
  activityList: {
    marginTop: AppSpacing.md,
    gap: AppSpacing.md,
  },
  activityItem: {
    flexDirection: 'row',
    gap: AppSpacing.md,
    alignItems: 'flex-start',
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: AppColors.primary,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontWeight: '700',
    color: AppColors.gray900,
  },
  activityDetail: {
    marginTop: 4,
    color: AppColors.gray500,
    lineHeight: 20,
  },
  activityTime: {
    marginTop: 6,
    color: AppColors.gray500,
    fontSize: 12,
    fontWeight: '600',
  },
  successText: {
    marginTop: AppSpacing.md,
    color: '#047857',
    fontWeight: '600',
    lineHeight: 20,
  },
  tierCard: {
    marginTop: AppSpacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: AppSpacing.md,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierTitle: {
    color: AppColors.gray900,
    fontSize: 18,
    fontWeight: '800',
  },
  currentBadge: {
    borderRadius: 999,
    backgroundColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentBadgeText: {
    color: '#9A3412',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tierDescription: {
    marginTop: 8,
    color: AppColors.gray500,
    lineHeight: 20,
  },
  tierMeta: {
    marginTop: 10,
    color: AppColors.gray700,
    fontWeight: '600',
  },
  ghostButton: {
    marginTop: AppSpacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: AppColors.gray900,
    fontWeight: '700',
  },
  snapshotRow: {
    marginTop: 10,
    color: AppColors.gray700,
    fontWeight: '600',
  },
  timelineItem: {
    marginTop: AppSpacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: AppSpacing.md,
  },
  timelineTitle: {
    color: AppColors.gray900,
    fontWeight: '700',
  },
  timelineMeta: {
    marginTop: 6,
    color: AppColors.gray500,
  },
})
