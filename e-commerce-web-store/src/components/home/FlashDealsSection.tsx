// ============================================
// Flash Deals Section - Limited Time Offers
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Zap, ChevronRight, Flame } from 'lucide-react'
import type { Product } from '../../types'
import { productsApi } from '../../api'
import ProductCard from '../common/ProductCard'
import { cn } from '../../utils'

interface TimeLeft {
  hours: number
  minutes: number
  seconds: number
}

export default function FlashDealsSection() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    hours: 5,
    minutes: 27,
    seconds: 13,
  })

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 }
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 }
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 }
        }
        return prev
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  async function loadProducts() {
    try {
      const data = await productsApi.getFeatured(8)
      setProducts(data.slice(0, 8))
    } catch (error) {
      console.error('Failed to load flash deals:', error)
    } finally {
      setLoading(false)
    }
  }

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className='flex flex-col items-center'>
      <div className='bg-gray-900 text-white font-mono text-xl md:text-2xl font-bold px-3 py-2 rounded-lg min-w-12.5 text-center'>
        {String(value).padStart(2, '0')}
      </div>
      <span className='text-xs text-gray-500 mt-1 uppercase'>{label}</span>
    </div>
  )

  return (
    <section className='py-12 bg-linear-to-r from-red-50 via-orange-50 to-yellow-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <div className='w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center animate-pulse'>
                <Flame className='w-7 h-7 text-white' />
              </div>
              <div>
                <h2 className='text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-2'>
                  Flash Deals
                  <Zap className='w-6 h-6 text-yellow-500 fill-yellow-500' />
                </h2>
                <p className='text-sm text-gray-600'>
                  Limited time offers - Don't miss out!
                </p>
              </div>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2 text-gray-600'>
              <Clock className='w-5 h-5 text-red-500' />
              <span className='font-medium'>Ends in:</span>
            </div>
            <div className='flex items-center gap-2'>
              <TimeBlock value={timeLeft.hours} label='hrs' />
              <span className='text-2xl font-bold text-gray-400'>:</span>
              <TimeBlock value={timeLeft.minutes} label='min' />
              <span className='text-2xl font-bold text-gray-400'>:</span>
              <TimeBlock value={timeLeft.seconds} label='sec' />
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            {[...Array(8)].map((_, i) => (
              <div key={i} className='bg-white rounded-xl h-72 animate-pulse' />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            {products.map((product, index) => (
              <div key={product.id} className='relative'>
                {/* Deal Badge */}
                {index < 3 && (
                  <div className='absolute -top-2 -left-2 z-10'>
                    <div
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg',
                        index === 0
                          ? 'bg-red-500'
                          : index === 1
                          ? 'bg-orange-500'
                          : 'bg-yellow-500',
                      )}
                    >
                      {index === 0
                        ? '🔥 HOT'
                        : index === 1
                        ? '⚡ FLASH'
                        : '💰 DEAL'}
                    </div>
                  </div>
                )}
                <ProductCard product={product} variant='compact' />
              </div>
            ))}
          </div>
        )}

        {/* View All Button */}
        <div className='mt-8 text-center'>
          <Link
            to='/sale'
            className='inline-flex items-center gap-2 px-8 py-3 bg-linear-to-r from-red-500 to-orange-500 text-white font-bold rounded-full hover:from-red-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
          >
            View All Deals
            <ChevronRight className='w-5 h-5' />
          </Link>
        </div>
      </div>
    </section>
  )
}
