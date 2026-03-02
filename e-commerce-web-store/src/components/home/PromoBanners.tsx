// ============================================
// Promotional Banners Section
// ============================================

import { Link } from 'react-router-dom'
import { Zap, Gift, Truck, Shield, ArrowRight } from 'lucide-react'
import { cn } from '../../utils'

interface PromoBanner {
  id: string
  title: string
  subtitle: string
  cta: string
  link: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  size: 'large' | 'medium' | 'small'
}

const promos: PromoBanner[] = [
  {
    id: '1',
    title: 'Free Shipping',
    subtitle: 'On orders over €50. Fast delivery across Europe.',
    cta: 'Shop Now',
    link: '/products',
    icon: Truck,
    gradient: 'from-emerald-500 to-teal-600',
    size: 'large',
  },
  {
    id: '2',
    title: 'New Arrivals',
    subtitle: 'Check out the latest tech gear',
    cta: 'Explore',
    link: '/new-arrivals',
    icon: Zap,
    gradient: 'from-orange-500 to-red-500',
    size: 'medium',
  },
  {
    id: '3',
    title: '2-Year Warranty',
    subtitle: 'On all products',
    cta: 'Learn More',
    link: '/warranty',
    icon: Shield,
    gradient: 'from-blue-500 to-indigo-600',
    size: 'medium',
  },
  {
    id: '4',
    title: 'Bundle & Save',
    subtitle: 'Get 20% off when you buy 3+ items',
    cta: 'View Bundles',
    link: '/bundles',
    icon: Gift,
    gradient: 'from-purple-500 to-pink-500',
    size: 'small',
  },
]

export default function PromoBanners() {
  return (
    <section className='py-12 bg-gray-100'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {promos.map((promo) => (
            <Link
              key={promo.id}
              to={promo.link}
              className={cn(
                'group relative overflow-hidden rounded-2xl p-6 text-white transition-all duration-300 hover:shadow-xl hover:-translate-y-1',
                `bg-linear-to-br ${promo.gradient}`,
                promo.size === 'large' &&
                  'md:col-span-2 md:row-span-2 lg:col-span-2 lg:row-span-1 md:p-8',
              )}
            >
              {/* Background decoration */}
              <div className='absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2' />
              <div className='absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2' />

              {/* Content */}
              <div className='relative z-10'>
                <promo.icon className='w-10 h-10 mb-4 opacity-90' />
                <h3
                  className={cn(
                    'font-bold mb-2',
                    promo.size === 'large' ? 'text-2xl' : 'text-lg',
                  )}
                >
                  {promo.title}
                </h3>
                <p className='text-white/80 text-sm mb-4'>{promo.subtitle}</p>
                <span className='inline-flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all'>
                  {promo.cta}
                  <ArrowRight className='w-4 h-4' />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
