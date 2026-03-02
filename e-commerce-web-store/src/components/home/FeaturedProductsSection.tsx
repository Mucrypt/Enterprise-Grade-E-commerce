// ============================================
// Featured Products Section
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Star, TrendingUp } from 'lucide-react'
import { Product } from '../../types'
import { productsApi } from '../../api'
import ProductCard from '../common/ProductCard'
import { cn } from '../../utils'

type TabType = 'featured' | 'bestsellers' | 'new'

const tabs: {
  id: TabType
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'featured', label: 'Featured', icon: Star },
  { id: 'bestsellers', label: 'Best Sellers', icon: TrendingUp },
  { id: 'new', label: 'New Arrivals', icon: Star },
]

export default function FeaturedProductsSection() {
  const [activeTab, setActiveTab] = useState<TabType>('featured')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [activeTab])

  async function loadProducts() {
    setLoading(true)
    try {
      // For now, we'll use the same endpoint - you can customize based on tab
      const data = await productsApi.getFeatured(12)
      setProducts(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className='py-12 bg-gray-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header with Tabs */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8'>
          <h2 className='text-2xl md:text-3xl font-black text-gray-900'>
            Popular Products
          </h2>

          {/* Tabs */}
          <div className='flex items-center gap-2 bg-white rounded-full p-1 shadow-sm'>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all',
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                )}
              >
                <tab.icon className='w-4 h-4' />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'>
            {[...Array(12)].map((_, i) => (
              <div key={i} className='bg-white rounded-xl h-72 animate-pulse' />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* View All Button */}
        <div className='mt-8 text-center'>
          <Link
            to='/products'
            className='inline-flex items-center gap-2 px-8 py-3 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-all shadow-md hover:shadow-lg'
          >
            View All Products
            <ChevronRight className='w-5 h-5' />
          </Link>
        </div>
      </div>
    </section>
  )
}
