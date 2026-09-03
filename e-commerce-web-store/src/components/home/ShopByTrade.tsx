// ============================================
// Shop by Trade
//
// Fully data-driven from the real categories API.
// Curated professional copy/icon is applied only when a
// category with a matching slug is actually returned by
// the API (see homepage.config.ts). Any other real,
// active category still renders honestly using its own
// name/description from the API. No category is invented
// and no database id is hardcoded.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Hammer,
  Car,
  Armchair,
  ShieldCheck,
  Siren,
  Music2,
  CarFront,
  Lightbulb,
  SprayCan,
  Smartphone,
  Gauge,
  Wrench,
  ChevronRight,
} from 'lucide-react'
import type { Category } from '../../types'
import { categoriesApi } from '../../api'
import { homepageConfig } from '../../config/homepage.config'

const iconBySlug: Record<string, React.ComponentType<{ className?: string }>> = {
  woodworking: Hammer,
  automotive: Car,
  interior: Armchair,
  safety: ShieldCheck,
  emergency: Siren,
  audio: Music2,
  exterior: CarFront,
  lighting: Lightbulb,
  cleaning: SprayCan,
  mounts: Smartphone,
  performance: Gauge,
}

export default function ShopByTrade() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      try {
        const data = await categoriesApi.getAll()
        if (cancelled) return
        // Top-level only -- the plain (non-tree) categories endpoint
        // returns all ~80+ categories flat, alphabetically, with no
        // parent/child distinction. Without this filter, "Shop by Trade"
        // could show subcategories (e.g. "Adhesives & Sealants") instead
        // of the real trade verticals (e.g. "Home Improvement & Tools").
        setCategories(
          data
            .filter((category) => category.is_active && !category.parent_id)
            .slice(0, homepageConfig.shopByTrade.displayLimit),
        )
      } catch (error) {
        console.error('Failed to load trade categories:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCategories()
    return () => {
      cancelled = true
    }
  }, [])

  const { heading, description, curatedBySlug } = homepageConfig.shopByTrade

  return (
    <section aria-label='Shop by trade' className='bg-white py-16 sm:py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='max-w-2xl'>
          <h2 className='text-3xl font-black tracking-tight text-slate-900 sm:text-4xl'>
            {heading}
          </h2>
          <p className='mt-3 text-base text-slate-600'>{description}</p>
        </div>

        {loading ? (
          <div className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {[...Array(homepageConfig.shopByTrade.displayLimit)].map(
              (_, i) => (
                <div
                  key={i}
                  className='h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-100'
                />
              ),
            )}
          </div>
        ) : categories.length === 0 ? (
          <div className='mt-10 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center'>
            <p className='text-sm text-slate-600'>
              Trade categories are being finalized.{' '}
              <Link
                to={homepageConfig.routes.products}
                className='font-semibold text-orange-600 hover:text-orange-700'
              >
                Browse all products
              </Link>
            </p>
          </div>
        ) : (
          <ul className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {categories.map((category) => {
              const curated = curatedBySlug[category.slug]
              const Icon = curated
                ? iconBySlug[curated.icon] ?? Wrench
                : Wrench
              const title = curated?.title ?? category.name
              const description = curated?.description ?? category.description

              return (
                <li key={category.id}>
                  <Link
                    to={`/category/${category.slug}`}
                    className='group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-slate-900 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-slate-900'
                  >
                    <span className='flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-orange-400 transition-colors group-hover:bg-orange-500 group-hover:text-white'>
                      <Icon className='h-6 w-6' aria-hidden='true' />
                    </span>
                    <h3 className='mt-4 text-lg font-bold text-slate-900'>
                      {title}
                    </h3>
                    {description && (
                      <p className='mt-1.5 flex-1 text-sm leading-relaxed text-slate-600'>
                        {description}
                      </p>
                    )}
                    <span className='mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 group-hover:text-orange-600'>
                      Shop {title}
                      <ChevronRight className='h-4 w-4' aria-hidden='true' />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
