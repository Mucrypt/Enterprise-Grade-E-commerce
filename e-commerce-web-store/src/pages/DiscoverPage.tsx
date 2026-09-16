// ============================================
// Discover Page -- TikTok-style shoppable feed
// ============================================
// CSS scroll-snap (snap-y snap-mandatory) drives the one-post-per-viewport
// behavior; an IntersectionObserver watches every slide and flips
// isActive on whichever one is actually visible, which drives that
// slide's video autoplay. Reliable and dependency-free for a first web
// version, matching the rest of this codebase's no-extra-library
// convention for feed/carousel UI (ToolsHero.tsx, ImageGallery.tsx).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { discoverApi, type DiscoverPost } from '../api'
import type { Product } from '../types'
import DiscoverSlide from '../components/discover/DiscoverSlide'
import ProductBottomSheet from '../components/discover/ProductBottomSheet'
import { getEventTracker } from '../services/event-tracking'

export default function DiscoverPage() {
  const [posts, setPosts] = useState<DiscoverPost[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{
    products: Product[]
    initialProductId?: string
    discoverPostId: string
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const loadingRef = useRef(false)

  const loadPage = useCallback(async (nextPage: number) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const result = await discoverApi.getFeed(nextPage, 10)
      setPosts((prev) => (nextPage === 1 ? result.posts : [...prev, ...result.posts]))
      setHasMore(result.hasMore)
      setPage(nextPage)
    } catch {
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPage(1)
  }, [loadPage])

  // Which slide is on screen drives video autoplay -- and loads the next
  // page once the viewer nears the end of what's loaded.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const id = entry.target.getAttribute('data-post-id')
            if (id) setActiveId(id)
          }
        }
      },
      { root, threshold: [0.6] },
    )

    slideRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [posts])

  const handleScroll = () => {
    const root = containerRef.current
    if (!root || loadingRef.current || !hasMore) return
    const nearEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - root.clientHeight * 1.5
    if (nearEnd) loadPage(page + 1)
  }

  const handleOpenProduct = (post: DiscoverPost, productId?: string) => {
    setSheet({ products: post.products, initialProductId: productId, discoverPostId: post.id })
    // Product-card-open ranking signal -- fire-and-forget, never blocks
    // the sheet from opening.
    getEventTracker().trackDiscoverEvent('discover_product_card_open', post.id, { productId })
  }

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <Link
        to="/"
        className="absolute left-4 top-4 z-10 rounded-full bg-black/40 p-2 text-white"
        aria-label="Back to home"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {posts.length === 0 && loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-white/70">
          Nothing to show yet -- check back soon.
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth"
        >
          {posts.map((post) => (
            <div
              key={post.id}
              data-post-id={post.id}
              ref={(el) => {
                if (el) slideRefs.current.set(post.id, el)
                else slideRefs.current.delete(post.id)
              }}
              className="h-screen w-full snap-start"
            >
              <DiscoverSlide
                post={post}
                isActive={activeId === post.id}
                onOpenProduct={(productId) => handleOpenProduct(post, productId)}
              />
            </div>
          ))}
        </div>
      )}

      {sheet && (
        <ProductBottomSheet
          products={sheet.products}
          initialProductId={sheet.initialProductId}
          discoverPostId={sheet.discoverPostId}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
