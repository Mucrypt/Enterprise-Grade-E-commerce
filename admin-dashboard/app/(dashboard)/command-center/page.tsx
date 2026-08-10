'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import analyticsV2Service from '@/services/analytics-v2.service'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { TrendMetric } from '@/components/analytics/TrendMetric'
import { DataQualityNotice } from '@/components/analytics/DataQualityNotice'
import { formatCurrency, formatPercent } from '@/components/analytics/format'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  ShoppingCart,
  Users,
  Percent,
  Globe2,
  Activity,
  History,
  AlertTriangle,
  PackageX,
  ArrowRight,
} from 'lucide-react'

/**
 * Command Center -- ADMIN-2B rewired every card that has a real backend
 * summary to consume the SAME Analytics 2.0 services the /dashboard/analytics
 * workspace uses (analyticsV2Service.getOverview/getOperations), instead of
 * the ADMIN-2A5-era split between a global-only useRealtimeMetrics path and
 * a separate getMarketOverview call -- one summary service, scope-resolved
 * per caller, consumed from two places. See
 * docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md §23.
 *
 * What's still genuinely separate: the "right now" strip (active visitors,
 * live business feed) stays on useRealtimeMetrics/WebSocket -- that's an
 * instantaneous signal, a fundamentally different concept from the 7-day
 * aggregate Overview/Operations answer, not duplicate logic.
 */
