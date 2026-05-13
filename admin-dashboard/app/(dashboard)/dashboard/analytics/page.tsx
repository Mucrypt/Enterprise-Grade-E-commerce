'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  ShoppingCart,
  Users,
  Eye,
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { trendingService } from '@/services/trending.service'
import { useRealtimeMetrics, useRealtimeAlerts } from '@/hooks/useRealtimeMetrics'
import type { RevenueTrendPoint, ConversionFunnelStep, TopProductMetric, Alert } from '@/types/events'

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  
  // Real-time metrics from WebSocket
  const { metrics: realtimeMetrics, isConnected: metricsConnected, error: metricsError } = useRealtimeMetrics()
  const { newAlert, acknowledgedAlert, dismissedAlert, isConnected: alertsConnected } = useRealtimeAlerts()

  // Fetch historical analytics data
  const { data: revenueTrend, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-trend', period],
    queryFn: () => trendingService.getRevenueTrend(period === 'week' ? 7 : 30),
  })

  const { data: conversionFunnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['conversion-funnel', period],
    queryFn: () => trendingService.getConversionFunnel(period === 'week' ? 7 : 30),
  })

  const { data: topProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['top-products', period],
    queryFn: () => trendingService.getTopProducts(period === 'week' ? 7 : 30, 5),
  })

  const { data: searchMetrics, isLoading: searchLoading } = useQuery({
    queryKey: ['search-metrics', period],
    queryFn: () => trendingService.getSearchMetrics(period === 'week' ? 7 : 30),
  })

  const { data: refundRate, isLoading: refundLoading } = useQuery({
    queryKey: ['refund-rate'],
    queryFn: () => trendingService.getRefundRate(30),
  })

  const { data: returnRate, isLoading: returnLoading } = useQuery({
    queryKey: ['return-rate'],
    queryFn: () => trendingService.getReturnRate(30),
  })

  const { data: checkoutMetrics, isLoading: checkoutLoading } = useQuery({
    queryKey: ['checkout-abandonment'],
    queryFn: () => trendingService.getCheckoutAbandonment(7),
  })

  const isLoading = revenueLoading || funnelLoading || productsLoading || searchLoading;

  // Calculate summary metrics
  const totalRevenue = realtimeMetrics?.lastHourRevenue || revenueTrend?.summary?.totalRevenue || 0
  const totalOrders = realtimeMetrics?.lastHourOrders || revenueTrend?.summary?.totalOrders || 0
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const conversionRate = realtimeMetrics?.conversionRate || conversionFunnel?.summary?.overallConversionRate || 0
  const activeUsers = realtimeMetrics?.activeUsers || 0

  return (
    <div className='space-y-6'>
      {/* Header with Connection Status */}
      <div className='flex justify-between items-start'>
        <div>
          <h1 className='text-3xl font-bold'>Analytics Dashboard</h1>
          <p className='text-muted-foreground'>Real-time store performance metrics</p>
        </div>
        <div className='flex gap-4 items-center'>
          <div className='flex items-center gap-2 px-3 py-2 rounded-lg bg-muted'>
            {metricsConnected ? (
              <>
                <Wifi className='h-4 w-4 text-green-600' />
                <span className='text-sm font-medium text-green-600'>Live</span>
              </>
            ) : (
              <>
                <WifiOff className='h-4 w-4 text-red-600' />
                <span className='text-sm font-medium text-red-600'>Offline</span>
              </>
            )}
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                period === 'week'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                period === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className='grid gap-4 md:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Active Users</CardTitle>
            <Users className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{activeUsers}</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <Activity className='h-3 w-3' />
              <span>Last 5 minutes</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Revenue (1h)</CardTitle>
            <DollarSign className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>${totalRevenue.toFixed(2)}</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <TrendingUp className='h-3 w-3 text-green-500' />
              <span>{totalOrders} orders</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Avg Order Value</CardTitle>
            <ShoppingCart className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>${avgOrderValue.toFixed(2)}</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <Activity className='h-3 w-3' />
              <span>Per transaction</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Conversion Rate</CardTitle>
            <TrendingUp className='h-4 w-4 text-purple-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{parseFloat(conversionRate as unknown as string).toFixed(2)}%</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <Activity className='h-3 w-3' />
              <span>View to purchase</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Checkout Abandon %</CardTitle>
            <AlertTriangle className='h-4 w-4 text-orange-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{checkoutMetrics?.abandonmentRate?.toFixed(1) || '0'}%</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <Activity className='h-3 w-3' />
              <span>Last 24 hours</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel Section */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <BarChart3 className='h-5 w-5' />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {funnelLoading ? (
            <div className='h-64 flex items-center justify-center'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : conversionFunnel?.funnel && conversionFunnel.funnel.length > 0 ? (
            <div className='space-y-4'>
              {conversionFunnel.funnel.map((step: ConversionFunnelStep) => (
                <div key={step.step} className='space-y-2'>
                  <div className='flex justify-between items-center'>
                    <span className='capitalize font-medium'>
                      {step.step.replace(/_/g, ' ')}
                    </span>
                    <span className='text-sm text-muted-foreground'>
                      {step.eventCount} events • {step.uniqueUsers} users
                    </span>
                  </div>
                  <div className='w-full bg-muted rounded-full h-3 overflow-hidden'>
                    <div
                      className='bg-linear-to-r from-blue-500 to-blue-600 h-full'
                      style={{
                        width: `${Math.min((step.eventCount / (conversionFunnel.funnel[0]?.eventCount || 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {step.conversionRate.toFixed(1)}% conversion
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='h-64 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>No conversion data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quality Metrics Row */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>Refund Rate</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between'>
              <span className='text-3xl font-bold'>{refundRate?.refundRate?.toFixed(1) || '0'}%</span>
              <div className={`p-3 rounded-lg ${parseFloat(refundRate?.refundRate) > 5 ? 'bg-red-100' : 'bg-green-100'}`}>
                {parseFloat(refundRate?.refundRate) > 5 ? (
                  <AlertTriangle className='h-5 w-5 text-red-600' />
                ) : (
                  <Check className='h-5 w-5 text-green-600' />
                )}
              </div>
            </div>
            <p className='text-xs text-muted-foreground'>
              {refundRate?.totalRefunds || 0} of {refundRate?.totalOrders || 0} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>Return Rate</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between'>
              <span className='text-3xl font-bold'>{returnRate?.returnRate?.toFixed(1) || '0'}%</span>
              <div className={`p-3 rounded-lg ${parseFloat(returnRate?.returnRate) > 3 ? 'bg-orange-100' : 'bg-green-100'}`}>
                {parseFloat(returnRate?.returnRate) > 3 ? (
                  <AlertCircle className='h-5 w-5 text-orange-600' />
                ) : (
                  <Check className='h-5 w-5 text-green-600' />
                )}
              </div>
            </div>
            <p className='text-xs text-muted-foreground'>
              {returnRate?.totalReturns || 0} of {returnRate?.totalShipped || 0} shipped
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>Search Quality</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between'>
              <span className='text-3xl font-bold'>
                {searchMetrics?.zeroResultRate?.toFixed(1) || '0'}%
              </span>
              <div className={`p-3 rounded-lg ${(searchMetrics?.zeroResultRate || 0) > 10 ? 'bg-red-100' : 'bg-green-100'}`}>
                {(searchMetrics?.zeroResultRate || 0) > 10 ? (
                  <AlertOctagon className='h-5 w-5 text-red-600' />
                ) : (
                  <Check className='h-5 w-5 text-green-600' />
                )}
              </div>
            </div>
            <p className='text-xs text-muted-foreground'>
              {searchMetrics?.zeroResultSearches || 0} zero-result searches
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Products Section */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <TrendingUp className='h-5 w-5' />
            Top Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <div className='h-64 flex items-center justify-center'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : topProducts?.topProducts && topProducts.topProducts.length > 0 ? (
            <div className='space-y-4'>
              {topProducts.topProducts.map((product: TopProductMetric) => (
                <div key={product.productId} className='space-y-2'>
                  <div className='flex justify-between items-start'>
                    <div>
                      <p className='font-medium'>{product.productName}</p>
                      <p className='text-xs text-muted-foreground'>
                        {product.viewCount} views • {product.addToCartCount} added • {product.purchaseCount} purchased
                      </p>
                    </div>
                    <p className='font-semibold text-green-600'>${product.revenue.toFixed(2)}</p>
                  </div>
                  <div className='w-full bg-muted rounded-full h-2 overflow-hidden'>
                    <div
                      className='bg-linear-to-r from-emerald-500 to-emerald-600 h-full'
                      style={{
                        width: `${Math.min((product.conversionRate / 100) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className='text-xs text-muted-foreground text-right'>
                    {product.conversionRate.toFixed(1)}% conversion rate
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className='h-64 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>No product data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Loading State */}
      {isLoading && (
        <div className='text-center py-4'>
          <div className='flex items-center justify-center gap-2 text-muted-foreground'>
            <RefreshCw className='h-4 w-4 animate-spin' />
            <span>Updating analytics...</span>
          </div>
        </div>
      )}
    </div>
  )
}
