// ============================================
// Home Header
//
// Sticky top bar for the home screen (rendered above the ScrollView in
// (tabs)/index.tsx, so it never scrolls away). Modeled on the reference
// mobile layout the founder shared: two compact icons on the left, a
// pill search field taking most of the width, and a wishlist icon with
// a count badge on the right.
//
// The two left icons are both real, working features -- notifications
// (real unreadCount from notificationsApi.getAll(), signed-in users
// only) and Recently Viewed (real on-device browsing history recorded
// from product/[slug].tsx, see recentlyViewedStore.ts). The reference
// screenshot's second icon is a gamified promotions/check-in calendar
// with no TechTools equivalent -- Recently Viewed replaces it with a
// genuinely useful real feature instead, rather than copying it as a
// dead button (same rule that keeps a camera/visual-search icon out of
// this header: never ship a button with no real feature behind it).
// ============================================

import React, { useEffect, useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppShadows } from '@/constants/appTheme'
import { notificationsApi } from '@/api'
import { useAuthStore, useWishlistStore, useRecentlyViewedStore } from '@/stores'
import SearchBar from '@/components/SearchBar'

export default function HomeHeader() {
  const router = useRouter()
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const wishlistCount = useWishlistStore((state) => state.items.length)
  const recentlyViewedCount = useRecentlyViewedStore(
    (state) => state.items.length,
  )
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) {
      setUnreadCount(0)
      return
    }

    let cancelled = false
    notificationsApi
      .getAll({ limit: 1 })
      .then((data) => {
        if (!cancelled) setUnreadCount(data.unreadCount)
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0)
      })

    return () => {
      cancelled = true
    }
  }, [hasHydrated, isAuthenticated])

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconButton}
        activeOpacity={0.8}
        onPress={() => router.push('/profile/notifications' as never)}
      >
        <Ionicons
          name='notifications-outline'
          size={19}
          color={AppColors.gray800}
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        activeOpacity={0.8}
        onPress={() => router.push('/recently-viewed' as never)}
      >
        <Ionicons name='time-outline' size={19} color={AppColors.gray800} />
        {recentlyViewedCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {recentlyViewedCount > 9 ? '9+' : recentlyViewedCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.searchWrap}>
        <SearchBar
          placeholder='Search tools, brands...'
          compact
          showSubmitButton
        />
      </View>

      <TouchableOpacity
        style={styles.iconButton}
        activeOpacity={0.8}
        onPress={() => router.push('/wishlist' as never)}
      >
        <Ionicons name='heart-outline' size={19} color={AppColors.gray800} />
        {wishlistCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {wishlistCount > 9 ? '9+' : wishlistCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.xs,
    backgroundColor: AppColors.background,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...AppShadows.sm,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: AppColors.error,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: AppColors.background,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: AppColors.white,
  },
  searchWrap: {
    flex: 1,
    marginHorizontal: AppSpacing.xs,
  },
})
