// ============================================
// TechTools Mobile App - Discover Feed Slide
// ============================================
// Mirrors the web storefront's DiscoverSlide.tsx redesign: tap to
// play/pause with a center glyph, double-tap to like with a heart-burst
// animation, a top progress bar driven by real playback position, a
// buffering spinner, an honest "couldn't be played" fallback on video
// error (never a silent frozen frame), a one-time "tap for sound" hint,
// and a real optional background audio track (admin's own upload, not a
// licensed music catalog) played through a separate expo-av Audio.Sound
// -- the video's own audio is muted whenever a custom track is attached,
// matching TikTok's "sound replaces original audio" behavior.
//
// `expo-av`'s Video is already installed and used this exact way on the
// product detail screen (product/[slug].tsx). `Audio` is new to this
// app (nothing used it before this), added specifically for the
// background-track feature. No spin-loop animation convention existed
// in this codebase (the only prior rotation, animated-icon.tsx, is a
// one-shot splash Keyframe) -- the music-note badge below uses plain RN
// `Animated.loop`, the simplest correct primitive for a continuous spin.
//
// react-hooks/refs is disabled file-wide: the legacy RN `Animated` API's
// standard idiom for a stable animated value is `useRef(new
// Animated.Value(0)).current`, and reading/interpolating/binding that
// value in a style prop is how every such value is used, in render, by
// design (Animated.Value is a mutable container meant to be read this
// way, not a plain ref holding DOM-adjacent state). React Compiler's
// newer ref-purity rule doesn't yet have an exception for this API, and
// flags every one of playGlyphOpacity/heartScale/heartOpacity/spinValue's
// real, safe uses below. A full rewrite onto react-native-reanimated's
// hook-based API (which the rule does support) is real future work, not
// something to risk on already-verified animation code under this pass.
/* eslint-disable react-hooks/refs */

import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Share,
  Animated,
  ActivityIndicator,
} from 'react-native'
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import type { DiscoverPost } from '@/api'
import { discoverApi } from '@/api'
import { useAuthStore, useCartStore } from '@/stores'
import { getEventTracker } from '@/services/event-tracking'
import { formatPrice, formatCompactNumber, getProductImage } from '@/utils'
import { AppColors, AppSpacing, AppBorderRadius, AppGradients } from '@/constants/appTheme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const DOUBLE_TAP_WINDOW_MS = 300

