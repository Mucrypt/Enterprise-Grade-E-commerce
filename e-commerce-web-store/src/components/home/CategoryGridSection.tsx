// ============================================
// Category Grid Section - Shop by Category
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Headphones,
  Lightbulb,
  ShieldCheck,
  Wrench,
  Sofa,
  Gauge,
  Smartphone,
  Sparkles,
  HardHat,
  Car,
  ChevronRight,
} from 'lucide-react'
import type { Category } from '../../types'
import { categoriesApi } from '../../api'
import { cn } from '../../utils'

// Category icon mapping
const categoryIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  'audio-entertainment': Headphones,
  lighting: Lightbulb,
  'safety-security': ShieldCheck,
  'tools-emergency': Wrench,
  'interior-comfort': Sofa,
  'performance-parts': Gauge,
  'phone-gps-mounts': Smartphone,
  'cleaning-maintenance': Sparkles,
  'work-safety-gear': HardHat,
  'exterior-accessories': Car,
}

// Category colors
const categoryColors: Record<
  string,
  { bg: string; text: string; hover: string }
> = {
  'audio-entertainment': {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    hover: 'hover:bg-purple-200',
  },
  lighting: {
    bg: 'bg-amber-100',
    text: 'text-amber-600',
    hover: 'hover:bg-amber-200',
  },
  'safety-security': {
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    hover: 'hover:bg-blue-200',
  },
  'tools-emergency': {
    bg: 'bg-red-100',
    text: 'text-red-600',
    hover: 'hover:bg-red-200',
  },
  'interior-comfort': {
    bg: 'bg-green-100',
    text: 'text-green-600',
    hover: 'hover:bg-green-200',
  },
  'performance-parts': {
    bg: 'bg-orange-100',
    text: 'text-orange-600',
    hover: 'hover:bg-orange-200',
  },
  'phone-gps-mounts': {
    bg: 'bg-cyan-100',
    text: 'text-cyan-600',
    hover: 'hover:bg-cyan-200',
  },
  'cleaning-maintenance': {
    bg: 'bg-teal-100',
    text: 'text-teal-600',
    hover: 'hover:bg-teal-200',
  },
  'work-safety-gear': {
    bg: 'bg-yellow-100',
    text: 'text-yellow-600',
    hover: 'hover:bg-yellow-200',
  },
  'exterior-accessories': {
    bg: 'bg-indigo-100',
    text: 'text-indigo-600',
    hover: 'hover:bg-indigo-200',
  },
}

const defaultColor = {
  bg: 'bg-gray-100',
  text: 'text-gray-600',
  hover: 'hover:bg-gray-200',
}

export default function CategoryGridSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      const data = await categoriesApi.getAll()
      setCategories(data.filter((c) => c.is_active).slice(0, 10))
    } catch (error) {
      console.error('Failed to load categories:', error)
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
              Shop by Category
            </h2>
            <p className='text-gray-600 mt-1'>
              Find exactly what you need for your vehicle
            </p>
          </div>
          <Link
            to='/categories'
            className='hidden md:flex items-center gap-1 text-orange-500 hover:text-orange-600 font-semibold'
          >
            View All
            <ChevronRight className='w-5 h-5' />
          </Link>
        </div>

        {/* Category Grid */}
        {loading ? (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4'>
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className='bg-gray-100 rounded-2xl h-36 animate-pulse'
              />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4'>
            {categories.map((category) => {
              const Icon = categoryIcons[category.slug] || Wrench
              const colors = categoryColors[category.slug] || defaultColor

              return (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  className={cn(
                    'group relative p-6 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg',
                    colors.bg,
                    colors.hover,
                  )}
                >
                  <div
                    className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110',
                      colors.bg,
                    )}
                  >
                    <Icon className={cn('w-8 h-8', colors.text)} />
                  </div>
                  <h3 className='font-semibold text-gray-900 text-sm leading-tight'>
                    {category.name}
                  </h3>
                  {category.product_count && (
                    <p className='text-xs text-gray-500 mt-1'>
                      {category.product_count} items
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Mobile View All */}
        <div className='mt-6 text-center md:hidden'>
          <Link
            to='/categories'
            className='inline-flex items-center gap-1 text-orange-500 hover:text-orange-600 font-semibold'
          >
            View All Categories
            <ChevronRight className='w-5 h-5' />
          </Link>
        </div>
      </div>
    </section>
  )
}
