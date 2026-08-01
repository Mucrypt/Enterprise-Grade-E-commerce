'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { categoryService } from '@/services/category.service'
import { collectionService } from '@/services/collection.service'
import { orderService } from '@/services/order.service'
import { trendingService } from '@/services/trending.service'
import supplierService from '@/services/supplier.service'
import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/StatCard'
import { SectionEyebrow } from '@/components/dashboard/SectionEyebrow'
import {
  Package,
  FolderTree,
  Grid3x3,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Gauge,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
})
const numberFormatter = new Intl.NumberFormat(undefined)

export default function DashboardPage() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  const { metrics: realtimeMetrics, isConnected: metricsConnected } =
    useRealtimeMetrics()
  const [lastMetricsAt, setLastMetricsAt] = useState<number | null>(null)
  useEffect(() => {
    if (realtimeMetrics) setLastMetricsAt(Date.now())
  }, [realtimeMetrics])
  const secondsSinceUpdate = lastMetricsAt
    ? Math.max(0, Math.floor((now - lastMetricsAt) / 1000))
    : null

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['dashboard-products'],
    queryFn: async () => {
      const response = await productService.getProducts({ limit: 5 })
      const data = response?.data as any
      const items = data?.items || data?.products || []
      const total = data?.pagination?.total ?? items.length
      return { items, total }
    },
  })

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['dashboard-categories'],
    queryFn: async () => {
      const response = await categoryService.getCategories()
      return response?.data?.categories || []
    },
  })

  const { data: collectionsTotal, isLoading: collectionsLoading } = useQuery({
    queryKey: ['dashboard-collections'],
    queryFn: async () => {
      const response: any = await collectionService.getProductCollections({
        limit: 1,
      })
      return response?.pagination?.total ?? 0
    },
  })

  const { data: orderStats, isLoading: orderStatsLoading } = useQuery({
    queryKey: ['dashboard-order-stats'],
    queryFn: async () => {
      const response = await orderService.getStats()
      return response?.data?.stats
    },
  })

  const { data: conversionFunnel, isLoading: conversionLoading } = useQuery({
    queryKey: ['dashboard-conversion-funnel'],
    queryFn: () => trendingService.getConversionFunnel(1),
  })

  const { data: liveVisitors, isLoading: liveVisitorsLoading } = useQuery({
    queryKey: ['dashboard-live-visitors'],
    queryFn: () => trendingService.getLiveVisitors(5),
    refetchInterval: 20_000,
  })

  const { data: autoPausedResponse, isLoading: autoPausedLoading } = useQuery({
    queryKey: ['ops-auto-paused-products'],
    queryFn: () => supplierService.getAutoPausedProducts(8),
    staleTime: 30_000,
  })

  const autoPausedItems = autoPausedResponse?.data?.items || []

  const liveVisitorCount =
    realtimeMetrics?.activeUsers ?? liveVisitors?.activeCount ?? 0
  const conversionRate =
    realtimeMetrics?.conversionRate ??
    conversionFunnel?.summary?.overallConversionRate ??
    0

  const stats = [
    {
      title: 'Total Products',
      value: numberFormatter.format(productsData?.total ?? 0),
      icon: Package,
      loading: productsLoading,
    },
    {
      title: 'Categories',
      value: numberFormatter.format(categories?.length ?? 0),
      icon: FolderTree,
      loading: categoriesLoading,
    },
    {
      title: 'Collections',
      value: numberFormatter.format(collectionsTotal ?? 0),
      icon: Grid3x3,
      loading: collectionsLoading,
    },
    {
      title: 'Live Visitors',
      value: numberFormatter.format(liveVisitorCount),
      sublabel: 'Last 5 minutes',
      icon: Users,
      loading: liveVisitorsLoading && !realtimeMetrics,
    },
    {
      title: 'Total Revenue',
      value: currencyFormatter.format(orderStats?.totalRevenue ?? 0),
      sublabel: `Today: ${currencyFormatter.format(orderStats?.todayRevenue ?? 0)}`,
      icon: DollarSign,
      loading: orderStatsLoading,
    },
    {
      title: 'Total Orders',
      value: numberFormatter.format(orderStats?.totalOrders ?? 0),
      sublabel: `Today: ${numberFormatter.format(orderStats?.todayOrders ?? 0)}`,
      icon: ShoppingCart,
      loading: orderStatsLoading,
    },
    {
      title: 'Conversion Rate',
      value: `${Number(conversionRate).toFixed(2)}%`,
      sublabel: 'View to purchase',
      icon: TrendingUp,
      loading: conversionLoading && !realtimeMetrics,
    },
    {
      title: 'Avg Order Value',
      value: currencyFormatter.format(orderStats?.averageOrderValue ?? 0),
      sublabel: 'Per transaction',
      icon: Gauge,
      loading: orderStatsLoading,
    },
  ]

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold'>Dashboard Overview</h1>
          <p className='text-muted-foreground'>
            Welcome to your TechTools admin dashboard.
          </p>
        </div>
        <div className='flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm'>
          {metricsConnected ? (
            <Wifi className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
          ) : (
            <WifiOff className='h-3.5 w-3.5 text-red-600 dark:text-red-400' />
          )}
          <span className='font-medium'>
            {metricsConnected ? 'Live' : 'Offline'}
          </span>
          {metricsConnected && secondsSinceUpdate !== null && (
            <span className='text-xs text-muted-foreground'>
              · updated {secondsSinceUpdate}s ago
            </span>
          )}
        </div>
      </div>

      <div>
        <SectionEyebrow>Overview</SectionEyebrow>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {stats.map((stat) => (
            <StatCard
              key={stat.title}
              icon={stat.icon}
              label={stat.title}
              value={stat.value}
              sublabel={stat.sublabel}
              loading={stat.loading}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionEyebrow>Recent activity</SectionEyebrow>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <ShieldAlert className='h-5 w-5 text-amber-500' />
                Ops Auto-Pause Guard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {autoPausedLoading ? (
                <div className='space-y-2'>
                  <Skeleton className='h-8 w-full' />
                  <Skeleton className='h-8 w-full' />
                </div>
              ) : autoPausedItems.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No products are currently auto-paused.
                </p>
              ) : (
                <div className='space-y-2'>
                  {autoPausedItems.map((item: any) => (
                    <div
                      key={item.product_id}
                      className='rounded border p-2 text-sm'
                    >
                      <p className='font-medium'>{item.product_name}</p>
                      <p className='text-xs text-muted-foreground'>
                        SKU {item.sku} · Margin{' '}
                        {Number(item.margin_percent || 0).toFixed(2)}% ·
                        Contribution{' '}
                        {currencyFormatter.format(
                          Number(item.contribution_margin || 0),
                        )}
                      </p>
                      {item.pause_reason && (
                        <p className='mt-1 text-xs text-muted-foreground'>
                          {item.pause_reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Package className='h-5 w-5 text-blue-500' />
                Recent Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className='space-y-2'>
                  <Skeleton className='h-10 w-full' />
                  <Skeleton className='h-10 w-full' />
                </div>
              ) : (productsData?.items ?? []).length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No products yet.
                </p>
              ) : (
                <div className='space-y-4'>
                  {productsData!.items.slice(0, 5).map((product: any) => (
                    <div
                      key={product.id}
                      className='flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors'
                    >
                      <div>
                        <p className='font-medium'>{product.name}</p>
                        <p className='text-sm text-muted-foreground'>
                          {currencyFormatter.format(
                            parseFloat(product.base_price) || 0,
                          )}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          product.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {product.is_active ? 'active' : 'inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <FolderTree className='h-5 w-5 text-green-500' />
                Recent Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className='space-y-2'>
                  <Skeleton className='h-10 w-full' />
                  <Skeleton className='h-10 w-full' />
                </div>
              ) : (categories ?? []).length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No categories yet.
                </p>
              ) : (
                <div className='space-y-4'>
                  {categories!.slice(0, 5).map((category: any) => (
                    <div
                      key={category.id}
                      className='flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors'
                    >
                      <div>
                        <p className='font-medium'>{category.name}</p>
                        <p className='text-sm text-muted-foreground'>
                          {category.slug}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          category.is_active ?? category.isActive
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {(category.is_active ?? category.isActive)
                          ? 'active'
                          : 'inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
