// ============================================
// Tools Hero
//
// No stock/fabricated photography: the right-side mosaic uses real,
// in-stock catalog product photos (productsApi.getFeatured, same
// in-stock-first filter FeaturedProfessionalTools already uses), never
// a licensed/placeholder image. Renders the plain gradient hero (no
// mosaic) while products are loading or if none are in stock, so this
// never shows a broken image or an empty gap.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Product } from '../../types'
import { productsApi } from '../../api'
import { formatPrice, getProductImage } from '../../utils'
import { homepageConfig } from '../../config/homepage.config'

export default function ToolsHero() {
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    homepageConfig.hero

  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    let cancelled = false

    productsApi
      .getFeatured(12)
      .then((data) => {
        if (cancelled) return
        const inStock = data.filter((p) => p.is_active && p.total_stock > 0)
        setProducts(inStock.slice(0, 4))
      })
      .catch(() => setProducts([]))

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section
      aria-label='TechTools professional tools and workshop equipment'
      className='relative overflow-hidden bg-[#0f1420]'
    >
      {/* Warm radial glow -- continues the orange/red promo-bar energy
          from the top of the page into the hero instead of a flat, cold
          B2B-SaaS gradient. */}
      <div
        aria-hidden='true'
        className='absolute -right-1/4 top-1/2 h-[140%] w-[70%] -translate-y-1/2 rounded-full opacity-30 blur-3xl'
        style={{
          background:
            'radial-gradient(closest-side, #f97316, transparent 70%)',
        }}
      />
      <div
        aria-hidden='true'
        className='absolute inset-0 opacity-[0.06]'
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className='relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-8 lg:px-8 lg:py-24'>
        <div className='max-w-2xl'>
          <span className='inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-orange-400'>
            {eyebrow}
          </span>

          <h1 className='mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl'>
            {headline}
          </h1>

          <p className='mt-6 max-w-xl text-lg leading-relaxed text-slate-300'>
            {description}
          </p>

          <div className='mt-10 flex flex-col gap-4 sm:flex-row'>
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

        {/* Real, in-stock product mosaic -- the site's actual catalog,
            not stock photography, so the hero reads as a real store
            front page rather than a text-only SaaS landing hero. */}
        {products.length > 0 && (
          <div className='relative hidden grid-cols-2 gap-4 lg:grid'>
            {products.map((product, index) => (
              <Link
                key={product.id}
                to={`/product/${product.slug}`}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-transform hover:-translate-y-1 ${
                  index === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'
                }`}
              >
                <img
                  src={getProductImage(product, { w: 500, h: 500 })}
                  alt={product.name}
                  loading='eager'
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
                <div className='absolute inset-0 flex items-end bg-linear-to-t from-black/70 via-transparent to-transparent p-4'>
                  <div>
                    <p className='line-clamp-1 text-xs font-semibold text-white/90'>
                      {product.name}
                    </p>
                    <p className='text-sm font-black text-orange-400'>
                      {formatPrice(product.sale_price || product.base_price)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
