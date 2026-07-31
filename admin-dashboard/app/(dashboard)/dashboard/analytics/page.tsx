'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  Activity,
  DollarSign,
  ShoppingCart,
  Users,
  Globe,
  Radio,
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
import type { ConversionFunnelStep, TopProductMetric } from '@/types/events'

// Single hue per series, matching this page's existing icon-color language.
const CHART_COLORS = {
  revenue: '#22c55e',
  funnel: '#3b82f6',
  products: '#10b981',
  countries: '#3b82f6',
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  // Real-time metrics from WebSocket
  const {
    metrics: realtimeMetrics,
    isConnected: metricsConnected,
    error: metricsError,
  } = useRealtimeMetrics()
  const { newAlert, acknowledgedAlert, dismissedAlert, isConnected: alertsConnected } =
    useRealtimeAlerts()

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

  // Live visitor analytics -- polling fallback alongside the websocket push,
  // so the table stays fresh even if the socket drops.
  const { data: liveVisitors, isLoading: liveVisitorsLoading } = useQuery({
    queryKey: ['live-visitors'],
    queryFn: () => trendingService.getLiveVisitors(5),
    refetchInterval: 20_000,
  })

  const { data: visitorsByCountry, isLoading: countryLoading } = useQuery({
    queryKey: ['visitors-by-country', period],
    queryFn: () => trendingService.getVisitorsByCountry(period === 'week' ? 7 : 30),
  })

  const { data: channelBreakdown, isLoading: channelLoading } = useQuery({
    queryKey: ['channel-breakdown', period],
    queryFn: () => trendingService.getChannelBreakdown(period === 'week' ? 7 : 30),
  })

  const isLoading = revenueLoading || funnelLoading || productsLoading || searchLoading

  // Calculate summary metrics
  const totalRevenue = realtimeMetrics?.lastHourRevenue || revenueTrend?.summary?.totalRevenue || 0
  const totalOrders = realtimeMetrics?.lastHourOrders || revenueTrend?.summary?.totalOrders || 0
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const conversionRate =
    realtimeMetrics?.conversionRate || conversionFunnel?.summary?.overallConversionRate || 0
  const activeUsers = realtimeMetrics?.activeUsers ?? liveVisitors?.activeCount ?? 0
  const topCountries = realtimeMetrics?.topCountries || []

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
            <CardTitle className='text-sm font-medium'>Active Visitors</CardTitle>
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

      {/* Live Visitors Section */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Radio className='h-5 w-5 text-blue-500' />
            Live Visitors
            {topCountries.length > 0 && (
              <span className='ml-2 flex gap-1'>
                {topCountries.map((c) => (
                  <Badge key={c.countryCode} variant='secondary' className='text-xs'>
                    {c.countryName} ({c.count})
                  </Badge>
                ))}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveVisitorsLoading ? (
            <div className='h-32 flex items-center justify-center'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : liveVisitors?.visitors && liveVisitors.visitors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead className='text-right'>Page Views</TableHead>
                  <TableHead className='text-right'>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveVisitors.visitors.slice(0, 20).map((visitor: any) => (
                  <TableRow key={visitor.sessionId}>
                    <TableCell>
                      {visitor.city ? `${visitor.city}, ` : ''}
                      {visitor.countryName || 'Unknown'}
                    </TableCell>
                    <TableCell className='capitalize'>{visitor.deviceType || 'unknown'}</TableCell>
                    <TableCell className='capitalize'>
                      {visitor.utmSource ? `${visitor.utmSource} / ${visitor.utmMedium || 'n/a'}` : 'Direct'}
                    </TableCell>
                    <TableCell className='max-w-50 truncate text-xs text-muted-foreground'>
                      {visitor.referrer || '—'}
                    </TableCell>
                    <TableCell className='text-right'>{visitor.pageViews}</TableCell>
                    <TableCell className='text-right text-xs text-muted-foreground'>
                      {new Date(visitor.lastActivityTime).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className='h-32 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>No active visitors right now</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <TrendingUp className='h-5 w-5' />
            Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            <div className='h-64 flex items-center justify-center'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : revenueTrend?.data && revenueTrend.data.length > 0 ? (
            <ResponsiveContainer width='100%' height={280}>
              <LineChart data={revenueTrend.data}>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
                <XAxis dataKey='date' tick={{ fontSize: 12 }} stroke='var(--muted-foreground)' />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke='var(--muted-foreground)'
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  formatter={(value: number) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type='monotone'
                  dataKey='revenue'
                  stroke={CHART_COLORS.revenue}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className='h-64 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>No revenue data available</p>
            </div>
          )}
        </CardContent>
      </Card>

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
            <ResponsiveContainer width='100%' height={280}>
              <BarChart
                data={conversionFunnel.funnel.map((step: ConversionFunnelStep) => ({
                  ...step,
                  label: step.step.replace(/_/g, ' '),
                }))}
              >
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
                <XAxis dataKey='label' tick={{ fontSize: 12 }} stroke='var(--muted-foreground)' />
                <YAxis tick={{ fontSize: 12 }} stroke='var(--muted-foreground)' />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value} events (${props.payload.conversionRate.toFixed(1)}%)`,
                    'Count',
                  ]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey='eventCount' fill={CHART_COLORS.funnel} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width='100%' height={Math.max(200, topProducts.topProducts.length * 56)}>
              <BarChart
                layout='vertical'
                data={topProducts.topProducts.map((p: TopProductMetric) => ({
                  ...p,
                  shortName:
                    p.productName.length > 24
                      ? `${p.productName.slice(0, 24)}…`
                      : p.productName,
                }))}
                margin={{ left: 24 }}
              >
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' horizontal={false} />
                <XAxis type='number' tick={{ fontSize: 12 }} stroke='var(--muted-foreground)' />
                <YAxis
                  type='category'
                  dataKey='shortName'
                  width={160}
                  tick={{ fontSize: 12 }}
                  stroke='var(--muted-foreground)'
                />
                <Tooltip
                  formatter={(value: number) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey='revenue' fill={CHART_COLORS.products} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className='h-64 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>No product data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visitors by Country */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Globe className='h-5 w-5 text-blue-500' />
            Visitors by Country
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {countryLoading ? (
            <div className='h-64 flex items-center justify-center'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : visitorsByCountry?.data && visitorsByCountry.data.length > 0 ? (
            <>
              <ResponsiveContainer width='100%' height={240}>
                <BarChart
                  layout='vertical'
                  data={visitorsByCountry.data.slice(0, 10)}
                  margin={{ left: 8 }}
                >
                  <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' horizontal={false} />
                  <XAxis type='number' tick={{ fontSize: 12 }} stroke='var(--muted-foreground)' />
                  <YAxis
                    type='category'
                    dataKey='countryName'
                    width={120}
                    tick={{ fontSize: 12 }}
                    stroke='var(--muted-foreground)'
                  />
                  <Tooltip
                    formatter={(value: number) => [value, 'Sessions']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey='sessionCount' fill={CHART_COLORS.countries} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead className='text-right'>Sessions</TableHead>
                    <TableHead className='text-right'>Unique Visitors</TableHead>
                    <TableHead className='text-right'>Avg. Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitorsByCountry.data.map((row: any) => (
                    <TableRow key={row.countryCode}>
                      <TableCell>{row.countryName}</TableCell>
                      <TableCell className='text-right'>{row.sessionCount}</TableCell>
                      <TableCell className='text-right'>{row.uniqueVisitors}</TableCell>
                      <TableCell className='text-right'>
                        {row.avgDurationSeconds ? `${Math.round(row.avgDurationSeconds / 60)}m` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <div className='h-64 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>No visitor geo data available yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel / UTM Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <BarChart3 className='h-5 w-5' />
            Channel Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {channelLoading ? (
            <div className='h-32 flex items-center justify-center'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : channelBreakdown?.data && channelBreakdown.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Medium</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className='text-right'>Sessions</TableHead>
                  <TableHead className='text-right'>Orders</TableHead>
                  <TableHead className='text-right'>Revenue</TableHead>
                  <TableHead className='text-right'>Conv. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelBreakdown.data.map((row: any, index: number) => (
                  <TableRow key={`${row.utmSource}-${row.utmMedium}-${index}`}>
                    <TableCell className='capitalize'>{row.utmSource}</TableCell>
                    <TableCell className='capitalize'>{row.utmMedium}</TableCell>
                    <TableCell>{row.utmCampaign || '—'}</TableCell>
                    <TableCell className='text-right'>{row.sessionCount}</TableCell>
                    <TableCell className='text-right'>{row.orderCount}</TableCell>
                    <TableCell className='text-right font-medium text-green-600'>
                      ${row.revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className='text-right'>{row.conversionRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className='h-32 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>No channel data available yet</p>
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
