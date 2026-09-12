// ============================================
// Tools Hero
//
// A real, auto-advancing photo carousel -- matches the mobile app's
// ToolsHero exactly (same slide types, same real data, same mechanic),
// kept consistent across both apps rather than web staying a static
// two-column layout while mobile became a rotating carousel:
//
//  1. "Brand" slide -- always present: real homepageConfig/admin-edited
//     copy (Settings > Homepage Content) over a real, in-stock featured
//     product's own photo as the full-bleed background
//     (productsApi.getFeatured, filtered to is_active && total_stock >
//     0) -- falls back to a plain gradient only while that's still
//     loading or none are in stock, never a stock/fabricated photo.
//  2. "Collection" slide -- only when a real, active is_featured
//     product_collection with a real banner_url/image_url exists
//     (collectionsApi.getFeatured), full-bleed with the collection's own
//     name/description and a link to /collections/:slug.
//  3. "Product" slides -- one per additional real in-stock featured
//     product beyond the one used as the brand slide's background, each
//     full-bleed with its real name/price and a link to /product/:slug.
//
// Real auto-advance (setInterval, loops back to slide 0) plus manual
// prev/next arrows and clickable dots -- dots/arrows only render when
// there's more than one real slide.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Product, ProductCollection } from '../../types'
import { productsApi, collectionsApi, homepageSettingsApi } from '../../api'
import { formatPrice, getProductImage } from '../../utils'
import { homepageConfig } from '../../config/homepage.config'

const EXTRA_SLIDE_PRODUCT_COUNT = 5
const AUTO_ADVANCE_MS = 4500

type HeroSlide =
  | { key: string; type: 'brand' }
  | { key: string; type: 'product'; product: Product }
  | { key: string; type: 'collection'; collection: ProductCollection }

