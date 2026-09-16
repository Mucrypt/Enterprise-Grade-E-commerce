// ============================================
// TechTools Mobile App - Public Seller Profile Screen
// ============================================
// Direct mobile port of the web storefront's SellerProfilePage.tsx --
// real follower count, real approved-post count, a working Follow
// button (optimistic with rollback, same pattern as the web version).
// Thumbnails navigate to the general Discover tab rather than a
// fabricated per-post deep link, since no such route exists on either
// platform yet -- the honest v1 behavior, not an invented shortcut.

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { sellerApi, discoverApi, type PublicSellerProfile, type DiscoverPost } from '@/api'
import { useAuthStore } from '@/stores'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'

export default function SellerProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [profile, setProfile] = useState<PublicSellerProfile | null>(null)
  const [posts, setPosts] = useState<DiscoverPost[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!handle) return

      setLoading(true)
      setNotFound(false)
      try {
        const data = await sellerApi.getPublicProfile(handle)
        if (cancelled) return
        setProfile(data)
        setIsFollowing(data.isFollowing)
        setFollowerCount(data.followerCount)

        const feed = await discoverApi.getFeed(1, 20, data.id).catch(() => ({ posts: [] as DiscoverPost[] }))
        if (!cancelled) setPosts(feed.posts)
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [handle])

  const handleToggleFollow = async () => {
    if (!profile) return
    if (!isAuthenticated) {
      router.push('/(auth)/login' as never)
      return
    }

    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1))
    setFollowBusy(true)
    try {
      if (wasFollowing) await sellerApi.unfollow(profile.id)
      else await sellerApi.follow(profile.id)
    } catch {
      setIsFollowing(wasFollowing)
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1))
    } finally {
      setFollowBusy(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="film-outline" size={40} color={AppColors.gray300} />
        <Text style={styles.notFoundTitle}>Seller not found</Text>
        <Text style={styles.notFoundSubtitle}>This seller profile doesn&apos;t exist or isn&apos;t public yet.</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={AppColors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          @{profile.handle}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={
          <View style={styles.profileSection}>
            <View style={styles.avatarWrap}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>
                    {(profile.display_name || profile.handle).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.displayName}>{profile.display_name || `@${profile.handle}`}</Text>
            <Text style={styles.handleText}>@{profile.handle}</Text>
            {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{profile.postCount}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleToggleFollow}
              disabled={followBusy}
              style={[styles.followButton, isFollowing && styles.followingButton]}
            >
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const thumbnail =
            item.media_type === 'video' ? item.video_poster_url : item.images?.[0]?.image_url
          return (
            <TouchableOpacity style={styles.gridTile} onPress={() => router.push('/(tabs)/discover' as never)}>
              {thumbnail ? (
                <Image source={{ uri: thumbnail }} style={styles.gridImage} />
              ) : (
                <View style={[styles.gridImage, styles.gridPlaceholder]}>
                  <Ionicons
                    name={item.media_type === 'video' ? 'videocam-outline' : 'image-outline'}
                    size={20}
                    color={AppColors.gray400}
                  />
                </View>
              )}
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="film-outline" size={32} color={AppColors.gray300} />
            <Text style={styles.emptyText}>No posts yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.white,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    paddingHorizontal: AppSpacing.xl,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  notFoundSubtitle: {
    fontSize: 13,
    color: AppColors.gray500,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
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
    flex: 1,
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: AppSpacing.xl,
    paddingHorizontal: AppSpacing.base,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  avatarWrap: {
    marginBottom: AppSpacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: AppBorderRadius.full,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '800',
    color: AppColors.white,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  handleText: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: 2,
  },
  bio: {
    fontSize: 13,
    color: AppColors.gray700,
    textAlign: 'center',
    marginTop: AppSpacing.sm,
    paddingHorizontal: AppSpacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: AppSpacing['2xl'],
    marginTop: AppSpacing.lg,
  },
  statBlock: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  statLabel: {
    fontSize: 11,
    color: AppColors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followButton: {
    marginTop: AppSpacing.lg,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing['2xl'],
    paddingVertical: AppSpacing.sm + 2,
  },
  followingButton: {
    backgroundColor: AppColors.gray100,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.white,
  },
  followingButtonText: {
    color: AppColors.gray900,
  },
  gridTile: {
    flex: 1 / 3,
    aspectRatio: 9 / 16,
    margin: 1,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholder: {
    backgroundColor: AppColors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: AppSpacing['4xl'],
    gap: AppSpacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: AppColors.gray400,
  },
})
