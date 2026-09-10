// ============================================
// Home Header
//
// Sticky top bar for the home screen (rendered above the ScrollView in
// (tabs)/index.tsx, so it never scrolls away). Modeled on the reference
// mobile layout the founder shared: a compact icon on the left, a large
// pill search field taking most of the width, and a wishlist icon with a
// count badge on the right.
//
// Deliberately only ONE left-side icon (a real notifications bell), not
// two -- the reference screenshot's second icon is a gamified
// promotions/check-in calendar feature that has no TechTools equivalent,
// and this codebase never ships a button with no real feature behind it
// (see also: no camera/visual-search icon, matching this same rule).
// There is also no fabricated badge count: the notifications badge only
// renders for a signed-in user, using the real unreadCount field from
// notificationsApi.getAll(), and only fetches at all when authenticated
// (the notifications endpoint requires auth and would otherwise just log
// a 401 for every signed-out visitor on every home-screen mount).
// ============================================

import React, { useEffect, useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppShadows } from '@/constants/appTheme'
import { notificationsApi } from '@/api'
import { useAuthStore, useWishlistStore } from '@/stores'
import SearchBar from '@/components/SearchBar'

export default function HomeHeader() {
  const router = useRouter()
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const wishlistCount = useWishlistStore((state) => state.items.length)
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
          size={22}
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

      <View style={styles.searchWrap}>
        <SearchBar placeholder='Search tools, brands, categories...' />
      </View>

      <TouchableOpacity
        style={styles.iconButton}
        activeOpacity={0.8}
        onPress={() => router.push('/wishlist' as never)}
      >
        <Ionicons name='heart-outline' size={22} color={AppColors.gray800} />
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
    gap: AppSpacing.sm,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.background,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...AppShadows.sm,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: AppColors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: AppColors.background,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.white,
  },
  searchWrap: {
    flex: 1,
  },
})
