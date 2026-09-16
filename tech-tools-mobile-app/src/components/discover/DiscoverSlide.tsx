// ============================================
// TechTools Mobile App - Discover Feed Slide
// ============================================
// Mirrors the web storefront's DiscoverSlide.tsx redesign: tap to
// play/pause with a center glyph, double-tap to like with a heart-burst
// animation, a top progress bar driven by real playback position, a
// buffering spinner, an honest "couldn't be played" fallback on video
// error (never a silent frozen frame), a one-time "tap for sound" hint,
// and a real optional background audio track (admin's own upload, not a
// licensed music catalog) played through expo-audio -- the video's own
// audio is muted whenever a custom track is attached, matching TikTok's
// "sound replaces original audio" behavior.
//
// Built on expo-video/expo-audio, not expo-av -- expo-av was fully
// removed in Expo SDK 55 (this app's SDK), so the original expo-av-based
// implementation stopped working entirely (both in Expo Go and in a
// real build, since the native module itself is gone, not just
// restricted). expo-video/expo-audio's hook-based players
// (useVideoPlayer/useAudioPlayer) replace the old ref + async-imperative-
// call model (videoRef.current.playAsync() etc.) with a stable player
// object whose methods are synchronous, and status/progress come from
// useEvent/useEventListener (from the `expo` package) instead of a single
// onPlaybackStatusUpdate callback prop.
//
// No spin-loop animation convention existed in this codebase (the only
// prior rotation, animated-icon.tsx, is a one-shot splash Keyframe) --
// the music-note badge below uses plain RN `Animated.loop`, the simplest
// correct primitive for a continuous spin.
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
import { useEvent, useEventListener } from 'expo'
import { useVideoPlayer, VideoView, VideoSource } from 'expo-video'
import { useAudioPlayer } from 'expo-audio'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import type { DiscoverPost } from '@/api'
import { discoverApi } from '@/api'
import { useAuthStore, useCartStore } from '@/stores'
import { getEventTracker } from '@/services/event-tracking'
import { formatPrice, formatCompactNumber, getProductImage } from '@/utils'
import { AppColors, AppSpacing, AppBorderRadius, AppGradients, AppShadows } from '@/constants/appTheme'

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
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  // If the HLS variant fails (e.g. streaming profiles not enabled on the
  // live Cloudinary plan), retry once with the plain MP4 before giving
  // up -- mirrors the web player's fatal-HLS-error fallback so a
  // Cloudinary-side gap never regresses the "video actually plays" fix.
  const [useFallbackSource, setUseFallbackSource] = useState(false)
  const [showPlayGlyphIcon, setShowPlayGlyphIcon] = useState(false)
  const [showSoundHint, setShowSoundHint] = useState(false)
  // Brief "Added" confirmation on the product card's quick-add button --
  // real state change (item is genuinely in the cart by the time this
  // shows), not a decorative-only animation.
  const [justAdded, setJustAdded] = useState(false)
  const productCardOpacity = useRef(new Animated.Value(0)).current
  const productCardTranslateY = useRef(new Animated.Value(16)).current
  const likeScale = useRef(new Animated.Value(1)).current

  const products = post.products || []
  const primaryProduct = products[0]
  const hasCustomAudio = !!post.audio_url
  const isVideoPost = post.media_type === 'video'
  // Only a real markdown, never a fabricated "was" price -- base_price is
  // frequently 0 (no list price set) with sale_price as the actual
  // selling price, so a strikethrough only makes sense when base_price is
  // a real, higher number.
  const originalPrice = primaryProduct ? Number(primaryProduct.base_price) : 0
  const currentPrice = primaryProduct
    ? Number(primaryProduct.sale_price ?? primaryProduct.base_price)
    : 0
  const hasRealDiscount = originalPrice > 0 && currentPrice > 0 && originalPrice > currentPrice
  const discountPercent = hasRealDiscount
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0

  useEffect(() => {
    if (!primaryProduct) return
    productCardOpacity.setValue(0)
    productCardTranslateY.setValue(16)
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(productCardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(productCardTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
        }),
      ]).start()
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  // Adaptive-bitrate HLS when available -- expo-video's native player
  // (ExoPlayer on Android, AVPlayer on iOS) handles .m3u8 quality-
  // switching with zero extra code, unlike web which needs hls.js.
  // Falls back to the plain MP4 (useFallbackSource) when no streaming
  // variant exists or the streaming one fails to load. useVideoPlayer
  // is always called (even for image posts, with a null source) --
  // hooks can't be called conditionally, and expo-video explicitly
  // supports a null initial source for exactly this case.
  const initialVideoSource: VideoSource | null = isVideoPost
    ? (!useFallbackSource && post.video_streaming_url) || post.video_url || null
    : null
  const player = useVideoPlayer(initialVideoSource, (p) => {
    p.loop = false
  })

  // Real optional background track -- admin's own upload, not a
  // licensed music catalog. Always called (source null when absent);
  // the hook auto-releases the native player on unmount.
  const audioPlayer = useAudioPlayer(hasCustomAudio ? post.audio_url : null)

  // "Primary" decides play/pause/status for whichever media actually
  // carries meaning for this post -- the video for a video post, the
  // audio track for an image post with one attached, or nothing for a
  // plain image.
  const primaryPlayer = isVideoPost ? player : hasCustomAudio ? audioPlayer : null

  const { status: videoStatus } = useEvent(player, 'statusChange', {
    status: player.status,
    error: undefined as { message: string } | undefined,
  })
  const buffering = isVideoPost && videoStatus === 'loading'

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'error') return
    if (!useFallbackSource && post.video_streaming_url && post.video_url) {
      setUseFallbackSource(true)
      player.replaceAsync(post.video_url).catch(() => setVideoFailed(true))
    } else {
      setVideoFailed(true)
    }
  })

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration) setProgress(currentTime / player.duration)
  })

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) setHasStartedPlaying(true)
  })

  useEventListener(player, 'playToEnd', () => {
    if (!watchedComplete.current) {
      watchedComplete.current = true
      getEventTracker().trackDiscoverEvent('discover_watch_complete', post.id)
    } else {
      getEventTracker().trackDiscoverEvent('discover_replay', post.id)
    }
  })

  // Video's own audio is always muted once a custom track exists -- the
  // separate audio player becomes the single sound source instead of
  // mixing both. expo-video's player object is a native-bridge handle,
  // not React state -- setting its properties directly (player.muted =
  // ...) is the API's own documented usage, not a purity violation the
  // newer react-hooks/immutability check has an exception for yet.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.muted = hasCustomAudio ? true : muted
  }, [player, muted, hasCustomAudio])

  useEffect(() => {
    if (!hasCustomAudio) return
    /* eslint-disable react-hooks/immutability */
    audioPlayer.loop = true
    audioPlayer.muted = muted
    /* eslint-enable react-hooks/immutability */
  }, [audioPlayer, hasCustomAudio, muted])

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

  useEffect(() => {
    if (isActive) {
      if (isVideoPost && !videoFailed) {
        // eslint-disable-next-line react-hooks/immutability -- native player handle, see above
        player.currentTime = 0
        // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the progress bar to match the player seek above, not derived render state
        setProgress(0)
        player.play()
      }
      if (hasCustomAudio) {
        audioPlayer.seekTo(0).catch(() => {})
        audioPlayer.play()
      }
      setPaused(false)
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
      player.pause()
      if (hasCustomAudio) audioPlayer.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, post.id, videoFailed])

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    if (!isLiked) handleToggleLike()
  }

  const bounceLikeIcon = () => {
    likeScale.setValue(0.7)
    Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, friction: 4 }).start()
  }

  const togglePlayPause = () => {
    if (!primaryPlayer) return
    if (!primaryPlayer.playing) {
      if (isVideoPost) player.play()
      if (hasCustomAudio) audioPlayer.play()
      setPaused(false)
    } else {
      if (isVideoPost) player.pause()
      if (hasCustomAudio) audioPlayer.pause()
      setPaused(true)
    }
    flashPlayGlyph()
  }

  const toggleMute = () => {
    setMuted((prev) => !prev)
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (!wasLiked) bounceLikeIcon()
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1600)
  }

  const handleImageSwipe = (direction: 'left' | 'right') => {
    const count = post.images?.length || 0
    if (count <= 1) return
    setImageIndex((i) => (direction === 'left' ? (i + 1) % count : (i - 1 + count) % count))
  }

  const showSoundControls = (isVideoPost && !videoFailed) || (post.media_type === 'image' && hasCustomAudio)

  return (
    <View style={[styles.container, { height }]}>
      {isVideoPost && !videoFailed && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
        </View>
      )}

      {isVideoPost ? (
        videoFailed ? (
          <View style={[StyleSheet.absoluteFill, styles.errorState]}>
            <Ionicons name="videocam-off-outline" size={40} color="rgba(255,255,255,0.6)" />
            <Text style={styles.errorText}>This video couldn&apos;t be played.</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={1} onPress={handleMediaTap} style={StyleSheet.absoluteFill}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
            />

            {!!post.video_poster_url && !hasStartedPlaying && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Image
                  source={{ uri: post.video_poster_url }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
              </View>
            )}

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
            <Animated.View
              style={{
                opacity: productCardOpacity,
                transform: [{ translateY: productCardTranslateY }],
              }}
            >
              <TouchableOpacity
                style={styles.productCardTouchable}
                onPress={() => onOpenProduct(products.length > 1 ? undefined : primaryProduct.id)}
                activeOpacity={0.92}
              >
                <BlurView intensity={45} tint="dark" style={styles.productCard}>
                  <Image source={{ uri: getProductImage(primaryProduct) }} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {primaryProduct.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.productPrice}>{formatPrice(currentPrice)}</Text>
                      {hasRealDiscount && (
                        <>
                          <Text style={styles.productOriginalPrice}>{formatPrice(originalPrice)}</Text>
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>

                  {products.length > 1 ? (
                    <View style={styles.multiProductBadge}>
                      <Ionicons name="layers" size={12} color={AppColors.white} />
                      <Text style={styles.multiProductText}>{products.length}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.quickAddButton, justAdded && styles.quickAddButtonSuccess]}
                      onPress={handleQuickAdd}
                      activeOpacity={0.85}
                    >
                      {justAdded ? (
                        <Ionicons name="checkmark" size={18} color={AppColors.white} />
                      ) : (
                        <Ionicons name="bag-add" size={16} color={AppColors.white} />
                      )}
                    </TouchableOpacity>
                  )}
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
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
            <BlurView
              intensity={30}
              tint="dark"
              style={[styles.actionIconBubble, isLiked && styles.actionIconBubbleLiked]}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isLiked ? AppColors.error : AppColors.white}
                />
              </Animated.View>
            </BlurView>
            <Text style={styles.actionCount}>{formatCompactNumber(likeCount)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave}>
            <BlurView
              intensity={30}
              tint="dark"
              style={[styles.actionIconBubble, isSaved && styles.actionIconBubbleSaved]}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isSaved ? AppColors.accent : AppColors.white}
              />
            </BlurView>
            <Text style={styles.actionCount}>{formatCompactNumber(saveCount)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <BlurView intensity={30} tint="dark" style={styles.actionIconBubble}>
              <Ionicons name="share-social-outline" size={24} color={AppColors.white} />
            </BlurView>
            <Text style={styles.actionCount}>{formatCompactNumber(post.share_count)}</Text>
          </TouchableOpacity>
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
  productCardTouchable: {
    marginTop: AppSpacing.md,
    borderRadius: AppBorderRadius.xl,
    overflow: 'hidden',
    ...AppShadows.lg,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.sm,
    overflow: 'hidden',
  },
  productImage: {
    width: 52,
    height: 52,
    borderRadius: AppBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.white,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.primaryLight,
  },
  productOriginalPrice: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: AppColors.badgeHot,
    borderRadius: AppBorderRadius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.white,
  },
  multiProductBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 6,
  },
  multiProductText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.white,
  },
  quickAddButton: {
    width: 36,
    height: 36,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddButtonSuccess: {
    backgroundColor: AppColors.success,
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionIconBubbleLiked: {
    backgroundColor: 'rgba(239,68,68,0.3)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  actionIconBubbleSaved: {
    backgroundColor: 'rgba(16,185,129,0.3)',
    borderColor: 'rgba(16,185,129,0.4)',
  },
  actionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.white,
  },
})
