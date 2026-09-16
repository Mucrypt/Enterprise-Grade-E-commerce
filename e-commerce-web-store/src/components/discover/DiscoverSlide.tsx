// ============================================
// Discover Feed Slide -- one full-screen post
// ============================================
// Video autoplays muted (browser requirement) when this slide is the
// active one, tap toggles sound. Image posts get the same hand-rolled
// touch-swipe carousel pattern already used on the product page
// (ImageGallery.tsx). Like/save are real, server-synced, optimistic with
// rollback on failure -- same pattern established for brand-follow this
// session. A guest tapping like/save is sent to log in, since these are
// account-tied actions (not a local-first concept like the cart).

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Heart,
  Bookmark,
  Share2,
  Volume2,
  VolumeX,
  ShoppingBag,
  Layers,
} from 'lucide-react'
import type { DiscoverPost } from '../../api'
import { discoverApi } from '../../api'
import { useAuthStore, useCartStore } from '../../stores'
import { getEventTracker } from '../../services/event-tracking'
import { formatPrice, getProductImage, cn } from '../../utils'

const SWIPE_THRESHOLD_PX = 40

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
  const touchStartX = useRef<number | null>(null)

  const [muted, setMuted] = useState(true)
  const [imageIndex, setImageIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [isSaved, setIsSaved] = useState(post.isSaved)
  const [saveCount, setSaveCount] = useState(post.save_count)
  const [watchedComplete, setWatchedComplete] = useState(false)

  const products = post.products || []
  const primaryProduct = products[0]

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isActive) {
      video.currentTime = 0
      video.play().catch(() => {})
      getEventTracker().trackDiscoverEvent('discover_view', post.id)
    } else {
      video.pause()
    }
  }, [isActive, post.id])

  const handleVideoEnded = () => {
    if (!watchedComplete) {
      setWatchedComplete(true)
      getEventTracker().trackDiscoverEvent('discover_watch_complete', post.id)
    } else {
      getEventTracker().trackDiscoverEvent('discover_replay', post.id)
    }
  }

  const toggleMute = () => {
    setMuted((prev) => {
      if (videoRef.current) videoRef.current.muted = !prev
      return !prev
    })
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
      {post.media_type === 'video' ? (
        <video
          ref={videoRef}
          src={post.video_url || undefined}
          poster={post.video_poster_url || undefined}
          muted={muted}
          playsInline
          loop={false}
          onEnded={handleVideoEnded}
          onClick={toggleMute}
          className="h-full w-full object-contain"
        />
      ) : (
        <div
          className="relative h-full w-full"
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
            <div className="absolute inset-x-0 top-4 flex justify-center gap-1.5">
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
        </div>
      )}

      {post.media_type === 'video' && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      )}

      {/* Bottom gradient + overlay content */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 pb-6">
        <div className="min-w-0 flex-1 text-white">
          <p className="font-bold">@TechTools</p>
          {!!post.caption && <p className="mt-1 line-clamp-2 text-sm text-white/90">{post.caption}</p>}
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
              className="mt-3 flex items-center gap-3 rounded-xl bg-white/95 p-2 pr-4 text-left shadow-lg backdrop-blur"
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
        </div>

        {/* Right rail */}
        <div className="flex shrink-0 flex-col items-center gap-4 text-white">
          <button type="button" onClick={handleToggleLike} className="flex flex-col items-center gap-1">
            <Heart className={cn('h-7 w-7', isLiked ? 'fill-red-500 text-red-500' : 'text-white')} />
            <span className="text-xs font-medium">{likeCount}</span>
          </button>
          <button type="button" onClick={handleToggleSave} className="flex flex-col items-center gap-1">
            <Bookmark className={cn('h-7 w-7', isSaved ? 'fill-orange-400 text-orange-400' : 'text-white')} />
            <span className="text-xs font-medium">{saveCount}</span>
          </button>
          <button type="button" onClick={handleShare} className="flex flex-col items-center gap-1">
            <Share2 className="h-7 w-7" />
            <span className="text-xs font-medium">{post.share_count}</span>
          </button>
          {primaryProduct && products.length === 1 && (
            <button type="button" onClick={handleQuickAdd} aria-label="Quick add to cart" className="flex flex-col items-center gap-1">
              <ShoppingBag className="h-7 w-7" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