export default function ToolsHero() {
  const [copy, setCopy] = useState(homepageConfig.hero)
  const [slideProducts, setSlideProducts] = useState<Product[]>([])
  const [collectionSlide, setCollectionSlide] = useState<ProductCollection | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  // Real, admin-editable copy (Settings > Homepage Content) -- falls back
  // to the static homepage.config.ts values if the request fails or
  // hasn't resolved yet, so the hero is never blank.
  useEffect(() => {
    let cancelled = false

    homepageSettingsApi
      .getPublic()
      .then((settings) => {
        if (cancelled || !settings?.hero) return
        const { hero } = settings
        setCopy({
          eyebrow: hero.eyebrow,
          headline: hero.headline,
          description: hero.description,
          primaryCta: { label: hero.primaryCtaLabel, to: hero.primaryCtaTo },
          secondaryCta: { label: hero.secondaryCtaLabel, to: hero.secondaryCtaTo },
        })
      })
      .catch(() => {
        // Keep the static homepage.config.ts fallback already in state.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const { eyebrow, headline, description, primaryCta, secondaryCta } = copy

  useEffect(() => {
    let cancelled = false

    productsApi
      .getFeatured(12)
      .then((data) => {
        if (cancelled) return
        const inStock = data.filter((p) => p.is_active && p.total_stock > 0)
        setSlideProducts(inStock.slice(0, EXTRA_SLIDE_PRODUCT_COUNT))
      })
      .catch(() => {
        if (!cancelled) setSlideProducts([])
      })

    collectionsApi
      .getFeatured(4)
      .then((data) => {
        if (cancelled) return
        const withImage = data.find((c) => c.is_active && (c.banner_url || c.image_url))
        setCollectionSlide(withImage || null)
      })
      .catch(() => {
        if (!cancelled) setCollectionSlide(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // The brand slide's own real background photo -- the first in-stock
  // featured product, kept distinct from the rest so the same product
  // isn't shown twice in the carousel.
  const heroBackgroundProduct = slideProducts[0] || null
  const remainingSlideProducts = slideProducts.slice(1)

  const slides: HeroSlide[] = [
    { key: 'brand', type: 'brand' },
    ...(collectionSlide
      ? [{ key: `collection-${collectionSlide.id}`, type: 'collection' as const, collection: collectionSlide }]
      : []),
    ...remainingSlideProducts.map((product) => ({
      key: `product-${product.id}`,
      type: 'product' as const,
      product,
    })),
  ]

  // Real auto-advance -- reads activeIndexRef (not activeIndex directly)
  // so it always resumes from wherever the visitor last manually
  // navigated to, instead of a stale closure fighting a dot/arrow click.
  useEffect(() => {
    if (slides.length <= 1) return

    const timer = setInterval(() => {
      setActiveIndex((activeIndexRef.current + 1) % slides.length)
    }, AUTO_ADVANCE_MS)

    return () => clearInterval(timer)
  }, [slides.length])

  const goTo = (index: number) => {
    setActiveIndex(((index % slides.length) + slides.length) % slides.length)
  }

  const heroImageUri = heroBackgroundProduct ? getProductImage(heroBackgroundProduct, { w: 1400, h: 700 }) : null

  return (
    <section
      aria-label='TechTools professional tools and workshop equipment'
      className='relative overflow-hidden bg-[#0f1420]'
    >
      <div className='relative h-105 w-full overflow-hidden sm:h-115 lg:h-125'>
        <div
          className='flex h-full transition-transform duration-500 ease-out'
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {slides.map((slide) => {
            if (slide.type === 'product') {
              const { product } = slide
              const productImage = getProductImage(product, { w: 1400, h: 700 })
              return (
                <Link
                  key={slide.key}
                  to={`/product/${product.slug}`}
                  className='relative h-full w-full shrink-0 overflow-hidden bg-[#0f1420]'
                >
                  <img
                    src={productImage}
                    alt=''
                    aria-hidden='true'
                    className='absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl'
                  />
                  <img
                    src={productImage}
                    alt={product.name}
                    className='absolute inset-0 h-full w-full object-contain p-6 sm:p-10'
                  />
                  <div className='absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent' />
                  <div className='absolute inset-x-0 bottom-0 p-8 sm:p-12'>
                    <h3 className='max-w-xl text-2xl font-black text-white sm:text-3xl'>
                      {product.name}
                    </h3>
                    <p className='mt-2 text-xl font-black text-orange-400'>
                      {formatPrice(product.sale_price ?? product.base_price)}
                    </p>
                    <span className='mt-5 inline-flex items-center gap-2 rounded-md bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white'>
                      Shop Now
                      <ArrowRight className='h-4 w-4' aria-hidden='true' />
                    </span>
                  </div>
                </Link>
              )
            }

            if (slide.type === 'collection') {
              const { collection } = slide
              const image = collection.banner_url || collection.image_url
              return (
                <Link
                  key={slide.key}
                  to={`/collections/${collection.slug}`}
                  className='relative h-full w-full shrink-0 overflow-hidden bg-[#0f1420]'
                >
                  <img
                    src={image as string}
                    alt=''
                    aria-hidden='true'
                    className='absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl'
                  />
                  <img
                    src={image as string}
                    alt={collection.name}
                    className='absolute inset-0 h-full w-full object-contain p-6 sm:p-10'
                  />
                  <div className='absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent' />
                  <div className='absolute inset-x-0 bottom-0 p-8 sm:p-12'>
                    <h3 className='max-w-xl text-2xl font-black text-white sm:text-3xl'>
                      {collection.name}
                    </h3>
                    {!!(collection.short_description || collection.description) && (
                      <p className='mt-2 max-w-xl text-slate-200'>
                        {collection.short_description || collection.description}
                      </p>
                    )}
                    <span className='mt-5 inline-flex items-center gap-2 rounded-md bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white'>
                      Shop Now
                      <ArrowRight className='h-4 w-4' aria-hidden='true' />
                    </span>
                  </div>
                </Link>
              )
            }

            return (
              <div key={slide.key} className='relative h-full w-full shrink-0 overflow-hidden bg-[#0f1420]'>
                {heroImageUri ? (
                  <>
                    <img
                      src={heroImageUri}
                      alt=''
                      aria-hidden='true'
                      className='absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl'
                    />
                    <img
                      src={heroImageUri}
                      alt=''
                      aria-hidden='true'
                      className='absolute inset-0 h-full w-full object-contain p-6 sm:p-10'
                    />
                  </>
                ) : (
                  <div
                    aria-hidden='true'
                    className='absolute inset-0'
                    style={{
                      background:
                        'radial-gradient(circle at 80% 30%, rgba(249,115,22,0.35), transparent 60%), #0f1420',
                    }}
                  />
                )}
                <div className='absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent' />

                <div className='absolute inset-x-0 bottom-0 max-w-2xl p-8 sm:p-12'>
                  <span className='inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-orange-400'>
                    {eyebrow}
                  </span>

                  <h1 className='mt-5 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl'>
                    {headline}
                  </h1>

                  <p className='mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg'>
                    {description}
                  </p>

                  <div className='mt-7 flex flex-col gap-4 sm:flex-row'>
                    <Link
                      to={primaryCta.to}
                      className='inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                    >
                      {primaryCta.label}
                      <ArrowRight className='h-4 w-4' aria-hidden='true' />
                    </Link>
                    <Link
                      to={secondaryCta.to}
                      className='inline-flex items-center justify-center gap-2 rounded-md border border-white/25 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                    >
                      {secondaryCta.label}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {slides.length > 1 && (
          <>
            <button
              type='button'
              aria-label='Previous slide'
              onClick={() => goTo(activeIndex - 1)}
              className='absolute left-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white transition-colors hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white sm:flex'
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            <button
              type='button'
              aria-label='Next slide'
              onClick={() => goTo(activeIndex + 1)}
              className='absolute right-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white transition-colors hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white sm:flex'
            >
              <ChevronRight className='h-5 w-5' />
            </button>

            <div className='absolute inset-x-0 bottom-4 flex justify-center gap-1.5'>
              {slides.map((slide, index) => (
                <button
                  key={slide.key}
                  type='button'
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => goTo(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/45'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