export default function CommandCenterPage() {
  const { legacyUserType, memberships, isLegacyAdmin } = useStaffAccess()
  const { metrics, isConnected } = useRealtimeMetrics()

  const roleLabel = isLegacyAdmin
    ? legacyUserType
    : memberships.map((m) => m.role).join(', ') || 'No staff role'

  const overview = useQuery({
    queryKey: ['command-center', 'overview'],
    queryFn: () => analyticsV2Service.getOverview({ comparisonMode: 'previous_period' }),
    refetchInterval: 60_000,
  })

  const operations = useQuery({
    queryKey: ['command-center', 'operations'],
    queryFn: () => analyticsV2Service.getOperations({ comparisonMode: 'none' }),
    refetchInterval: 60_000,
  })

  const scopeLabel = overview.data?.scoped ? `Scoped: ${overview.data.markets.join(', ') || 'none'}` : 'Global'

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Command Center</h1>
          <p className='text-muted-foreground'>What needs your attention right now.</p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='outline'>{roleLabel}</Badge>
          <Badge variant={overview.data?.scoped ? 'secondary' : 'outline'}>{scopeLabel}</Badge>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            <Activity className='mr-1 h-3 w-3' />
            {isConnected ? 'Live' : 'Connecting...'}
          </Badge>
        </div>
      </div>

      {/* RIGHT NOW -- genuinely real-time, WebSocket-driven, not a period aggregate. */}
      <section>
        <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Right now</h2>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <MetricCard label='Active visitors' value={metrics ? metrics.activeUsers : '—'} icon={Users} />
          <MetricCard label='Orders (last hour)' value={metrics ? metrics.lastHourOrders : '—'} icon={ShoppingCart} />
          <MetricCard
            label='Revenue (last hour)'
            value={metrics ? formatCurrency(metrics.lastHourRevenue) : '—'}
            icon={DollarSign}
          />
        </div>
      </section>

      {/* OVERVIEW -- same analyticsV2Service.getOverview() the Analytics workspace's Overview tab uses. */}
      <section>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-muted-foreground'>Last 30 days</h2>
          <Link href='/dashboard/analytics'>
            <Button variant='ghost' size='sm'>
              Full analytics <ArrowRight className='ml-1 h-3.5 w-3.5' />
            </Button>
          </Link>
        </div>
        {overview.data ? (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <TrendMetric label='Revenue' comparison={overview.data.metrics.revenue} icon={DollarSign} format={formatCurrency} />
            <TrendMetric label='Orders' comparison={overview.data.metrics.orders} icon={ShoppingCart} />
            <TrendMetric
              label='Conversion Rate'
              comparison={overview.data.metrics.conversionRate}
              icon={Percent}
              format={(v) => formatPercent(v)}
            />
            <TrendMetric
              label='Checkout Abandonment'
              comparison={overview.data.metrics.checkoutAbandonmentRate}
              icon={Percent}
              format={(v) => formatPercent(v)}
              goodDirection='down'
            />
          </div>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='h-28 animate-pulse rounded-lg border bg-muted/30' />
            ))}
          </div>
        )}
      </section>

      {/* NEEDS ATTENTION -- same analyticsV2Service.getOperations() the Operations tab uses. */}
      <section>
        <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Needs attention</h2>
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {operations.data?.activeAlerts ? (
                <ul className='space-y-1 text-sm'>
                  <li className='flex justify-between'>
                    <span>Critical</span>
                    <span className='font-medium'>{operations.data.activeAlerts.critical}</span>
                  </li>
                  <li className='flex justify-between'>
                    <span>High</span>
                    <span className='font-medium'>{operations.data.activeAlerts.high}</span>
                  </li>
                  <li className='flex justify-between'>
                    <span>Medium</span>
                    <span className='font-medium'>{operations.data.activeAlerts.medium}</span>
                  </li>
                  <li className='flex justify-between'>
                    <span>Low</span>
                    <span className='font-medium'>{operations.data.activeAlerts.low}</span>
                  </li>
                </ul>
              ) : operations.data ? (
                <EmptyState
                  icon={AlertTriangle}
                  title='Alerts are not market-scoped yet'
                  description={operations.data.dataQuality.alertsNote || undefined}
                />
              ) : (
                <div className='h-24 animate-pulse rounded bg-muted/30' />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Low Stock + High Demand</CardTitle>
            </CardHeader>
            <CardContent>
              {operations.data && operations.data.lowStockHighDemand.length > 0 ? (
                <ul className='space-y-1 text-sm'>
                  {operations.data.lowStockHighDemand.slice(0, 5).map((p) => (
                    <li key={p.productId} className='flex justify-between'>
                      <span className='truncate'>{p.productName}</span>
                      <span className='font-medium'>{p.currentStock} left</span>
                    </li>
                  ))}
                </ul>
              ) : operations.data ? (
                <EmptyState icon={PackageX} title='Nothing urgent right now' />
              ) : (
                <div className='h-24 animate-pulse rounded bg-muted/30' />
              )}
            </CardContent>
          </Card>
        </div>
        {operations.data && (
          <p className='mt-2 text-xs text-muted-foreground'>
            Payment failures: {operations.data.paymentFailures.count} &middot; Cancellations: {operations.data.cancellations}{' '}
            &middot; Overdue shipments: {operations.data.overdueShipments} &middot; Stuck orders:{' '}
            {operations.data.stuckOrders.count}
          </p>
        )}
      </section>

      {/* LIVE BUSINESS -- global only; a scoped caller's own country breakdown lives in Analytics > Country Performance instead, not duplicated here. */}
      {!overview.data?.scoped && (
        <section>
          <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Live business</h2>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center text-base'>
                <Globe2 className='mr-2 h-4 w-4' />
                Visitors by country (live)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics && metrics.topCountries.length > 0 ? (
                <ul className='space-y-1 text-sm'>
                  {metrics.topCountries.map((c) => (
                    <li key={c.countryCode} className='flex justify-between'>
                      <span>{c.countryName || c.countryCode}</span>
                      <span className='font-medium'>{c.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title='No live visitors right now' />
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {overview.data && overview.data.dataQuality.marginCoveragePercent < 90 && (
        <DataQualityNotice
          variant='banner'
          message={`Gross margin figures are based on ${overview.data.dataQuality.marginCoveragePercent.toFixed(0)}% of revenue -- see Analytics > Overview for detail.`}
        />
      )}

      {/* RECENT ACTIVITY -- a global cross-membership feed needs a new
          endpoint (today's staff_audit_log is queried per-membership from
          the Staff detail view); not built this phase. Not scope-sensitive
          -- same honest placeholder for every role. */}
      <section>
        <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Recent activity</h2>
        <EmptyState
          icon={History}
          title='Global activity feed not built yet'
          description='Per-staff-member audit history is already available from Organization -> Staff -> (select a person). A combined cross-organization feed is proposed for ADMIN-2C.'
        />
      </section>
    </div>
  )
}
