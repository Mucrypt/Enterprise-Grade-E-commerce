// ============================================
// Category Showcase Banner
//
// A single, spotlight-style banner section driven by the highest-
// position category_collection an admin has marked "featured" in the
// Collections admin page (e.g. "Featured Categories") -- its real name,
// description, banner image, and the real categories linked to it.
// Renders a graceful dark gradient with the collection's own name when
// no banner image has been uploaded yet (matching the mega menu's promo
// tile treatment), so this looks intentional today and gets sharper the
// moment a real banner is uploaded -- never a fabricated stock photo.
//
// Only the single top collection is shown (not every featured one) so
// the homepage gets one confident spotlight moment rather than repeating
// near-identical category grids -- admins control which collection that
// is via is_featured + position, exactly as they already do for
// FeaturedCollectionsShowcase.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { categoryCollectionsApi } from '../../api'
import type { CategoryCollection } from '../../types'

function categoryIconUrl(category: CategoryCollection['categories'][number]): string | null {
  const media = category.media?.find((m) => m.media_purpose === 'icon')
  return media?.cdn_urls?.medium || media?.file_path || media?.url || null
}

const FALLBACK_PALETTE = [
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
]
function fallbackStyle(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]
}

export default function CategoryShowcaseBanner() {
  const [collection, setCollection] = useState<CategoryCollection | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const shells = await categoryCollectionsApi.getFeatured(1)
        const top = shells.find((c) => c.is_active)
        if (!top) return

        const full = await categoryCollectionsApi.getBySlug(top.slug)
        if (!cancelled) setCollection(full)
      } catch (error) {
        console.error('Failed to load category showcase:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && (!collection || collection.categories.length === 0)) return null

  if (loading) {
    return (
      <section aria-label='Shop by collection' className='bg-slate-900 py-16 sm:py-20'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='h-8 w-64 animate-pulse rounded bg-white/10' />
          <div className='mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6'>
            {[...Array(6)].map((_, i) => (
              <div key={i} className='h-28 animate-pulse rounded-xl bg-white/5' />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (!collection) return null

  const bannerImage = collection.banner_url || collection.image_url

  return (
    <section aria-label={collection.name} className='relative overflow-hidden bg-slate-900 py-16 sm:py-20'>
      {bannerImage && (
        <div className='absolute inset-0'>
          <img src={bannerImage} alt='' className='h-full w-full object-cover opacity-30' />
          <div className='absolute inset-0 bg-linear-to-t from-slate-900 via-slate-900/80 to-slate-900/40' />
        </div>
      )}

      <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div className='max-w-2xl'>
            <span className='inline-block rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white'>
              Featured
            </span>
            <h2 className='mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl'>
              {collection.name}
            </h2>
            {(collection.short_description || collection.description) && (
              <p className='mt-3 text-base text-slate-300'>
                {collection.short_description || collection.description}
              </p>
            )}
          </div>
        </div>

        <div className='mt-10 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6'>
          {collection.categories.slice(0, 12).map((category) => {
            const icon = categoryIconUrl(category)
            return (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className='group flex flex-col items-center gap-3 rounded-xl bg-white/5 p-4 text-center backdrop-blur-sm transition-colors hover:bg-white/10'
              >
                {icon ? (
                  <span className='h-14 w-14 overflow-hidden rounded-full shadow-sm transition-transform group-hover:scale-105'>
                    <img src={icon} alt={category.name} className='h-full w-full object-cover' />
                  </span>
                ) : (
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold transition-transform group-hover:scale-105 ${fallbackStyle(category.slug)}`}
                  >
                    {category.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className='text-xs font-semibold text-white/90 group-hover:text-white'>
                  {category.name}
                </span>
              </Link>
            )
          })}
        </div>

        <div className='mt-10'>
          <Link
            to={`/collections/${collection.slug}`}
            className='inline-flex items-center gap-1 text-sm font-bold text-white hover:text-orange-400'
          >
            Explore this collection
            <ArrowRight className='h-4 w-4' aria-hidden='true' />
          </Link>
        </div>
      </div>
    </section>
  )
}
