// ============================================
// Tools Hero
//
// An admin-managed, auto-advancing photo carousel. Every slide comes from
// one real, resolved source of truth (Settings > Hero Slides in the admin
// dashboard) via heroSlidesApi.getPublic() -- no more client-side
// stitching of separately-fetched featured products + featured
// collections + static hero copy. An admin picks exactly which
// products/categories/collections appear, in what order, and can build a
// "product_grid" slide showing several real products together.
//
// Slide types (see hero-slides.controller.ts for the exact resolution
// rules -- a slide is only ever dropped from the response for a missing/
// deactivated reference, never for stock, since an admin-curated pick is
// a deliberate choice):
//  - 'custom' -- a plain marketing banner (own image/copy/CTAs).
//  - 'product' -- one real product; falls back to its own photo when the
//    admin didn't set an image override.
//  - 'category' -- one real category.
//  - 'product_collection' / 'category_collection' -- a real, existing
//    collection's own banner.
//  All five render as the same full-bleed banner (blurred backdrop +
//  object-contain foreground so the real photo is never cropped too
//  tightly, per earlier founder feedback) with bottom-anchored text.
//  - 'product_grid' -- several real products shown together in one
//    slide: a distinct two-column layout (text left, product grid right)
//    since a collage doesn't suit the banner treatment.
//
// Real auto-advance (setInterval, loops back to slide 0) plus manual
// prev/next arrows and clickable dots -- dots/arrows only render when
// there's more than one real slide.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { heroSlidesApi, type HeroSlide } from '../../api'
import { formatPrice, getProductImage } from '../../utils'

const AUTO_ADVANCE_MS = 4500

interface ToolsHeroProps {
  // Which admin-managed slide set to show -- 'homepage' (default) or
  // 'trending'. Same component, same CMS, different curated list.
  placement?: 'homepage' | 'trending'
}

export default function ToolsHero({ placement = 'homepage' }: ToolsHeroProps) {
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    let cancelled = false

    heroSlidesApi
      .getPublic(placement)
      .then((data) => {
        if (!cancelled) setSlides(data)
      })
      .catch(() => {
        if (!cancelled) setSlides([])
      })

    return () => {
      cancelled = true
    }
  }, [placement])

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

  if (slides.length === 0) return null

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
            if (slide.slideType === 'product_grid') return <GridSlide key={slide.id} slide={slide} />
            if (slide.slideType === 'collection_grid') return <CollectionGridSlide key={slide.id} slide={slide} />
            return <BannerSlide key={slide.id} slide={slide} />
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
                  key={slide.id}
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

function slideLink(slide: HeroSlide): string {
  return slide.ctaLink || '/products'
}

function BannerSlide({ slide }: { slide: HeroSlide }) {
  const backgroundImage =
    slide.imageUrl || (slide.product ? getProductImage(slide.product, { w: 1400, h: 700 }) : null)

  const priceLabel =
    slide.slideType === 'product' && slide.product
      ? formatPrice(slide.product.sale_price ?? slide.product.base_price)
      : null

  return (
    <Link to={slideLink(slide)} className='group relative h-full w-full shrink-0 overflow-hidden bg-[#0f1420]'>
      {backgroundImage ? (
        <>
          <img
            src={backgroundImage}
            alt=''
            aria-hidden='true'
            className='absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl'
          />
          <img
            src={backgroundImage}
            alt={slide.title || ''}
            className='absolute inset-0 h-full w-full object-contain p-6 sm:p-10'
          />
        </>
      ) : (
        <div
          aria-hidden='true'
          className='absolute inset-0'
          style={{
            background: 'radial-gradient(circle at 80% 30%, rgba(249,115,22,0.35), transparent 60%), #0f1420',
          }}
        />
      )}
      <div className='absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent' />

      <div className='absolute inset-x-0 bottom-0 max-w-2xl p-8 sm:p-12'>
        {!!slide.eyebrow && (
          <span className='inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-orange-400'>
            {slide.eyebrow}
          </span>
        )}

        {!!slide.title && (
          <h1 className='mt-5 max-w-xl text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl'>
            {slide.title}
          </h1>
        )}

        {priceLabel && <p className='mt-2 text-xl font-black text-orange-400'>{priceLabel}</p>}

        {!!slide.description && (
          <p className='mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg'>{slide.description}</p>
        )}

        <div className='mt-7 flex flex-col gap-4 sm:flex-row'>
          <span className='inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-orange-500/20 transition-colors group-hover:bg-orange-600'>
            {slide.ctaLabel || 'Shop Now'}
            <ArrowRight className='h-4 w-4' aria-hidden='true' />
          </span>
          {!!slide.secondaryCtaLabel && !!slide.secondaryCtaLink && (
            <Link
              to={slide.secondaryCtaLink}
              className='inline-flex items-center justify-center gap-2 rounded-md border border-white/25 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10'
            >
              {slide.secondaryCtaLabel}
            </Link>
          )}
        </div>
      </div>
    </Link>
  )
}

