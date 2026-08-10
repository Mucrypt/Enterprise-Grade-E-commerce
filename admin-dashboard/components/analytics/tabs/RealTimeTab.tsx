'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, Activity, ShoppingCart, DollarSign, Percent, AlertTriangle } from 'lucide-react'
import { useRealtimeMetrics, useRealtimeAlerts } from '@/hooks/useRealtimeMetrics'
import trendingService from '@/services/trending.service'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ChartCard } from '../ChartCard'
import { AnalyticsTable, AnalyticsTableColumn } from '../AnalyticsTable'
import { DataQualityNotice } from '../DataQualityNotice'
import { formatCurrency, formatPercent } from '../format'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface LiveVisitorRow {
  sessionId: string
  countryName: string | null
  countryCode: string | null
  city: string | null
  deviceType: string
  source: string
  utmCampaign: string | null
  pageViews: number
  lastActivityTime: string
}

/**
 * Deliberately reuses the existing WebSocket infrastructure
 * (useRealtimeMetrics/useRealtimeAlerts, already streaming from
 * metrics.broadcaster.ts) rather than a new /analytics/realtime REST
 * endpoint -- there is nothing this tab needs that endpoint doesn't
 * already provide.
 *
 * metrics-update/alert-* and GET /analytics/visitors/live are all GLOBAL,
 * unscoped data (see websocket.service.ts's resolveDashboardAccess and
 * analytics.controller.ts's authorize('admin','super_admin') gate on
 * visitors/live) -- there is no per-market realtime feed to show instead
 * (out of this phase's scope). A market-scoped caller (`access ===
 * 'scoped'`) gets an honest notice here rather than a silent 403 loop on
 * the live-visitor poll or an all-dashes metrics grid that looks broken.
 */
export function RealTimeTab() {
  const { metrics, isConnected, access } = useRealtimeMetrics()
  const { newAlert } = useRealtimeAlerts()

  const { data: liveVisitors } = useQuery({
    queryKey: ['analytics-v2', 'live-visitors'],
    queryFn: () => trendingService.getLiveVisitors(5),
    refetchInterval: 20_000,
    // Never poll this legacy-admin/global-only endpoint for a caller we
    // already know isn't global -- avoids repeated 403 noise for
    // MARKET_MANAGER and never even attempts it while access is still
    // 'pending' (the very first render, before 'registered' arrives).
    enabled: access === 'global',
  })

  const columns: AnalyticsTableColumn<LiveVisitorRow>[] = [
    { key: 'location', header: 'Location', render: (r) => (r.city ? `${r.city}, ${r.countryCode || '?'}` : r.countryName || r.countryCode || 'Unknown') },
    { key: 'device', header: 'Device', render: (r) => <span className='capitalize'>{r.deviceType}</span> },
    { key: 'source', header: 'Source', render: (r) => r.source || 'direct' },
    { key: 'campaign', header: 'Campaign', render: (r) => r.utmCampaign || '—' },
    { key: 'pageViews', header: 'Page Views', align: 'right', render: (r) => r.pageViews },
    {
      key: 'lastActivity',
      header: 'Last Activity',
      align: 'right',
      render: (r) => new Date(r.lastActivityTime).toLocaleTimeString(),
    },
  ]

  if (access === 'pending') {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-32 rounded' />
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-24 rounded-lg' />
          ))}
        </div>
      </div>
    )
  }

  if (access !== 'global') {
    return (
      <DataQualityNotice
        variant='banner'
        message={
          access === 'scoped'
            ? 'Real-time metrics are global-only today -- there is no per-market live stream yet, so nothing is shown here rather than the global numbers relabeled as yours.'
            : 'Real-time metrics are not available for this account.'
        }
      />
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <Badge variant={isConnected ? 'default' : 'secondary'}>
          <Activity className='mr-1 h-3 w-3' />
          {isConnected ? 'Live' : 'Connecting...'}
        </Badge>
        {newAlert && (
          <Badge variant='destructive'>
            <AlertTriangle className='mr-1 h-3 w-3' />
            New alert: {newAlert.title}
          </Badge>
        )}
      </div>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
        <MetricCard label='Active Visitors' value={metrics ? metrics.activeUsers : '—'} icon={Users} />
        <MetricCard label='Events/sec' value={metrics ? metrics.eventsPerSecond.toFixed(1) : '—'} icon={Activity} />
        <MetricCard label='Orders (last hour)' value={metrics ? metrics.lastHourOrders : '—'} icon={ShoppingCart} />
        <MetricCard
          label='Revenue (last hour)'
          value={metrics ? formatCurrency(metrics.lastHourRevenue) : '—'}
          icon={DollarSign}
        />
        <MetricCard
          label='Conversion'
          value={metrics && typeof metrics.conversionRate === 'number' ? formatPercent(metrics.conversionRate) : '—'}
          icon={Percent}
        />
        <MetricCard
          label='Active Alerts'
          value={
            metrics
              ? metrics.activeAlerts.critical + metrics.activeAlerts.high + metrics.activeAlerts.medium + metrics.activeAlerts.low
              : '—'
          }
          icon={AlertTriangle}
          goodDirection='down'
        />
      </div>

      <ChartCard title='Live Visitors'>
        <AnalyticsTable
          columns={columns}
          rows={(liveVisitors?.visitors || []) as unknown as LiveVisitorRow[]}
          rowKey={(r) => r.sessionId}
          emptyTitle='No active visitors right now'
        />
      </ChartCard>
    </div>
  )
}
