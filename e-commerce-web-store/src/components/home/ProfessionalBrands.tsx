// ============================================
// Professional Brands
//
// Real brand records only (brandsApi.getAll). Uses a real
// logo when the brand record provides one, otherwise a
// clean text-based presentation - no fabricated logos or
// manufacturer partnerships. No "/brands" index route exists
// in this app yet, so no "View all brands" link is rendered
// (would otherwise point to a route that does not exist).
// Renders nothing when there are no active brands, matching
// the honest-empty-state pattern already used elsewhere in
// this codebase (e.g. the existing FlashDealsSection).
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Brand } from '../../types'
import { brandsApi } from '../../api'
import { homepageConfig } from '../../config/homepage.config'

export default function ProfessionalBrands() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadBrands() {
      try {
        const data = await brandsApi.getAll()
        if (cancelled) return
        setBrands(
          data
            .filter((brand) => brand.is_active)
            .slice(0, homepageConfig.brands.displayLimit),
        )
      } catch (error) {
        console.error('Failed to load brands:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBrands()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && brands.length === 0) return null

  const { heading, description } = homepageConfig.brands

  return (
    <section aria-label='Professional brands' className='border-t border-slate-200 bg-white py-16 sm:py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='max-w-2xl'>
          <h2 className='text-3xl font-black tracking-tight text-slate-900 sm:text-4xl'>
            {heading}
          </h2>
          <p className='mt-3 text-base text-slate-600'>{description}</p>
        </div>

        {loading ? (
          <div className='mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8'>
            {[...Array(homepageConfig.brands.displayLimit)].map((_, i) => (
              <div
                key={i}
                className='h-20 animate-pulse rounded-md border border-slate-200 bg-slate-100'
              />
            ))}
          </div>
        ) : (
          <ul className='mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8'>
            {brands.map((brand) => (
              <li key={brand.id}>
                <Link
                  to={`/brand/${brand.slug}`}
                  className='flex h-20 items-center justify-center rounded-md border border-slate-200 bg-white px-3 grayscale transition-all hover:grayscale-0 hover:border-slate-900 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-slate-900'
                >
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className='max-h-10 max-w-full object-contain'
                    />
                  ) : (
                    <span className='text-center text-sm font-bold text-slate-700'>
                      {brand.name}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
