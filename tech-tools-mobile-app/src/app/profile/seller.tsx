import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import {
  creatorApi,
  sellerAnnouncementsApi,
  sellerApi,
  userApi,
  type PublicSellerProfile,
  type SellerAnnouncement,
} from '@/api'
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
import { SELLER_TIER_ORDER as tierOrder, formatTier, getTierStyle } from '@/utils/sellerTier'

const formatMoney = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') {
    return 'Custom'
  }

  return `$${Number(value).toFixed(2)}`
}

// Broadcast announcements from admin -- real per-seller read tracking,
// marked read the moment a seller expands one, matching the web store's
// SellerAnnouncementsBanner behavior exactly.
function AnnouncementsBanner() {
  const [announcements, setAnnouncements] = useState<SellerAnnouncement[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    sellerAnnouncementsApi
      .list()
      .then((items) => {
        if (!cancelled) setAnnouncements(items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (announcements.length === 0) return null

  const handleExpand = (announcement: SellerAnnouncement) => {
    setExpandedId((current) => (current === announcement.id ? null : announcement.id))
    if (!announcement.isRead) {
      setAnnouncements((current) =>
        current.map((item) => (item.id === announcement.id ? { ...item, isRead: true } : item)),
      )
      sellerAnnouncementsApi.markRead(announcement.id).catch(() => {})
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Announcements</Text>
      <View style={{ marginTop: AppSpacing.sm, gap: AppSpacing.sm }}>
        {announcements.map((announcement) => (
          <TouchableOpacity
            key={announcement.id}
            onPress={() => handleExpand(announcement)}
            style={styles.announcementRow}
          >
            <View style={styles.announcementHeader}>
              {!announcement.isRead && <View style={styles.announcementDot} />}
              <Text style={announcement.isRead ? styles.announcementSubjectRead : styles.announcementSubject}>
                {announcement.subject}
              </Text>
              <Text style={styles.announcementDate}>
                {new Date(announcement.created_at).toLocaleDateString()}
              </Text>
            </View>
            {expandedId === announcement.id && (
              <Text style={styles.announcementBody}>{announcement.body}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

export default function SellerHubScreen() {
  const router = useRouter()
  const { user, isAuthenticated, hasHydrated, isLoading, updateUser } =
    useAuthStore()
  const [screenLoading, setScreenLoading] = useState(true)
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
  const [publicProfile, setPublicProfile] = useState<PublicSellerProfile | null>(null)
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

  useEffect(() => {
    const handle = sellerProfile?.handle
    if (!handle) return
    let cancelled = false
    sellerApi
      .getPublicProfile(handle)
      .then((data) => {
        if (!cancelled) setPublicProfile(data)
      })
      .catch(() => {
        if (!cancelled) setPublicProfile(null)
      })
    return () => {
      cancelled = true
    }
  }, [sellerProfile?.handle])

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

  // Self-healing: verification_status is fetched fresh every load, but
  // the store's is_business_account is cached at login and only updates
  // via an explicit client action -- an admin approving a seller
  // server-side (grant/tier-change/creator-access all flip it true) has
  // no way to reach an already-logged-in session. Sync it the moment we
  // see the mismatch so the "Business mode" tile stops showing stale
  // "Inactive" once verification is really approved.
  useEffect(() => {
    if (creatorDashboardReady && !isBusinessAccount) {
      updateUser({ is_business_account: true })
    }
  }, [creatorDashboardReady, isBusinessAccount, updateUser])

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    } catch (error: any) {
      setMessage(
        error?.response?.data?.error ||
          'Could not submit verification request right now.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const loadMoreActivity = async () => {
    if (!activityHasMore || !activityNextCursor || activityLoadingMore) {
      return
    }

    setActivityLoadingMore(true)
    setMessage('')

    try {
      const result = await creatorApi.getDashboardActivity(
        10,
        activityNextCursor,
      )

      setActivityFeed((current) => {
        const existingIds = new Set(current.map((item) => item.id))
        const newItems = result.items.filter(
          (item) => !existingIds.has(item.id),
        )
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonRow}>
          <Ionicons name='arrow-back' size={18} color={AppColors.gray700} />
          <Text style={styles.backButtonRowText}>Back</Text>
        </TouchableOpacity>

        {(() => {
          const tierStyle = getTierStyle(sellerProfile?.tier || 'unverified')
          const displayName =
            sellerProfile?.display_name ||
            `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
            user.email
          return (
            <LinearGradient
              colors={tierStyle.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.identityRow}>
                <View style={styles.avatar}>
                  {publicProfile?.avatar_url ? (
                    <Image source={{ uri: publicProfile.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.identityNameRow}>
                    <Text style={styles.identityName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <View style={styles.tierPill}>
                      <Text style={styles.tierPillText}>{formatTier(sellerProfile?.tier || 'unverified')}</Text>
                    </View>
                  </View>
                  <Text style={styles.identityHandle}>
                    {sellerProfile?.handle ? `@${sellerProfile.handle}` : 'Finish setup to claim a handle'}
                  </Text>
                </View>
              </View>

              {publicProfile ? (
                <View style={styles.identityStatsRow}>
                  <View style={styles.identityStat}>
                    <Text style={styles.identityStatValue}>{publicProfile.followerCount}</Text>
                    <Text style={styles.identityStatLabel}>Followers</Text>
                  </View>
                  <View style={styles.identityStatDivider} />
                  <View style={styles.identityStat}>
                    <Text style={styles.identityStatValue}>{publicProfile.postCount}</Text>
                    <Text style={styles.identityStatLabel}>Posts</Text>
                  </View>
                </View>
              ) : null}
            </LinearGradient>
          )
        })()}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <AnnouncementsBanner />

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

        {creatorDashboardReady && (
          <View style={styles.hubActionsRow}>
            <TouchableOpacity
              style={[styles.manageProductsButton, styles.hubActionButton]}
              onPress={() => router.push('/profile/seller-products' as never)}
            >
              <Ionicons name="storefront-outline" size={16} color={AppColors.white} />
              <Text style={styles.manageProductsButtonText}>Products</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.manageProductsButton, styles.hubActionButton, styles.earningsButton]}
              onPress={() => router.push('/profile/seller-earnings' as never)}
            >
              <Ionicons name="wallet-outline" size={16} color={AppColors.white} />
              <Text style={styles.manageProductsButtonText}>Earnings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.manageProductsButton, styles.hubActionButton, styles.performanceButton]}
              onPress={() => router.push('/profile/seller-performance' as never)}
            >
              <Ionicons name="trending-up-outline" size={16} color={AppColors.white} />
              <Text style={styles.manageProductsButtonText}>Performance</Text>
            </TouchableOpacity>
          </View>
        )}

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
          {!creatorDashboardReady ? (
            <Text style={styles.snapshotHint}>
              Manage Products, Earnings, and Performance unlock once an admin approves your
              verification.
            </Text>
          ) : null}
          {sellerProfile ? (
            <TouchableOpacity
              style={styles.contactSupportButton}
              onPress={() => router.push('/profile/seller-support' as never)}
            >
              <Ionicons name='chatbubble-ellipses-outline' size={16} color={AppColors.gray900} />
              <Text style={styles.contactSupportButtonText}>Contact support</Text>
            </TouchableOpacity>
          ) : null}
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
                    <Text style={styles.activityDetail}>
                      {item.description}
                    </Text>
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
  backButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonRowText: {
    color: AppColors.gray700,
    fontWeight: '600',
  },
  hero: {
    borderRadius: 28,
    padding: AppSpacing.lg,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: AppColors.white,
    fontSize: 22,
    fontWeight: '800',
  },
  identityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  identityName: {
    color: AppColors.white,
    fontSize: 18,
    fontWeight: '800',
    flexShrink: 1,
  },
  tierPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tierPillText: {
    color: AppColors.white,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  identityHandle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  identityStatsRow: {
    marginTop: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: AppSpacing.md,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
  },
  identityStat: {
    alignItems: 'center',
  },
  identityStatValue: {
    color: AppColors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  identityStatLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  identityStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  message: {
    borderRadius: AppBorderRadius.lg,
    backgroundColor: '#FFF7ED',
    color: '#9A3412',
    padding: AppSpacing.md,
    lineHeight: 20,
  },
  hubActionsRow: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
    marginBottom: AppSpacing.md,
  },
  hubActionButton: {
    flex: 1,
    marginBottom: 0,
  },
  manageProductsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.sm + 4,
    marginBottom: AppSpacing.md,
  },
  earningsButton: {
    backgroundColor: AppColors.gray900,
  },
  performanceButton: {
    backgroundColor: AppColors.secondary,
  },
  manageProductsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.white,
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
  announcementRow: {
    borderRadius: 16,
    backgroundColor: AppColors.gray50,
    padding: AppSpacing.md,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  announcementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.primary,
  },
  announcementSubject: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  announcementSubjectRead: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  announcementDate: {
    fontSize: 11,
    color: AppColors.gray400,
  },
  announcementBody: {
    marginTop: AppSpacing.sm,
    fontSize: 13,
    color: AppColors.gray600,
    lineHeight: 19,
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
  snapshotHint: {
    marginTop: AppSpacing.md,
    color: AppColors.gray500,
    fontSize: 13,
    lineHeight: 19,
  },
  contactSupportButton: {
    marginTop: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 12,
  },
  contactSupportButtonText: {
    color: AppColors.gray900,
    fontWeight: '700',
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