function GridSlide({ slide }: { slide: HeroSlide }) {
  const products = (slide.products || []).slice(0, 4)

  return (
    <div className='relative flex h-full w-full shrink-0 flex-col bg-[#0f1420] sm:flex-row'>
      <div className='flex flex-col justify-center p-8 sm:w-2/5 sm:p-12'>
        {!!slide.eyebrow && (
          <span className='inline-flex w-fit items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-orange-400'>
            {slide.eyebrow}
          </span>
        )}
        {!!slide.title && (
          <h2 className='mt-5 text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl'>
            {slide.title}
          </h2>
        )}
        {!!slide.description && (
          <p className='mt-4 text-base leading-relaxed text-slate-300'>{slide.description}</p>
        )}
        <Link
          to={slideLink(slide)}
          className='mt-7 inline-flex w-fit items-center justify-center gap-2 rounded-md bg-orange-500 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-600'
        >
          {slide.ctaLabel || 'Shop Now'}
          <ArrowRight className='h-4 w-4' aria-hidden='true' />
        </Link>
      </div>

      <div className='grid flex-1 grid-cols-2 gap-2 p-4 sm:gap-3 sm:p-6'>
        {products.map((product) => (
          <Link
            key={product.id}
            to={`/product/${product.slug}`}
            className='group relative overflow-hidden rounded-lg bg-black/20'
          >
            <img
              src={getProductImage(product, { w: 500, h: 500 })}
              alt={product.name}
              className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
            />
            <div className='absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-3'>
              <p className='truncate text-xs font-semibold text-white'>{product.name}</p>
              <p className='text-sm font-black text-orange-400'>
                {formatPrice(product.sale_price ?? product.base_price)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function CollectionGridSlide({ slide }: { slide: HeroSlide }) {
  const collections = (slide.collections || []).slice(0, 4)

  return (
    <div className='relative flex h-full w-full shrink-0 flex-col bg-[#0f1420] sm:flex-row'>
      <div className='flex flex-col justify-center p-8 sm:w-2/5 sm:p-12'>
        {!!slide.eyebrow && (
          <span className='inline-flex w-fit items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-orange-400'>
            {slide.eyebrow}
          </span>
        )}
        {!!slide.title && (
          <h2 className='mt-5 text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl'>
            {slide.title}
          </h2>
        )}
        {!!slide.description && (
          <p className='mt-4 text-base leading-relaxed text-slate-300'>{slide.description}</p>
        )}
        <Link
          to={slideLink(slide)}
          className='mt-7 inline-flex w-fit items-center justify-center gap-2 rounded-md bg-orange-500 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-600'
        >
          {slide.ctaLabel || 'Shop Now'}
          <ArrowRight className='h-4 w-4' aria-hidden='true' />
        </Link>
      </div>

      <div className='grid flex-1 grid-cols-2 gap-2 p-4 sm:gap-3 sm:p-6'>
        {collections.map((collection) => {
          const image = collection.banner_url || collection.image_url
          return (
            <Link
              key={collection.id}
              to={`/collections/${collection.slug}`}
              className='group relative overflow-hidden rounded-lg bg-black/20'
            >
              {image && (
                <img
                  src={image}
                  alt={collection.name}
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
              )}
              <div className='absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-3'>
                <p className='truncate text-sm font-bold text-white'>{collection.name}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
