// ============================================
// Discover Feed Slide -- one full-screen post
// ============================================
// Video autoplays muted (browser requirement) when this slide is the
// active one. Tap toggles play/pause (with a brief center glyph, like
// TikTok/Reels); double-tap likes with a heart-burst animation; the
// speaker button top-right is the only way to unmute, kept separate from
// play/pause on purpose so a curious tap never silently kills playback.
// Image posts get the same hand-rolled touch-swipe carousel pattern
// already used on the product page (ImageGallery.tsx). Like/save are
// real, server-synced, optimistic with rollback on failure -- same
// pattern established for brand-follow this session. A guest tapping
// like/save is sent to log in, since these are account-tied actions (not
// a local-first concept like the cart).

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import {
  Heart,
  Bookmark,
  Share2,
  Volume2,
  VolumeX,
  ShoppingBag,
  Layers,
  Play,
  Pause,
  Loader2,
  VideoOff,
  Music,
} from 'lucide-react'
import type { DiscoverPost } from '../../api'
import { discoverApi } from '../../api'
import { useAuthStore, useCartStore } from '../../stores'
import { getEventTracker } from '../../services/event-tracking'
import { formatPrice, formatCompactNumber, getProductImage, cn } from '../../utils'

const SWIPE_THRESHOLD_PX = 40
const DOUBLE_TAP_WINDOW_MS = 300
const SOUND_HINT_KEY = 'discover_sound_hint_seen'

interface DiscoverSlideProps {
  post: DiscoverPost
  isActive: boolean
  onOpenProduct: (productId?: string) => void
}

