// ============================================
// TechTools Mobile App - Discover Feed Slide
// ============================================
// Video autoplays muted (shouldPlay bound to viewability, driven by the
// parent screen's FlatList onViewableItemsChanged) when this slide is the
// active one, tap toggles sound. `expo-av`'s Video is already installed
// and already used this exact way on the product detail screen
// (product/[slug].tsx). Like/save are real, server-synced, optimistic
// with rollback on failure -- same pattern established for brand-follow
// this session. A guest tapping like/save is sent to log in, since these
// are account-tied actions (not a local-first concept like the cart).

import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Share,
} from 'react-native'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import type { DiscoverPost } from '@/api'
import { discoverApi } from '@/api'
import { useAuthStore, useCartStore } from '@/stores'
import { getEventTracker } from '@/services/event-tracking'
import { formatPrice, getProductImage } from '@/utils'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface DiscoverSlideProps {
  post: DiscoverPost
  height: number
  isActive: boolean
  onOpenProduct: (productId?: string) => void
}

export default function DiscoverSlide({ post, height, isActive, onOpenProduct }: DiscoverSlideProps) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const addItem = useCartStore((s) => s.addItem)
  const videoRef = useRef<Video>(null)

  const [muted, setMuted] = useState(true)
  const [imageIndex, setImageIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [isSaved, setIsSaved] = useState(post.isSaved)
  const [saveCount, setSaveCount] = useState(post.save_count)
  const watchedComplete = useRef(false)

  const products = post.products || []
  const primaryProduct = products[0]

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isActive) {
      video.setPositionAsync(0)
      video.playAsync().catch(() => {})
      getEventTracker().trackDiscoverEvent('discover_view', post.id)
    } else {
      video.pauseAsync().catch(() => {})
    }
  }, [isActive, post.id])

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded || !status.didJustFinish) return
    if (!watchedComplete.current) {
      watchedComplete.current = true
      getEventTracker().trackDiscoverEvent('discover_watch_complete', post.id)
    } else {
      getEventTracker().trackDiscoverEvent('discover_replay', post.id)
    }
  }

  const toggleMute = () => setMuted((m) => !m)

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as never)
      return
    }
    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikeCount((c) => c + (wasLiked ? -1 : 1))
    try {
      const count = wasLiked ? await discoverApi.unlike(post.id) : await discoverApi.like(post.id)
      setLikeCount(count)
    } catch {
      setIsLiked(wasLiked)
      setLikeCount((c) => c + (wasLiked ? 1 : -1))
    }
  }

  const handleToggleSave = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as never)
      return
    }
    const wasSaved = isSaved
    setIsSaved(!wasSaved)
    setSaveCount((c) => c + (wasSaved ? -1 : 1))
    try {
      const count = wasSaved ? await discoverApi.unsave(post.id) : await discoverApi.save(post.id)
      setSaveCount(count)
    } catch {
      setIsSaved(wasSaved)
      setSaveCount((c) => c + (wasSaved ? 1 : -1))
    }
  }

  const handleShare = async () => {
    discoverApi.trackShare(post.id).catch(() => {})
    try {
      await Share.share({
        message: post.caption ? `${post.caption} -- TechTools` : 'Check this out on TechTools',
      })
    } catch {
      // Cancelled -- not an error.
    }
  }

  const handleQuickAdd = () => {
    if (!primaryProduct) return
    addItem(primaryProduct, 1, undefined, post.id)
    getEventTracker().trackAddToCart(
      primaryProduct.id,
      primaryProduct.name,
      Number(primaryProduct.sale_price ?? primaryProduct.base_price),
      1,
    )
    discoverApi.trackAddToCart(post.id).catch(() => {})
  }

  const handleImageSwipe = (direction: 'left' | 'right') => {
    const count = post.images?.length || 0
    if (count <= 1) return
    setImageIndex((i) => (direction === 'left' ? (i + 1) % count : (i - 1 + count) % count))
  }

  return (
    <View style={[styles.container, { height }]}>
      {post.media_type === 'video' ? (
        <TouchableOpacity activeOpacity={1} onPress={toggleMute} style={StyleSheet.absoluteFill}>
          <Video
            ref={videoRef}
            source={{ uri: post.video_url || '' }}
            posterSource={post.video_poster_url ? { uri: post.video_poster_url } : undefined}
            usePoster={!!post.video_poster_url}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.CONTAIN}
            isMuted={muted}
            isLooping={false}
            useNativeControls={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={(e) => {
            const x = e.nativeEvent.locationX
            handleImageSwipe(x > SCREEN_WIDTH / 2 ? 'left' : 'right')
          }}
        >
          {(post.images || []).map((img, idx) => (
            <Image
              key={img.id}
              source={{ uri: img.image_url }}
              style={[StyleSheet.absoluteFill, { opacity: idx === imageIndex ? 1 : 0 }]}
              resizeMode="contain"
            />
          ))}
          {(post.images?.length || 0) > 1 && (
            <View style={styles.dotsRow} pointerEvents="none">
              {post.images!.map((_, idx) => (
                <View key={idx} style={[styles.dot, idx === imageIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}

      {post.media_type === 'video' && (
        <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={AppColors.white} />
        </TouchableOpacity>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <View style={styles.bottomRow}>
        <View style={styles.leftColumn}>
          <Text style={styles.handle}>@TechTools</Text>
          {!!post.caption && (
            <Text style={styles.caption} numberOfLines={2}>
              {post.caption}
            </Text>
          )}
          {!!post.category_name && (
            <Text style={styles.categoryTag}>#{post.category_name.replace(/\s+/g, '')}</Text>
          )}

          {primaryProduct && (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() => onOpenProduct(products.length > 1 ? undefined : primaryProduct.id)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: getProductImage(primaryProduct) }} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>
                  {primaryProduct.name}
                </Text>
                <Text style={styles.productPrice}>
                  {formatPrice(primaryProduct.sale_price ?? primaryProduct.base_price)}
                </Text>
              </View>
              {products.length > 1 ? (
                <View style={styles.multiProductBadge}>
                  <Ionicons name="layers" size={12} color={AppColors.white} />
                  <Text style={styles.multiProductText}>{products.length} products</Text>
                </View>
              ) : (
                <View style={styles.viewProductBadge}>
                  <Text style={styles.viewProductText}>View Product</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.rightColumn}>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleLike}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={28}
              color={isLiked ? AppColors.error : AppColors.white}
            />
            <Text style={styles.actionCount}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave}>
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={28}
              color={isSaved ? AppColors.accent : AppColors.white}
            />
            <Text style={styles.actionCount}>{saveCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={28} color={AppColors.white} />
            <Text style={styles.actionCount}>{post.share_count}</Text>
          </TouchableOpacity>
          {primaryProduct && products.length === 1 && (
            <TouchableOpacity style={styles.actionButton} onPress={handleQuickAdd}>
              <Ionicons name="bag-add-outline" size={28} color={AppColors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: AppColors.black,
  },
  muteButton: {
    position: 'absolute',
    top: AppSpacing.lg,
    right: AppSpacing.base,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: AppBorderRadius.full,
    padding: AppSpacing.sm,
  },
  dotsRow: {
    position: 'absolute',
    top: AppSpacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 22,
    backgroundColor: AppColors.white,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  bottomRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: AppSpacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: AppSpacing.base,
    gap: AppSpacing.sm,
  },
  leftColumn: {
    flex: 1,
  },
  handle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.white,
  },
  caption: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  categoryTag: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.accent,
    marginTop: AppSpacing.sm,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.sm,
    marginTop: AppSpacing.md,
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: AppBorderRadius.md,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.primary,
  },
  multiProductBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.gray900,
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 6,
  },
  multiProductText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.white,
  },
  viewProductBadge: {
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 6,
  },
  viewProductText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.white,
  },
  rightColumn: {
    alignItems: 'center',
    gap: AppSpacing.lg,
  },
  actionButton: {
    alignItems: 'center',
    gap: 2,
  },
  actionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.white,
  },
})
