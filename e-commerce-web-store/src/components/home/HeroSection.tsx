// ============================================
// Hero Section - SHEIN/Amazon Style Slider
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Truck,
  Shield,
  Clock,
} from 'lucide-react'
import { cn, formatPrice } from '../../utils'
import { useFreeShippingThreshold } from '../../hooks/useFreeShippingThreshold'

interface HeroSlide {
  id: number
  title: string
  subtitle: string
  description: string
  cta: string
  ctaLink: string
  bgGradient: string
  image: string
  badge?: string
}

const heroSlides: HeroSlide[] = [
  {
    id: 1,
    title: 'LED Work Lights',
    subtitle: 'Illuminate Your Workspace',
    description:
      'Professional-grade LED work lights and safety glasses for mechanics and DIY enthusiasts. Hands-free lighting solutions.',
    cta: 'Shop Now',
    ctaLink: '/category/work-safety-gear',
    bgGradient: 'from-amber-700 via-orange-800 to-red-900',
    image: '/images/hero/led-lights.png',
    badge: 'NEW ARRIVALS',
  },
  {
    id: 2,
    title: 'Flash Sale',
    subtitle: 'Up to 60% OFF',
    description:
      "Limited time offers on car electronics, dash cams, and audio systems. Grab the deals before they're gone!",
    cta: 'View Deals',
    ctaLink: '/sale',
    bgGradient: 'from-red-600 via-rose-700 to-pink-800',
    image: '/images/hero/flash-sale.png',
    badge: 'HOT DEAL',
  },
  {
    id: 3,
    title: 'Premium Audio',
    subtitle: 'Crystal Clear Sound',
    description:
      'Transform your driving experience with our premium car audio systems. TouchScreen stereos with CarPlay & Android Auto.',
    cta: 'Explore Audio',
    ctaLink: '/category/audio-entertainment',
    bgGradient: 'from-violet-700 via-purple-800 to-indigo-900',
    image: '/images/hero/audio.png',
  },
  {
    id: 4,
    title: 'Safety First',
    subtitle: '4K Dash Cams',
    description:
      'Protect yourself with professional-grade dual dash cams featuring night vision, GPS tracking, and parking surveillance.',
    cta: 'Shop Dash Cams',
    ctaLink: '/category/safety-security',
    bgGradient: 'from-slate-700 via-gray-800 to-zinc-900',
    image: '/images/hero/dashcam.png',
    badge: 'BEST SELLER',
  },
]

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  // Real, admin-configured threshold -- replaces the hand-typed "€50".
  const freeShippingThreshold = useFreeShippingThreshold() ?? 50
  const features = [
    { icon: Truck, label: 'Free Shipping', desc: `On orders over ${formatPrice(freeShippingThreshold)}` },
    { icon: Shield, label: '2-Year Warranty', desc: 'On all products' },
    { icon: Clock, label: '24/7 Support', desc: 'Expert assistance' },
    { icon: Zap, label: 'Fast Delivery', desc: '1-3 business days' },
  ]

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
  }, [])

  const prevSlide = useCallback(() => {
    setCurrentSlide(
      (prev) => (prev - 1 + heroSlides.length) % heroSlides.length,
    )
  }, [])

  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(nextSlide, 5000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, nextSlide])

  return (
    <section className='relative'>
      {/* Main Hero Slider */}
      <div
        className='relative h-125 md:h-150 overflow-hidden'
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {heroSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 transition-all duration-700 ease-in-out',
              index === currentSlide
                ? 'opacity-100 translate-x-0'
                : index < currentSlide
                ? 'opacity-0 -translate-x-full'
                : 'opacity-0 translate-x-full',
            )}
          >
            {/* Background Gradient */}
            <div
              className={cn(
                'absolute inset-0 bg-linear-to-r',
                slide.bgGradient,
              )}
            />

            {/* Decorative Elements */}
            <div className='absolute inset-0 overflow-hidden'>
              <div className='absolute top-20 right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl' />
              <div className='absolute bottom-20 left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl' />
              <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-white/3 rounded-full blur-3xl' />
            </div>

            {/* Content */}
            <div className='relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center'>
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 items-center w-full'>
                {/* Text Content */}
                <div className='text-white space-y-6 z-10'>
                  {slide.badge && (
                    <span className='inline-flex items-center px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-sm font-semibold animate-pulse'>
                      <Zap className='w-4 h-4 mr-2' />
                      {slide.badge}
                    </span>
                  )}

                  <h2 className='text-lg md:text-xl font-medium text-white/80 tracking-wide uppercase'>
                    {slide.subtitle}
                  </h2>

                  <h1 className='text-5xl md:text-7xl font-black tracking-tight leading-none'>
                    {slide.title}
                  </h1>

                  <p className='text-lg md:text-xl text-white/80 max-w-lg leading-relaxed'>
                    {slide.description}
                  </p>

                  <div className='flex flex-wrap gap-4 pt-4'>
                    <Link
                      to={slide.ctaLink}
                      className='group inline-flex items-center px-8 py-4 bg-white text-gray-900 font-bold rounded-full hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
                    >
                      {slide.cta}
                      <ChevronRight className='ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform' />
                    </Link>
                    <Link
                      to='/products'
                      className='inline-flex items-center px-8 py-4 border-2 border-white/50 text-white font-bold rounded-full hover:bg-white/10 hover:border-white transition-all duration-300'
                    >
                      Browse All
                    </Link>
                  </div>
                </div>

                {/* Image/Visual */}
                <div className='hidden lg:flex justify-center items-center relative'>
                  <div className='relative w-100 h-100'>
                    {/* Placeholder for product image - you can add actual images */}
                    <div className='absolute inset-0 bg-linear-to-br from-white/20 to-transparent rounded-3xl backdrop-blur-sm border border-white/20' />
                    <div className='absolute inset-4 bg-white/10 rounded-2xl flex items-center justify-center'>
                      <div className='text-center text-white/60'>
                        <div className='w-32 h-32 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4'>
                          <Zap className='w-16 h-16' />
                        </div>
                        <p className='text-sm'>Product Image</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className='absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all z-20'
          aria-label='Previous slide'
        >
          <ChevronLeft className='w-6 h-6' />
        </button>
        <button
          onClick={nextSlide}
          className='absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all z-20'
          aria-label='Next slide'
        >
          <ChevronRight className='w-6 h-6' />
        </button>

        {/* Slide Indicators */}
        <div className='absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20'>
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={cn(
                'transition-all duration-300 rounded-full',
                index === currentSlide
                  ? 'w-10 h-3 bg-white'
                  : 'w-3 h-3 bg-white/50 hover:bg-white/70',
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Features Bar */}
      <div className='bg-gray-900 text-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10'>
            {features.map((feature, index) => (
              <div
                key={index}
                className='flex items-center justify-center gap-3 py-4 px-2'
              >
                <feature.icon className='w-6 h-6 text-orange-400 shrink-0' />
                <div className='hidden sm:block'>
                  <p className='font-semibold text-sm'>{feature.label}</p>
                  <p className='text-xs text-gray-400'>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