export default function DiscoverSlide({ post, isActive, onOpenProduct }: DiscoverSlideProps) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const addItem = useCartStore((s) => s.addItem)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const touchStartX = useRef<number | null>(null)
  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playIconTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActiveRef = useRef(isActive)
  // True whenever hls.js is actively attached and managing the <video>
  // element's playback. hls.js drives the element through MediaSource
  // Extensions internally (attach/detach/destroy), and that lifecycle can
  // itself fire a native 'error' event on the element that has nothing to
  // do with the actual media being unplayable -- observed live: hls.js
  // fetches the manifest and a quality-level playlist successfully (real,
  // working Cloudinary URLs, confirmed independently), yet the plain
  // <video onError> handler still fired and showed "couldn't be played".
  // While this is true, only hls.js's own Hls.Events.ERROR (with a real
  // `fatal` flag) is trusted to decide the video has actually failed.
  const hlsActiveRef = useRef(false)
  // True once we've committed to the plain progressive-MP4 fallback for
  // the current post -- lets onError distinguish "the streaming attempt
  // failed, try the fallback" from "even the fallback failed, this is
  // genuinely broken" instead of retrying the same failing source forever.
  const usingFallbackRef = useRef(false)

  const [muted, setMuted] = useState(true)
  const [imageIndex, setImageIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [isSaved, setIsSaved] = useState(post.isSaved)
  const [saveCount, setSaveCount] = useState(post.save_count)
  const [watchedComplete, setWatchedComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [showPlayGlyph, setShowPlayGlyph] = useState(false)
  const [showHeartBurst, setShowHeartBurst] = useState(false)
  const [showSoundHint, setShowSoundHint] = useState(false)

  const products = post.products || []
  const primaryProduct = products[0]
  const hasCustomAudio = !!post.audio_url
  // Video's own audio is always muted once a custom track exists -- the
  // separate <audio> element becomes the single sound source instead of
  // mixing both. Mirrors TikTok's "adding a sound replaces the original
  // audio" behavior, and is simpler/more controllable than layering two
  // audio sources under one mute toggle.
  const showSoundControls =
    (post.media_type === 'video' && !videoFailed) || (post.media_type === 'image' && hasCustomAudio)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // Adaptive-bitrate playback (real infra, not a video-tag src swap):
  // hls.js (MediaSource Extensions) is the primary path -- checked via
  // Hls.isSupported() first, matching hls.js's own recommended order.
  // Native HLS (video.canPlayType(...)) is only a fallback for browsers
  // without usable MSE, chiefly older Safari -- checking it FIRST used to
  // cause real failures: some Chromium-based browsers report a truthy
  // canPlayType for HLS's MIME type without actually being able to
  // decode an .m3u8 manifest as a native <video> source, which fails
  // immediately with MEDIA_ERR_SRC_NOT_SUPPORTED (confirmed live) since
  // there's no hls.js in the loop to do the real demuxing. Falls back to
  // the plain progressive MP4 on any fatal hls.js error, OR if the
  // native-HLS branch itself errors, OR when no streaming variant exists
  // (local/R2 storage) -- usingFallbackRef tracks whether we've already
  // committed to that fallback, so the onError handler below only gives
  // up for real once even the plain MP4 has failed.
  useEffect(() => {
    const video = videoRef.current
    if (!video || post.media_type !== 'video') return

    const streamingUrl = post.video_streaming_url
    const fallbackUrl = post.video_url || ''
    let hls: Hls | null = null
    usingFallbackRef.current = false

    const switchToFallback = () => {
      hlsActiveRef.current = false
      usingFallbackRef.current = true
      video.src = fallbackUrl
      video.load()
      if (isActiveRef.current) video.play().catch(() => {})
    }

    if (streamingUrl && Hls.isSupported()) {
      hlsActiveRef.current = true
      hls = new Hls({ maxBufferLength: 15 })
      hls.loadSource(streamingUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isActiveRef.current) video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        console.error('[Discover] hls.js fatal error, falling back to MP4:', data.type, data.details)
        hls?.destroy()
        hls = null
        // From here on a real <video> error means the fallback itself
        // failed, so native error handling should be trusted again.
        switchToFallback()
      })
    } else if (streamingUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      hlsActiveRef.current = false
      video.src = streamingUrl
    } else {
      switchToFallback()
    }

    return () => {
      hlsActiveRef.current = false
      hls?.destroy()
    }
  }, [post.id, post.video_streaming_url, post.video_url, post.media_type])

  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (isActive) {
      if (video && !videoFailed) {
        video.currentTime = 0
        setProgress(0)
        setPaused(false)
        video.play().catch(() => {})
      }
      if (audio) {
        audio.currentTime = 0
        if (post.media_type === 'image') setPaused(false)
        audio.play().catch(() => {})
      }
      getEventTracker().trackDiscoverEvent('discover_view', post.id)

      try {
        if (muted && !sessionStorage.getItem(SOUND_HINT_KEY)) {
          setShowSoundHint(true)
          sessionStorage.setItem(SOUND_HINT_KEY, '1')
          const hintTimer = setTimeout(() => setShowSoundHint(false), 2800)
          return () => clearTimeout(hintTimer)
        }
      } catch {
        // sessionStorage unavailable (private mode etc.) -- hint just doesn't show
      }
    } else {
      video?.pause()
      audio?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, post.id, videoFailed])

  const handleVideoEnded = () => {
    if (!watchedComplete) {
      setWatchedComplete(true)
      getEventTracker().trackDiscoverEvent('discover_watch_complete', post.id)
    } else {
      getEventTracker().trackDiscoverEvent('discover_replay', post.id)
    }
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video || !video.duration) return
    setProgress(video.currentTime / video.duration)
  }

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev
      if (hasCustomAudio) {
        if (audioRef.current) audioRef.current.muted = next
      } else if (videoRef.current) {
        videoRef.current.muted = next
      }
      return next
    })
    setShowSoundHint(false)
  }

  const flashPlayGlyph = () => {
    setShowPlayGlyph(true)
    if (playIconTimeoutRef.current) clearTimeout(playIconTimeoutRef.current)
    playIconTimeoutRef.current = setTimeout(() => setShowPlayGlyph(false), 500)
  }

  const togglePlayPause = () => {
    const video = videoRef.current
    const audio = audioRef.current
    // "Primary" decides play direction: the video for a video post, the
    // audio track for an image post with one attached -- a plain image
    // with no audio has nothing to play/pause, so this is a no-op then.
    const primary = post.media_type === 'video' ? video : audio
    if (!primary || (post.media_type === 'video' && videoFailed)) return

    if (primary.paused) {
      video?.play().catch(() => {})
      audio?.play().catch(() => {})
      setPaused(false)
    } else {
      video?.pause()
      audio?.pause()
      setPaused(true)
    }
    flashPlayGlyph()
  }

  const triggerHeartBurst = () => {
    setShowHeartBurst(false)
    // Re-trigger the CSS animation even if it's already mid-run.
    requestAnimationFrame(() => setShowHeartBurst(true))
    if (heartTimeoutRef.current) clearTimeout(heartTimeoutRef.current)
    heartTimeoutRef.current = setTimeout(() => setShowHeartBurst(false), 800)
    if (!isLiked) handleToggleLike()
  }

  const handleMediaTap = () => {
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || (post.images?.length || 0) <= 1) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    const count = post.images!.length
    if (delta > SWIPE_THRESHOLD_PX) setImageIndex((i) => (i - 1 + count) % count)
    else if (delta < -SWIPE_THRESHOLD_PX) setImageIndex((i) => (i + 1) % count)
    touchStartX.current = null
  }

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/discover' } } })
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
      navigate('/login', { state: { from: { pathname: '/discover' } } })
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
    const url = `${window.location.origin}/discover?post=${post.id}`
    discoverApi.trackShare(post.id).catch(() => {})
    if (navigator.share) {
      try {
        await navigator.share({ title: 'TechTools', text: post.caption || 'Check this out on TechTools', url })
      } catch {
        // Cancelled -- not an error.
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Clipboard unavailable -- soft failure.
      }
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

  return (
    <section className="relative h-screen w-full snap-start overflow-hidden bg-black">
      {post.media_type === 'video' && !videoFailed && (
        <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-white/25">
          <div
            className="h-full bg-white transition-[width] duration-100 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      )}

      {post.media_type === 'video' ? (
        videoFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-950 px-6 text-center text-white/70">
            <VideoOff className="h-10 w-10" />
            <p className="text-sm">This video couldn't be played.</p>
          </div>
        ) : (
          <div className="relative h-full w-full" onClick={handleMediaTap}>
            <video
              ref={videoRef}
              // No static src -- the HLS/fallback effect above owns
              // video.src imperatively (hls.js needs attachMedia, not a
              // plain src attribute, when a streaming variant exists).
              poster={post.video_poster_url || undefined}
              muted={hasCustomAudio ? true : muted}
              playsInline
              loop={false}
              onEnded={handleVideoEnded}
              onTimeUpdate={handleTimeUpdate}
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onCanPlay={() => setBuffering(false)}
              onError={(e) => {
                // While hls.js owns this element, it alone decides what's
                // fatal (see the effect above) -- its own attach/detach/
                // destroy lifecycle can otherwise trigger a native error
                // event that looks identical to a real playback failure.
                if (hlsActiveRef.current) return
                console.error('[Discover] native video error:', e.currentTarget.error?.code, e.currentTarget.error?.message)
                if (!usingFallbackRef.current && post.video_url) {
                  // Native-HLS branch (or a same-URL retry) failed --
                  // give the plain progressive MP4 one real shot before
                  // giving up, same safety net the hls.js path already has.
                  usingFallbackRef.current = true
                  const video = e.currentTarget
                  video.src = post.video_url
                  video.load()
                  if (isActiveRef.current) video.play().catch(() => {})
                  return
                }
                setVideoFailed(true)
              }}
              className="h-full w-full object-contain"
            />

            {buffering && isActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin text-white/80" />
              </div>
            )}

            {showPlayGlyph && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="animate-play-pulse rounded-full bg-black/40 p-5">
                  {paused ? (
                    <Play className="h-10 w-10 fill-white text-white" />
                  ) : (
                    <Pause className="h-10 w-10 fill-white text-white" />
                  )}
                </div>
              </div>
            )}

            {showHeartBurst && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Heart className="h-24 w-24 animate-heart-burst fill-red-500 text-red-500 drop-shadow-lg" />
              </div>
            )}

            {showSoundHint && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-fadeIn rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white">
                Tap the speaker for sound
              </div>
            )}
          </div>
        )
      ) : (
        <div
          className="relative h-full w-full"
          onClick={handleMediaTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {(post.images || []).map((img, idx) => (
            <img
              key={img.id}
              src={img.image_url}
              alt={post.caption || ''}
              className={cn(
                'absolute inset-0 h-full w-full object-contain transition-opacity duration-200',
                idx === imageIndex ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
            />
          ))}
          {(post.images?.length || 0) > 1 && (
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center gap-1.5">
              {post.images!.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-1 rounded-full transition-all',
                    idx === imageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40',
                  )}
                />
              ))}
            </div>
          )}
          {showPlayGlyph && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="animate-play-pulse rounded-full bg-black/40 p-5">
                {paused ? (
                  <Play className="h-10 w-10 fill-white text-white" />
                ) : (
                  <Pause className="h-10 w-10 fill-white text-white" />
                )}
              </div>
            </div>
          )}

          {showHeartBurst && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart className="h-24 w-24 animate-heart-burst fill-red-500 text-red-500 drop-shadow-lg" />
            </div>
          )}

          {showSoundHint && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-fadeIn rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white">
              Tap the speaker for sound
            </div>
          )}
        </div>
      )}

      {hasCustomAudio && (
        <audio ref={audioRef} src={post.audio_url || undefined} muted={muted} loop className="hidden" />
      )}

      {showSoundControls && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="absolute right-4 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      )}

      {/* Bottom gradient + overlay content */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 pb-6">
        <div className="min-w-0 flex-1 text-white">
          {post.seller_handle ? (
            <Link to={`/seller/${post.seller_handle}`} className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-orange-500 to-red-600 ring-2 ring-white/80">
                {post.seller_avatar_url ? (
                  <img src={post.seller_avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-white">
                    {(post.seller_display_name || post.seller_handle).charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="font-bold">{post.seller_display_name || `@${post.seller_handle}`}</p>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-500 to-red-600 ring-2 ring-white/80">
                <span className="text-sm font-bold text-white">T</span>
              </div>
              <p className="font-bold">@TechTools</p>
            </div>
          )}
          {!!post.caption && <p className="mt-2 line-clamp-2 text-sm text-white/90">{post.caption}</p>}
          {!!post.category_name && (
            <Link
              to={`/category/${post.category_slug}`}
              className="mt-2 inline-block text-xs font-medium text-orange-300 hover:underline"
            >
              #{post.category_name.replace(/\s+/g, '')}
            </Link>
          )}

          {primaryProduct && (
            <button
              type="button"
              onClick={() => onOpenProduct(products.length > 1 ? undefined : primaryProduct.id)}
              className="mt-3 flex animate-slideUp items-center gap-3 rounded-xl bg-white/95 p-2 pr-4 text-left shadow-lg backdrop-blur"
            >
              <img
                src={getProductImage(primaryProduct, { w: 96, h: 96 })}
                alt={primaryProduct.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{primaryProduct.name}</p>
                <p className="text-sm font-bold text-orange-600">
                  {formatPrice(primaryProduct.sale_price ?? primaryProduct.base_price)}
                </p>
              </div>
              {products.length > 1 ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white">
                  <Layers className="h-3.5 w-3.5" />
                  {products.length} products
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-orange-500 px-4 py-1.5 text-xs font-bold text-white">
                  View Product
                </span>
              )}
            </button>
          )}

          {hasCustomAudio && (
            <div className="mt-3 flex min-w-0 items-center gap-1.5 text-xs text-white/90">
              <Music className="h-3.5 w-3.5 shrink-0 animate-spin [animation-duration:3s]" />
              <span className="truncate">{post.audio_label || 'Original sound'}</span>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="flex shrink-0 flex-col items-center gap-3 text-white">
          <button type="button" onClick={handleToggleLike} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
                isLiked ? 'bg-red-500/25' : 'bg-white/10',
              )}
            >
              <Heart className={cn('h-6 w-6', isLiked ? 'fill-red-500 text-red-500' : 'text-white')} />
            </span>
            <span className="text-xs font-semibold tabular-nums">{formatCompactNumber(likeCount)}</span>
          </button>
          <button type="button" onClick={handleToggleSave} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
                isSaved ? 'bg-orange-400/25' : 'bg-white/10',
              )}
            >
              <Bookmark className={cn('h-6 w-6', isSaved ? 'fill-orange-400 text-orange-400' : 'text-white')} />
            </span>
            <span className="text-xs font-semibold tabular-nums">{formatCompactNumber(saveCount)}</span>
          </button>
          <button type="button" onClick={handleShare} className="flex flex-col items-center gap-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
              <Share2 className="h-6 w-6 text-white" />
            </span>
            <span className="text-xs font-semibold tabular-nums">{formatCompactNumber(post.share_count)}</span>
          </button>
          {primaryProduct && products.length === 1 && (
            <button type="button" onClick={handleQuickAdd} aria-label="Quick add to cart" className="flex flex-col items-center gap-1">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                <ShoppingBag className="h-6 w-6 text-white" />
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
