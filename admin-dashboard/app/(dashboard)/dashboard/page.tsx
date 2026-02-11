'use client'

import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { categoryService } from '@/services/category.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Package,
  FolderTree,
  Grid3x3,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Activity,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productService.getProducts()
      return response?.data?.items || []
    },
  })

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryService.getCategories()
      return response?.data?.categories || []
    },
  })

  const stats = [
    {
      title: 'Total Products',
      value: products?.length || 0,
      icon: Package,
      color: 'bg-blue-500',
      trend: '+12%',
    },
    {
      title: 'Categories',
      value: categories?.length || 0,
      icon: FolderTree,
      color: 'bg-green-500',
      trend: '+3',
    },
    {
      title: 'Collections',
      value: 0,
      icon: Grid3x3,
      color: 'bg-purple-500',
      trend: '+5',
    },
    {
      title: 'Active Users',
      value: '1.2K',
      icon: Users,
      color: 'bg-orange-500',
      trend: '+8%',
    },
    {
      title: 'Total Revenue',
      value: '$45.2K',
      icon: DollarSign,
      color: 'bg-emerald-500',
      trend: '+15%',
    },
    {
      title: 'Orders',
      value: '324',
      icon: ShoppingCart,
      color: 'bg-pink-500',
      trend: '+22',
    },
    {
      title: 'Conversion Rate',
      value: '3.2%',
      icon: TrendingUp,
      color: 'bg-indigo-500',
      trend: '+0.5%',
    },
    {
      title: 'Active Sessions',
      value: '89',
      icon: Activity,
      color: 'bg-cyan-500',
      trend: 'Live',
    },
  ]

  if (productsLoading || categoriesLoading) {
    return (
      <div className='space-y-6'>
        <h1 className='text-3xl font-bold'>Dashboard</h1>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className='h-32' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold text-gray-900 dark:text-gray-100'>
          Dashboard Overview
        </h1>
        <p className='text-gray-600 dark:text-gray-400 mt-2'>
          Welcome to your TechTools admin dashboard. Here's what's happening
          today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.title}
              className='hover:shadow-lg transition-shadow'
            >
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
                <CardTitle className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                  <Icon
                    className={`w-5 h-5 ${stat.color.replace('bg-', 'text-')}`}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold text-gray-900 dark:text-gray-100'>
                  {stat.value}
                </div>
                <p className='text-sm text-green-600 dark:text-green-400 mt-2'>
                  {stat.trend} from last month
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle>Recent Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {products?.slice(0, 5).map((product: any) => (
                <div
                  key={product.id}
                  className='flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                >
                  <div>
                    <p className='font-medium text-gray-900 dark:text-gray-100'>
                      {product.name}
                    </p>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      ${product.price}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      product.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {product.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {categories?.slice(0, 5).map((category: any) => (
                <div
                  key={category.id}
                  className='flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                >
                  <div>
                    <p className='font-medium text-gray-900 dark:text-gray-100'>
                      {category.name}
                    </p>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      {category.slug}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      category.status === 'active'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {category.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
