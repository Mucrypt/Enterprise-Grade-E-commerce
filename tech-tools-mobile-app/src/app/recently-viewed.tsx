// ============================================
// TechTools Mobile App - Recently Viewed Screen
// ============================================
// Real, on-device browsing history -- every product here was genuinely
// opened by this user (recorded from product/[slug].tsx), grouped into
// real Today/Yesterday/This Week/Earlier sections by each entry's real
// viewedAt timestamp. Never a fabricated "you might like" substitute --
// an empty history shows an honest empty state, not a fallback list.
// ============================================

import React, { useMemo } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '@/components'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
} from '@/constants/appTheme'
import {
  useRecentlyViewedStore,
  RecentlyViewedEntry,
} from '@/stores/recentlyViewedStore'
import {
  formatPrice,
  calculateDiscount,
  getProductImage,
  formatRelativeTime,
} from '@/utils'

const DAY_MS = 24 * 60 * 60 * 1000

function sectionFor(viewedAt: number, now: number): string {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = startOfToday.getTime() - DAY_MS
  const startOfWeek = startOfToday.getTime() - 6 * DAY_MS

  if (viewedAt >= startOfToday.getTime()) return 'Today'
  if (viewedAt >= startOfYesterday) return 'Yesterday'
  if (viewedAt >= startOfWeek) return 'This Week'
  return 'Earlier'
}

function groupBySection(items: RecentlyViewedEntry[]) {
  const now = Date.now()
  const order = ['Today', 'Yesterday', 'This Week', 'Earlier']
  const buckets = new Map<string, RecentlyViewedEntry[]>()

  for (const entry of items) {
    const key = sectionFor(entry.viewedAt, now)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(entry)
  }

  return order
    .filter((key) => buckets.has(key))
    .map((key) => ({ title: key, data: buckets.get(key)! }))
}

function RecentlyViewedRow({ entry }: { entry: RecentlyViewedEntry }) {
  const router = useRouter()
  const removeItem = useRecentlyViewedStore((state) => state.removeItem)
  const { product, viewedAt } = entry

  const basePrice = Number(product.base_price)
  const salePrice = product.sale_price ? Number(product.sale_price) : null
  const hasDiscount = salePrice !== null && salePrice < basePrice
  const discountPercent = hasDiscount
    ? calculateDiscount(basePrice, salePrice!)
    : 0

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.85}
      onPress={() => router.push(`/product/${product.slug}` as never)}
    >
      <View style={styles.rowImageWrap}>
        <Image
          source={{ uri: getProductImage(product) }}
          style={styles.rowImage}
          resizeMode='cover'
        />
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPercent}%</Text>
          </View>
        )}
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowCategory} numberOfLines={1}>
          {product.category_name}
        </Text>
        <Text style={styles.rowName} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.rowPriceRow}>
          <Text style={styles.rowPrice}>
            {formatPrice(salePrice ?? basePrice)}
          </Text>
          {hasDiscount && (
            <Text style={styles.rowOriginalPrice}>
              {formatPrice(basePrice)}
            </Text>
          )}
        </View>

        <View style={styles.rowFooter}>
          <Ionicons name='time-outline' size={12} color={AppColors.gray400} />
          <Text style={styles.rowViewedAt}>
            Viewed {formatRelativeTime(new Date(viewedAt).toISOString())}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeItem(product.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name='close' size={16} color={AppColors.gray400} />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default function RecentlyViewedScreen() {
  const router = useRouter()
  const { items, clearAll } = useRecentlyViewedStore()

  const sections = useMemo(() => groupBySection(items), [items])

  const handleClearAll = () => {
    Alert.alert(
      'Clear Recently Viewed',
      'Remove all items from your browsing history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearAll },
      ],
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Recently Viewed',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name='arrow-back' size={24} color={AppColors.gray900} />
            </TouchableOpacity>
          ),
          headerRight: () =>
            items.length > 0 ? (
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearButton}>Clear All</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name='time-outline'
                size={56}
                color={AppColors.gray300}
              />
            </View>
            <Text style={styles.emptyTitle}>No browsing history yet</Text>
            <Text style={styles.emptyText}>
              Products you open will show up here, grouped by when you viewed
              them, so you can pick up right where you left off.
            </Text>
            <Button
              title='Start Exploring'
              onPress={() => router.push('/(tabs)/explore')}
              icon='compass-outline'
            />
          </View>
        ) : (
          <>
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>
                {items.length} product{items.length === 1 ? '' : 's'} viewed
              </Text>
            </View>
            <SectionList
              sections={sections}
              keyExtractor={(entry) => entry.product.id}
              renderItem={({ item }) => <RecentlyViewedRow entry={item} />}
              renderSectionHeader={({ section: { title } }) => (
                <Text style={styles.sectionHeader}>{title}</Text>
              )}
              contentContainerStyle={styles.listContent}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.error,
  },
  statsBar: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  statsText: {
    fontSize: 13,
    color: AppColors.gray500,
  },
  listContent: {
    padding: AppSpacing.base,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: AppColors.gray500,
    marginTop: AppSpacing.md,
    marginBottom: AppSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.sm,
    marginBottom: AppSpacing.sm,
    ...AppShadows.sm,
  },
  rowImageWrap: {
    width: 72,
    height: 72,
    borderRadius: AppBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: AppColors.gray100,
    position: 'relative',
  },
  rowImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: AppColors.error,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: AppBorderRadius.sm,
  },
  discountText: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.white,
  },
  rowContent: {
    flex: 1,
    marginLeft: AppSpacing.md,
    gap: 2,
  },
  rowCategory: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: AppColors.gray400,
  },
  rowName: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray800,
    lineHeight: 17,
  },
  rowPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
    marginTop: 2,
  },
  rowPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.primary,
  },
  rowOriginalPrice: {
    fontSize: 11,
    color: AppColors.gray400,
    textDecorationLine: 'line-through',
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  rowViewedAt: {
    fontSize: 11,
    color: AppColors.gray400,
  },
  removeButton: {
    padding: AppSpacing.xs,
    marginLeft: AppSpacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.xl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AppColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.gray800,
    marginBottom: AppSpacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.gray500,
    textAlign: 'center',
    marginBottom: AppSpacing.xl,
    lineHeight: 20,
  },
})
