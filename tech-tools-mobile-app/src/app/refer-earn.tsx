// ============================================
// Refer & Earn -- affiliate self-serve dashboard (mobile)
// ============================================
// Mirrors e-commerce-web-store's src/pages/ReferAndEarnPage.tsx: live
// stats fetched from the same /affiliates/* endpoints, the real referral
// link, native share (React Native's Share sheet is this app's equivalent
// of the web's copy/WhatsApp/X buttons -- one tap reaches every installed
// app, including WhatsApp/SMS/email, so no separate per-channel buttons
// are needed here), and a "recent referrals" list showing zero PII of the
// referred buyer -- relative date, status, and commission amount only,
// exactly like the web version and the backend response itself already
// enforces.
// ============================================

import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import {
  affiliatesApi,
  getApiErrorContext,
  type AffiliateStats,
} from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { formatPrice, formatRelativeTime } from '@/utils'
import { useAuthStore } from '@/stores'

const STORE_URL = 'https://techtoolstore.com'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  paid: 'Paid',
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#B45309',
  confirmed: '#047857',
  cancelled: AppColors.gray500,
  paid: '#047857',
}

export default function ReferAndEarnScreen() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, hasHydrated } = useAuthStore()

  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadStats = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)
      const data = await affiliatesApi.getMyStats()
      setStats(data)
    } catch (error) {
      const err = getApiErrorContext(error, 'Please try again in a moment.')
      if (err.isAuthError) {
        router.replace('/(auth)/login')
        return
      }
      Alert.alert('Unable to load your referral stats', err.message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
      return
    }
    if (!hasHydrated || !isAuthenticated) return
    loadStats()
  }, [authLoading, hasHydrated, isAuthenticated, loadStats, router])

  const referralLink = stats
    ? `${STORE_URL}/?ref=${stats.referralCode}`
    : null

  const handleShare = async () => {
    if (!referralLink) return
    try {
      await Share.share({
        message: `Shop TechTools and I'll earn a little back on your order -- use my link: ${referralLink}`,
        url: referralLink,
      })
    } catch (error) {
      console.error('Error sharing referral link:', error)
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
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name='arrow-back' size={20} color={AppColors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadStats(true)}
            tintColor={AppColors.primary}
          />
        }
      >
        {stats && (
          <>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalClicks}</Text>
                <Text style={styles.statLabel}>Link clicks</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.confirmedCount}</Text>
                <Text style={styles.statLabel}>Confirmed orders</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, styles.statValueMuted]}>
                  {formatPrice(stats.pendingEarnings)}
                </Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, styles.statValueSuccess]}>
                  {formatPrice(stats.storeCreditBalance)}
                </Text>
                <Text style={styles.statLabel}>Store credit balance</Text>
              </View>
            </View>

            {/* Referral link card */}
            <View style={styles.linkCard}>
              <Text style={styles.linkCardTitle}>Your referral link</Text>
              <Text style={styles.linkCardDescription}>
                Share it anywhere -- when someone buys through your link, you
                earn store credit once their order is confirmed.
              </Text>
              <View style={styles.linkBox}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {referralLink}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                activeOpacity={0.85}
              >
                <Ionicons name='share-social-outline' size={18} color={AppColors.white} />
                <Text style={styles.shareButtonText}>Share your link</Text>
              </TouchableOpacity>
            </View>

            {/* Recent referrals -- zero PII of the referred buyer, matches
                the backend response shape exactly. */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent referrals</Text>
              {stats.recentReferrals.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name='people-outline' size={36} color={AppColors.gray400} />
                  <Text style={styles.emptyTitle}>No referrals yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Share your link above to start earning.
                  </Text>
                </View>
              ) : (
                stats.recentReferrals.map((referral) => (
                  <View key={referral.id} style={styles.referralRow}>
                    <View style={styles.referralRowLeft}>
                      <Text style={styles.referralOrderValue}>
                        Order {formatPrice(referral.orderValue)}
                      </Text>
                      <Text style={styles.referralDate}>
                        {formatRelativeTime(referral.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.referralRowRight}>
                      <Text style={styles.referralCommission}>
                        +{formatPrice(referral.commissionAmount)}
                      </Text>
                      <Text
                        style={[
                          styles.referralStatus,
                          { color: STATUS_COLOR[referral.status] || AppColors.gray500 },
                        ]}
                      >
                        {STATUS_LABEL[referral.status] || referral.status}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
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
  scrollContent: {
    padding: AppSpacing.base,
    paddingBottom: 120,
    gap: AppSpacing.base,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  statValueMuted: {
    color: AppColors.gray600,
  },
  statValueSuccess: {
    color: '#047857',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: AppColors.gray500,
  },
  linkCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  linkCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  linkCardDescription: {
    marginTop: 4,
    fontSize: 13,
    color: AppColors.gray500,
    lineHeight: 18,
  },
  linkBox: {
    marginTop: AppSpacing.md,
    backgroundColor: AppColors.gray100,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: AppSpacing.md,
  },
  linkText: {
    fontSize: 13,
    color: AppColors.gray700,
  },
  shareButton: {
    marginTop: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.xs,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.md,
  },
  shareButtonText: {
    color: AppColors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: AppSpacing.sm,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: AppSpacing.xl,
  },
  emptyTitle: {
    marginTop: AppSpacing.sm,
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.gray700,
  },
  emptySubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: AppColors.gray500,
    textAlign: 'center',
  },
  referralRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: AppSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  referralRowLeft: {},
  referralOrderValue: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray800,
  },
  referralDate: {
    marginTop: 2,
    fontSize: 11,
    color: AppColors.gray500,
  },
  referralRowRight: {
    alignItems: 'flex-end',
  },
  referralCommission: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  referralStatus: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
})
