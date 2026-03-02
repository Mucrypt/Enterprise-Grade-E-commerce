// ============================================
// Brand Showcase Section
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Brand } from '../../types'
import { brandsApi } from '../../api'
import { cn } from '../../utils'

export default function BrandShowcase() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBrands()
  }, [])

  async function loadBrands() {
    try {
      const data = await brandsApi.getAll()
      setBrands(data.filter((b) => b.is_active).slice(0, 8))
    } catch (error) {
      console.error('Failed to load brands:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className='py-12 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='flex items-center justify-between mb-8'>
          <div>
            <h2 className='text-2xl md:text-3xl font-black text-gray-900'>
              Top Brands
            </h2>
            <p className='text-gray-600 mt-1'>
              Shop from trusted manufacturers
            </p>
          </div>
          <Link
            to='/brands'
            className='hidden md:flex items-center gap-1 text-orange-500 hover:text-orange-600 font-semibold'
          >
            All Brands
            <ChevronRight className='w-5 h-5' />
          </Link>
        </div>

        {/* Brands Grid */}
        {loading ? (
          <div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4'>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className='bg-gray-100 rounded-xl h-24 animate-pulse'
              />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4'>
            {brands.map((brand) => (
              <Link
                key={brand.id}
                to={`/brand/${brand.slug}`}
                className='group flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-orange-50 hover:shadow-md transition-all'
              >
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className='h-12 object-contain grayscale group-hover:grayscale-0 transition-all'
                  />
                ) : (
                  <div className='h-12 flex items-center justify-center'>
                    <span className='text-lg font-bold text-gray-400 group-hover:text-orange-500 transition-colors'>
                      {brand.name}
                    </span>
                  </div>
                )}
                <p className='mt-2 text-xs text-gray-500 group-hover:text-orange-600 text-center'>
                  {brand.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