// Module-level, not persisted -- shows once per app-open session rather
// than forever (AsyncStorage would survive app restarts; a plain
// in-memory flag is the closer equivalent of web's sessionStorage-based
// hint, and simpler than adding a storage read for a one-line nicety).
let soundHintShownThisSession = false

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
  const soundRef = useRef<Audio.Sound | null>(null)
  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playGlyphOpacity = useRef(new Animated.Value(0)).current
  const heartScale = useRef(new Animated.Value(0)).current
  const heartOpacity = useRef(new Animated.Value(0)).current
  const spinValue = useRef(new Animated.Value(0)).current

  const [muted, setMuted] = useState(true)
  const [imageIndex, setImageIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [isSaved, setIsSaved] = useState(post.isSaved)
  const [saveCount, setSaveCount] = useState(post.save_count)
  const watchedComplete = useRef(false)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  // If the HLS variant fails (e.g. streaming profiles not enabled on the
  // live Cloudinary plan), retry once with the plain MP4 before giving
  // up -- mirrors the web player's fatal-HLS-error fallback so a
  // Cloudinary-side gap never regresses the "video actually plays" fix.
  const [useFallbackSource, setUseFallbackSource] = useState(false)
  const [showPlayGlyphIcon, setShowPlayGlyphIcon] = useState(false)
  const [showSoundHint, setShowSoundHint] = useState(false)

  const products = post.products || []
  const primaryProduct = products[0]
  const hasCustomAudio = !!post.audio_url
  const videoSource =
    !useFallbackSource && post.video_streaming_url ? post.video_streaming_url : post.video_url || ''
  const showSoundControls =
    (post.media_type === 'video' && !videoFailed) || (post.media_type === 'image' && hasCustomAudio)

  // Continuous spin for the "sound" badge, matching web's animate-spin.
  useEffect(() => {
    if (!hasCustomAudio) return
    const loop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [hasCustomAudio, spinValue])
  const spinDeg = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  // Loads the optional background track once per post. Unloaded on
  // unmount/post change -- Audio.Sound holds a real native resource.
  useEffect(() => {
    if (!post.audio_url) return
    let cancelled = false
    Audio.Sound.createAsync(
      { uri: post.audio_url },
      { isLooping: true, isMuted: muted, shouldPlay: isActive },
    )
      .then(({ sound }) => {
        if (cancelled) {
          sound.unloadAsync().catch(() => {})
          return
        }
        soundRef.current = sound
      })
      .catch(() => {})

    return () => {
      cancelled = true
      soundRef.current?.unloadAsync().catch(() => {})
      soundRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.audio_url])

  useEffect(() => {
    const video = videoRef.current
    const sound = soundRef.current
    if (isActive) {
      if (video && !videoFailed) {
        video.setPositionAsync(0).catch(() => {})
        setProgress(0)
        setPaused(false)
        video.playAsync().catch(() => {})
      }
      if (sound) {
        sound.setPositionAsync(0).catch(() => {})
        setPaused(false)
        sound.playAsync().catch(() => {})
      }
      getEventTracker().trackDiscoverEvent('discover_view', post.id)

      const showSoundHintOnce = () => {
        if (!muted || soundHintShownThisSession) return undefined
        soundHintShownThisSession = true
        setShowSoundHint(true)
        const hintTimer = setTimeout(() => setShowSoundHint(false), 2800)
        return () => clearTimeout(hintTimer)
      }
      return showSoundHintOnce()
    } else {
      video?.pauseAsync().catch(() => {})
      sound?.pauseAsync().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, post.id, videoFailed])

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return
    setBuffering(!!status.isBuffering)
    if (status.durationMillis) {
      setProgress(status.positionMillis / status.durationMillis)
    }
    if (status.didJustFinish) {
      if (!watchedComplete.current) {
        watchedComplete.current = true
        getEventTracker().trackDiscoverEvent('discover_watch_complete', post.id)
      } else {
        getEventTracker().trackDiscoverEvent('discover_replay', post.id)
      }
    }
  }

  const flashPlayGlyph = () => {
    setShowPlayGlyphIcon(true)
    playGlyphOpacity.setValue(1)
    Animated.timing(playGlyphOpacity, {
      toValue: 0,
      duration: 500,
      delay: 150,
      useNativeDriver: true,
    }).start(() => setShowPlayGlyphIcon(false))
  }

  const triggerHeartBurst = () => {
    heartScale.setValue(0.3)
    heartOpacity.setValue(1)
    Animated.parallel([
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
      ]),
      Animated.timing(heartOpacity, {
        toValue: 0,
        duration: 700,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start()
    if (!isLiked) handleToggleLike()
  }

  const togglePlayPause = async () => {
    const video = videoRef.current
    const sound = soundRef.current
    const primaryStatus =
      post.media_type === 'video' ? await video?.getStatusAsync() : await sound?.getStatusAsync()
    if (!primaryStatus || !primaryStatus.isLoaded) return

    if (!primaryStatus.isPlaying) {
      video?.playAsync().catch(() => {})
      sound?.playAsync().catch(() => {})
      setPaused(false)
    } else {
      video?.pauseAsync().catch(() => {})
      sound?.pauseAsync().catch(() => {})
      setPaused(true)
    }
    flashPlayGlyph()
  }

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev
      if (hasCustomAudio) {
        soundRef.current?.setIsMutedAsync(next).catch(() => {})
      }
      return next
    })
    setShowSoundHint(false)
  }

  const handleMediaTap = () => {
    // Only ever invoked from onPress (an event handler, never during
    // render) -- react-hooks/purity's "impure function" check doesn't
    // trace that this closure is event-handler-only, so it flags a real
    // and necessary Date.now() double-tap-timing read as if it ran
    // during render.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const delta = now - lastTapRef.current
    lastTapRef.current = now

    if (delta < DOUBLE_TAP_WINDOW_MS) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current)
        tapTimeoutRef.current = null
      }
      triggerHeartBurst()
      return
    }

    tapTimeoutRef.current = setTimeout(() => {
      togglePlayPause()
      tapTimeoutRef.current = null
    }, DOUBLE_TAP_WINDOW_MS)
  }

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
      {post.media_type === 'video' && !videoFailed && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
        </View>
      )}

      {post.media_type === 'video' ? (
        videoFailed ? (
          <View style={[StyleSheet.absoluteFill, styles.errorState]}>
            <Ionicons name="videocam-off-outline" size={40} color="rgba(255,255,255,0.6)" />
            <Text style={styles.errorText}>This video couldn&apos;t be played.</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={1} onPress={handleMediaTap} style={StyleSheet.absoluteFill}>
            <Video
              ref={videoRef}
              // Adaptive-bitrate HLS when available -- expo-av's native
              // player (ExoPlayer on Android, AVPlayer on iOS) handles
              // .m3u8 quality-switching with zero extra code, unlike web
              // which needs hls.js. Falls back to the plain MP4 (see
              // useFallbackSource above) when no streaming variant exists
              // or the streaming one fails to load.
              source={{ uri: videoSource }}
              posterSource={post.video_poster_url ? { uri: post.video_poster_url } : undefined}
              usePoster={!!post.video_poster_url}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.CONTAIN}
              isMuted={hasCustomAudio ? true : muted}
              isLooping={false}
              useNativeControls={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              onError={() => {
                if (!useFallbackSource && post.video_streaming_url) {
                  setUseFallbackSource(true)
                } else {
                  setVideoFailed(true)
                }
              }}
            />

            {buffering && isActive && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={styles.centerOverlay}>
                  <ActivityIndicator size="large" color="rgba(255,255,255,0.85)" />
                </View>
              </View>
            )}

            {showPlayGlyphIcon && (
              <Animated.View
                style={[styles.centerOverlay, StyleSheet.absoluteFill, { opacity: playGlyphOpacity }]}
                pointerEvents="none"
              >
                <View style={styles.playGlyphBubble}>
                  <Ionicons name={paused ? 'play' : 'pause'} size={36} color={AppColors.white} />
                </View>
              </Animated.View>
            )}

            <Animated.View
              style={[
                styles.centerOverlay,
                StyleSheet.absoluteFill,
                { opacity: heartOpacity, transform: [{ scale: heartScale }] },
              ]}
              pointerEvents="none"
            >
              <Ionicons name="heart" size={96} color={AppColors.error} />
            </Animated.View>

            {showSoundHint && (
              <View style={[styles.centerOverlay, StyleSheet.absoluteFill]} pointerEvents="none">
                <View style={styles.soundHintBubble}>
                  <Text style={styles.soundHintText}>Tap the speaker for sound</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        )
      ) : (
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={(e) => {
            const now = Date.now()
            const delta = now - lastTapRef.current
            lastTapRef.current = now
            if (delta < DOUBLE_TAP_WINDOW_MS) {
              if (tapTimeoutRef.current) {
                clearTimeout(tapTimeoutRef.current)
                tapTimeoutRef.current = null
              }
              triggerHeartBurst()
              return
            }
            tapTimeoutRef.current = setTimeout(() => {
              // Single tap always navigates the image carousel here -- an
              // attached audio track just auto-plays/loops while this
              // slide is active (see the isActive effect above) rather
              // than competing with image navigation for the same tap.
              const x = e.nativeEvent.locationX
              handleImageSwipe(x > SCREEN_WIDTH / 2 ? 'left' : 'right')
              tapTimeoutRef.current = null
            }, DOUBLE_TAP_WINDOW_MS)
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

          <Animated.View
            style={[
              styles.centerOverlay,
              StyleSheet.absoluteFill,
              { opacity: heartOpacity, transform: [{ scale: heartScale }] },
            ]}
            pointerEvents="none"
          >
            <Ionicons name="heart" size={96} color={AppColors.error} />
          </Animated.View>
        </TouchableOpacity>
      )}

      {showSoundControls && (
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
          <View style={styles.handleRow}>
            {post.seller_handle ? (
              <TouchableOpacity
                style={styles.handleRowTouchable}
                onPress={() => router.push(`/seller/${post.seller_handle}` as never)}
              >
                {post.seller_avatar_url ? (
                  <Image source={{ uri: post.seller_avatar_url }} style={styles.avatarBubble} />
                ) : (
                  <LinearGradient colors={AppGradients.hero} style={styles.avatarBubble}>
                    <Text style={styles.avatarLetter}>
                      {(post.seller_display_name || post.seller_handle).charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
                <Text style={styles.handle}>{post.seller_display_name || `@${post.seller_handle}`}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <LinearGradient colors={AppGradients.hero} style={styles.avatarBubble}>
                  <Text style={styles.avatarLetter}>T</Text>
                </LinearGradient>
                <Text style={styles.handle}>@TechTools</Text>
              </>
            )}
          </View>
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

          {hasCustomAudio && (
            <View style={styles.soundRow}>
              <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
                <Ionicons name="musical-note" size={14} color="rgba(255,255,255,0.9)" />
              </Animated.View>
              <Text style={styles.soundLabel} numberOfLines={1}>
                {post.audio_label || 'Original sound'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rightColumn}>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleLike}>
            <View style={[styles.actionIconBubble, isLiked && styles.actionIconBubbleLiked]}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={24}
                color={isLiked ? AppColors.error : AppColors.white}
              />
            </View>
            <Text style={styles.actionCount}>{formatCompactNumber(likeCount)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave}>
            <View style={[styles.actionIconBubble, isSaved && styles.actionIconBubbleSaved]}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isSaved ? AppColors.accent : AppColors.white}
              />
            </View>
            <Text style={styles.actionCount}>{formatCompactNumber(saveCount)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <View style={styles.actionIconBubble}>
              <Ionicons name="share-social-outline" size={24} color={AppColors.white} />
            </View>
            <Text style={styles.actionCount}>{formatCompactNumber(post.share_count)}</Text>
          </TouchableOpacity>
          {primaryProduct && products.length === 1 && (
            <TouchableOpacity style={styles.actionButton} onPress={handleQuickAdd}>
              <View style={styles.actionIconBubble}>
                <Ionicons name="bag-add-outline" size={24} color={AppColors.white} />
              </View>
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
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    zIndex: 20,
  },
  progressFill: {
    height: '100%',
    backgroundColor: AppColors.white,
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: AppSpacing.xl,
  },
  errorText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  centerOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyphBubble: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: AppBorderRadius.full,
    padding: AppSpacing.lg,
  },
  soundHintBubble: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
  },
  soundHintText: {
    color: AppColors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  muteButton: {
    position: 'absolute',
    top: AppSpacing.lg,
    right: AppSpacing.base,
    zIndex: 10,
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
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  handleRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  avatarBubble: {
    width: 32,
    height: 32,
    borderRadius: AppBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.white,
  },
  handle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.white,
  },
  caption: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: AppSpacing.sm,
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
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: AppSpacing.md,
  },
  soundLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    flexShrink: 1,
  },
  rightColumn: {
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  actionButton: {
    alignItems: 'center',
    gap: 2,
  },
  actionIconBubble: {
    width: 44,
    height: 44,
    borderRadius: AppBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBubbleLiked: {
    backgroundColor: 'rgba(239,68,68,0.25)',
  },
  actionIconBubbleSaved: {
    backgroundColor: 'rgba(16,185,129,0.25)',
  },
  actionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.white,
  },
})
