'use client'

import { useEffect, useState } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
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
  Wifi,
  WifiOff,
} from 'lucide-react'
import { trendingService } from '@/services/trending.service'
import { useRealtimeMetrics, useRealtimeAlerts } from '@/hooks/useRealtimeMetrics'
import type { ConversionFunnelStep, TopProductMetric } from '@/types/events'
import { StatCard } from './components/StatCard'
import { SectionEyebrow } from './components/SectionEyebrow'

type Period = 'today' | 'week' | 'month'

const PERIOD_DAYS: Record<Period, number> = { today: 1, week: 7, month: 30 }
const PERIOD_LABEL: Record<Period, string> = {
  today: 'TODAY',
  week: 'LAST 7 DAYS',
  month: 'LAST 30 DAYS',
}
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7D' },
  { value: 'month', label: '30D' },
]

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
})
const numberFormatter = new Intl.NumberFormat(undefined)

// Single hue per series, matching this page's own icon-color language.
const CHART_COLORS = {
  revenue: '#22c55e',
  funnel: '#3b82f6',
  products: '#10b981',
  countries: '#3b82f6',
}

function SegmentedControl({
  value,
  onChange,
}: {
  value: Period
  onChange: (value: Period) => void
}) {
  return (
    <div className='inline-flex rounded-lg border p-0.5'>
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function CountryBadge({ code }: { code: string }) {
  return (
    <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground'>
      {code === 'XX' ? '—' : code}
    </span>
  )
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  const days = PERIOD_DAYS[period]
  const periodLabel = PERIOD_LABEL[period]

  // Real-time metrics from WebSocket
  const {
    metrics: realtimeMetrics,
    isConnected: metricsConnected,
    error: metricsError,
  } = useRealtimeMetrics()
  const { newAlert, acknowledgedAlert, dismissedAlert, isConnected: alertsConnected } =
    useRealtimeAlerts()

  const [lastMetricsAt, setLastMetricsAt] = useState<number | null>(null)
  useEffect(() => {
    if (realtimeMetrics) setLastMetricsAt(Date.now())
  }, [realtimeMetrics])
  const secondsSinceUpdate = lastMetricsAt ? Math.max(0, Math.floor((now - lastMetricsAt) / 1000)) : null

  // Fetch historical analytics data
  const { data: revenueTrend, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-trend', days],
    queryFn: () => trendingService.getRevenueTrend(days),
  })

  const { data: conversionFunnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['conversion-funnel', days],
    queryFn: () => trendingService.getConversionFunnel(days),
  })

  const { data: topProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['top-products', days],
    queryFn: () => trendingService.getTopProducts(days, 5),
  })

  const { data: searchMetrics, isLoading: searchLoading } = useQuery({
    queryKey: ['search-metrics', days],
    queryFn: () => trendingService.getSearchMetrics(days),
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
    queryKey: ['visitors-by-country', days],
    queryFn: () => trendingService.getVisitorsByCountry(days),
  })

  const { data: channelBreakdown, isLoading: channelLoading } = useQuery({
    queryKey: ['channel-breakdown', days],
    queryFn: () => trendingService.getChannelBreakdown(days),
  })

  // Calculate summary metrics
  const totalRevenue = realtimeMetrics?.lastHourRevenue || revenueTrend?.summary?.totalRevenue || 0
  const totalOrders = realtimeMetrics?.lastHourOrders || revenueTrend?.summary?.totalOrders || 0
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const conversionRate =
    realtimeMetrics?.conversionRate || conversionFunnel?.summary?.overallConversionRate || 0
  const activeUsers = realtimeMetrics?.activeUsers ?? liveVisitors?.activeCount ?? 0
  const topCountries = realtimeMetrics?.topCountries || []
  const revenueSparkline = (revenueTrend?.data || []).map((point: any) => ({ value: point.revenue }))

  return (
    <div className='space-y-6'>
      {/* Header with Connection Status */}
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold'>Analytics</h1>
          <p className='text-muted-foreground'>Store performance and visitor activity</p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm'>
            {metricsConnected ? (
              <Wifi className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
            ) : (
              <WifiOff className='h-3.5 w-3.5 text-red-600 dark:text-red-400' />
            )}
            <span className='font-medium'>{metricsConnected ? 'Live' : 'Offline'}</span>
            {metricsConnected && secondsSinceUpdate !== null && (
              <span className='text-xs text-muted-foreground'>
                · updated {secondsSinceUpdate}s ago
              </span>
            )}
          </div>
          <SegmentedControl value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className='grid gap-4 md:grid-cols-5'>
        <StatCard
          icon={Users}
          label='Active Visitors'
          value={numberFormatter.format(activeUsers)}
          sublabel='Last 5 minutes'
        />
        <StatCard
          icon={DollarSign}
          label='Revenue (1h)'
          value={currencyFormatter.format(totalRevenue)}
          sublabel={`${numberFormatter.format(totalOrders)} orders`}
          sparklineData={revenueSparkline}
        />
        <StatCard
          icon={ShoppingCart}
          label='Avg Order Value'
          value={currencyFormatter.format(avgOrderValue)}
          sublabel='Per transaction'
        />
        <StatCard
          icon={TrendingUp}
          label='Conversion Rate'
          value={`${parseFloat(conversionRate as unknown as string).toFixed(2)}%`}
          sublabel='View to purchase'
        />
        <StatCard
          icon={AlertTriangle}
          label='Checkout Abandon'
          value={`${checkoutMetrics?.abandonmentRate?.toFixed(1) || '0'}%`}
          sublabel='Last 24 hours'
        />
      </div>

      {/* Live Visitors Section */}
      <div>
        <SectionEyebrow>Live now</SectionEyebrow>
        <Card>
          <CardHeader>
            <CardTitle className='flex flex-wrap items-center gap-2'>
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
              <div className='space-y-2'>
                <Skeleton className='h-8 w-full' />
                <Skeleton className='h-8 w-full' />
                <Skeleton className='h-8 w-full' />
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
                      <TableCell className='text-right tabular-nums'>{visitor.pageViews}</TableCell>
                      <TableCell className='text-right text-xs text-muted-foreground'>
                        {new Date(visitor.lastActivityTime).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className='flex h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed'>
                <Radio className='h-6 w-6 text-muted-foreground' />
                <p className='text-muted-foreground'>No active visitors right now</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <div>
        <SectionEyebrow>{periodLabel}</SectionEyebrow>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <TrendingUp className='h-5 w-5' />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className='h-70 w-full' />
            ) : revenueTrend?.data && revenueTrend.data.length > 0 ? (
              <ResponsiveContainer width='100%' height={280}>
                <LineChart data={revenueTrend.data}>
                  <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
                  <XAxis dataKey='date' tick={{ fontSize: 12 }} stroke='var(--muted-foreground)' />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke='var(--muted-foreground)'
                    tickFormatter={(value) => currencyFormatter.format(value)}
                  />
                  <Tooltip
                    formatter={(value: number) => [currencyFormatter.format(Number(value)), 'Revenue']}
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
              <div className='flex h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed'>
                <TrendingUp className='h-6 w-6 text-muted-foreground' />
                <p className='text-muted-foreground'>No revenue data available</p>
              </div>
            )}
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
            <Skeleton className='h-70 w-full' />
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
            <div className='flex h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed'>
              <BarChart3 className='h-6 w-6 text-muted-foreground' />
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
              <span className='text-3xl font-bold tabular-nums'>{refundRate?.refundRate?.toFixed(1) || '0'}%</span>
              <div className={`p-3 rounded-lg ${parseFloat(refundRate?.refundRate) > 5 ? 'bg-red-100 dark:bg-red-500/10' : 'bg-emerald-100 dark:bg-emerald-500/10'}`}>
                {parseFloat(refundRate?.refundRate) > 5 ? (
                  <AlertTriangle className='h-5 w-5 text-red-600 dark:text-red-400' />
                ) : (
                  <Check className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />
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
              <span className='text-3xl font-bold tabular-nums'>{returnRate?.returnRate?.toFixed(1) || '0'}%</span>
              <div className={`p-3 rounded-lg ${parseFloat(returnRate?.returnRate) > 3 ? 'bg-amber-100 dark:bg-amber-500/10' : 'bg-emerald-100 dark:bg-emerald-500/10'}`}>
                {parseFloat(returnRate?.returnRate) > 3 ? (
                  <AlertCircle className='h-5 w-5 text-amber-600 dark:text-amber-400' />
                ) : (
                  <Check className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />
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
              <span className='text-3xl font-bold tabular-nums'>
                {searchMetrics?.zeroResultRate?.toFixed(1) || '0'}%
              </span>
              <div className={`p-3 rounded-lg ${(searchMetrics?.zeroResultRate || 0) > 10 ? 'bg-red-100 dark:bg-red-500/10' : 'bg-emerald-100 dark:bg-emerald-500/10'}`}>
                {(searchMetrics?.zeroResultRate || 0) > 10 ? (
                  <AlertOctagon className='h-5 w-5 text-red-600 dark:text-red-400' />
                ) : (
                  <Check className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />
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
            <Skeleton className='h-64 w-full' />
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
                  formatter={(value: number) => [currencyFormatter.format(Number(value)), 'Revenue']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey='revenue' fill={CHART_COLORS.products} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className='flex h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed'>
              <TrendingUp className='h-6 w-6 text-muted-foreground' />
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
            <Skeleton className='h-64 w-full' />
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
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <CountryBadge code={row.countryCode} />
                          {row.countryName}
                        </div>
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>{row.sessionCount}</TableCell>
                      <TableCell className='text-right tabular-nums'>{row.uniqueVisitors}</TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {row.avgDurationSeconds ? `${Math.round(row.avgDurationSeconds / 60)}m` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <div className='flex h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed'>
              <Globe className='h-6 w-6 text-muted-foreground' />
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
            <Skeleton className='h-32 w-full' />
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
                    <TableCell className='text-right tabular-nums'>{row.sessionCount}</TableCell>
                    <TableCell className='text-right tabular-nums'>{row.orderCount}</TableCell>
                    <TableCell className='text-right font-medium text-emerald-600 dark:text-emerald-400 tabular-nums'>
                      {currencyFormatter.format(row.revenue)}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{row.conversionRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className='flex h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed'>
              <BarChart3 className='h-6 w-6 text-muted-foreground' />
              <p className='text-muted-foreground'>No channel data available yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
