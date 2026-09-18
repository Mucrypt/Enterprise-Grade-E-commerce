// ============================================
// TechTools Mobile App - Seller Performance Screen
// ============================================
// Mobile port of the web Creator Dashboard's Performance tab. Every
// DiscoverPost already carries real per-post engagement counters
// (view/like/save/share/add_to_cart/purchase) that had zero UI surface
// on mobile before this screen -- this aggregates them into a real
// "what's working" view, built entirely from data already being fetched
// elsewhere, not a new backend metric.

import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { discoverApi, type DiscoverPost } from '@/api'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'

const STAT_ICONS: {
  key: keyof Pick<
    DiscoverPost,
    'view_count' | 'like_count' | 'save_count' | 'share_count' | 'add_to_cart_count' | 'purchase_count'
  >
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
}[] = [
  { key: 'view_count', label: 'Views', icon: 'eye-outline', color: AppColors.gray500 },
  { key: 'like_count', label: 'Likes', icon: 'heart-outline', color: '#EF4444' },
  { key: 'save_count', label: 'Saves', icon: 'bookmark-outline', color: '#3B82F6' },
  { key: 'share_count', label: 'Shares', icon: 'share-social-outline', color: '#8B5CF6' },
  { key: 'add_to_cart_count', label: 'Adds to cart', icon: 'cart-outline', color: AppColors.primary },
  { key: 'purchase_count', label: 'Purchases', icon: 'bag-check-outline', color: '#047857' },
]

export default function SellerPerformanceScreen() {
  const router = useRouter()
  const [posts, setPosts] = useState<DiscoverPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    discoverApi
      .getMine()
      .then((data) => {
        if (!cancelled) setPosts(data)
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={AppColors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={AppColors.primary} style={{ marginTop: AppSpacing.xl }} />
        ) : posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trending-up-outline" size={32} color={AppColors.gray300} />
            <Text style={styles.emptyText}>
              Post to Discover to start seeing real performance data here.
            </Text>
          </View>
        ) : (
          <PerformanceContent posts={posts} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function PerformanceContent({ posts }: { posts: DiscoverPost[] }) {
  const totals = STAT_ICONS.reduce(
    (acc, stat) => {
      acc[stat.key] = posts.reduce((sum, post) => sum + post[stat.key], 0)
      return acc
    },
    {} as Record<(typeof STAT_ICONS)[number]['key'], number>,
  )
  const conversionRate = totals.view_count > 0 ? (totals.purchase_count / totals.view_count) * 100 : 0
  const ranked = [...posts].sort((a, b) => b.view_count - a.view_count)

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Discover performance</Text>
        <Text style={styles.cardSubtitle}>
          Real engagement totals across all {posts.length} of your Discover posts.
        </Text>

        <View style={styles.statsGrid}>
          {STAT_ICONS.map((stat) => (
            <View key={stat.key} style={styles.statTile}>
              <Ionicons name={stat.icon} size={16} color={stat.color} />
              <Text style={styles.statValue}>{totals[stat.key]}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.conversionText}>
          {conversionRate > 0
            ? `${conversionRate.toFixed(2)}% of views led to a purchase -- a ratio, not a guarantee.`
            : 'No purchases from Discover views yet.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What&apos;s working</Text>
        <Text style={styles.cardSubtitle}>Your own posts, ranked by real views.</Text>

        <View style={{ marginTop: AppSpacing.md, gap: AppSpacing.sm }}>
          {ranked.map((post, index) => (
            <View key={post.id} style={styles.postRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.postCaption} numberOfLines={1}>
                  {post.caption || 'No caption'}
                </Text>
                <Text style={styles.postMeta}>{post.media_type} post</Text>
              </View>
              <View style={styles.postStats}>
                <Text style={styles.postStatText}>
                  <Ionicons name="eye-outline" size={12} /> {post.view_count}
                </Text>
                <Text style={styles.postStatTextEmphasis}>{post.purchase_count} bought</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  scrollContent: {
    padding: AppSpacing.base,
    gap: AppSpacing.base,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: AppSpacing['3xl'],
    gap: AppSpacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: AppColors.gray500,
    textAlign: 'center',
    paddingHorizontal: AppSpacing.xl,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
    marginBottom: AppSpacing.base,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  cardSubtitle: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
    marginTop: AppSpacing.md,
  },
  statTile: {
    width: '31%',
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    padding: AppSpacing.sm,
  },
  statValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  statLabel: {
    fontSize: 10,
    color: AppColors.gray500,
  },
  conversionText: {
    marginTop: AppSpacing.md,
    fontSize: 12,
    color: AppColors.gray500,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    padding: AppSpacing.sm,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: AppColors.gray900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: AppColors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  postCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  postMeta: {
    fontSize: 11,
    color: AppColors.gray500,
    textTransform: 'capitalize',
  },
  postStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  postStatText: {
    fontSize: 11,
    color: AppColors.gray500,
  },
  postStatTextEmphasis: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
})
