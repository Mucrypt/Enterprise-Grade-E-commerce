'use client'

import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AttentionCard, type AttentionItem } from '@/components/dashboard/AttentionCard'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  ShoppingCart,
  Users,
  Percent,
  Globe2,
  ListTodo,
  Activity,
  History,
} from 'lucide-react'

const currency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(value)

/**
 * Command Center -- the shell established this phase (ADMIN-2A), not the
 * full redesign. Every panel below is either wired to a REAL existing data
 * source (useRealtimeMetrics, already streaming from the API's
 * metrics.broadcaster) or an honest EmptyState naming which later phase
 * wires it up -- never a fabricated number or chart. See
 * docs/ADMIN-PLATFORM-2-ROADMAP.md Part K/L for the full design and phased
 * plan (Analytics 2.0 in ADMIN-2B, role-specific "My Work"/attention-queue
 * data in ADMIN-2C).
 *
 * Does not replace /dashboard -- reachable as its own page so nothing
 * about the current default landing experience changes in this phase.
 */
export default function CommandCenterPage() {
  const { metrics, isConnected } = useRealtimeMetrics()
  const { legacyUserType, memberships, isLegacyAdmin } = useStaffAccess()

  const alertItems: AttentionItem[] = metrics
    ? [
        { label: 'Critical alerts', count: metrics.activeAlerts.critical, severity: 'critical', href: '/dashboard/analytics' },
        { label: 'High severity alerts', count: metrics.activeAlerts.high, severity: 'high', href: '/dashboard/analytics' },
        { label: 'Medium severity alerts', count: metrics.activeAlerts.medium, severity: 'medium' },
        { label: 'Low severity alerts', count: metrics.activeAlerts.low, severity: 'low' },
      ]
    : []

  const roleLabel = isLegacyAdmin
    ? legacyUserType
    : memberships.map((m) => m.role).join(', ') || 'No staff role'

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Command Center</h1>
          <p className='text-muted-foreground'>What needs your attention right now.</p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='outline'>{roleLabel}</Badge>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            <Activity className='mr-1 h-3 w-3' />
            {isConnected ? 'Live' : 'Connecting...'}
          </Badge>
        </div>
      </div>

      {/* BUSINESS PULSE -- real, from useRealtimeMetrics */}
      <section>
        <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Business pulse</h2>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            label='Revenue (last hour)'
            value={metrics ? currency(metrics.lastHourRevenue) : '—'}
            icon={DollarSign}
          />
          <MetricCard
            label='Orders (last hour)'
            value={metrics ? metrics.lastHourOrders : '—'}
            icon={ShoppingCart}
          />
          <MetricCard
            label='Conversion rate'
            value={metrics ? `${metrics.conversionRate.toFixed(2)}%` : '—'}
            icon={Percent}
          />
          <MetricCard
            label='Active visitors'
            value={metrics ? metrics.activeUsers : '—'}
            icon={Users}
          />
        </div>
        <p className='mt-2 text-xs text-muted-foreground'>
          AOV, gross margin, refund rate, and checkout abandonment are proposed for Analytics
          2.0 (ADMIN-2B) -- not shown here because they aren&apos;t reliably computed yet.
        </p>
      </section>

      {/* NEEDS ATTENTION -- alerts are real (the 040 repair migration this
          phase depends on); everything else needing a dedicated
          aggregation query is an honest placeholder, not fabricated. */}
      <section>
        <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Needs attention</h2>
        <div className='grid gap-4 lg:grid-cols-2'>
          <AttentionCard title='Active alerts' items={alertItems} />
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Operational queues</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={ListTodo}
                title='Not wired up yet'
                description='Orders awaiting action, payment/shipping failures, low stock, and support backlog need a dedicated aggregation endpoint -- proposed for ADMIN-2C in docs/ADMIN-PLATFORM-2-ROADMAP.md, not built this phase.'
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* LIVE BUSINESS -- top countries is real from useRealtimeMetrics */}
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

      {/* MARKET PERFORMANCE -- explicitly deferred to ADMIN-2D, after the
          Global Commerce countries/markets schema exists to group by. */}
      <section>
        <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Market performance</h2>
        <EmptyState
          icon={Globe2}
          title='Market breakdown arrives with Global Commerce'
          description='Per-market panels (EU/USA/Cameroon/...) need the countries/markets schema from docs/GLOBAL-COMMERCE-ARCHITECTURE.md -- proposed for ADMIN-2D, deliberately not built ahead of that schema existing.'
        />
      </section>

      {/* RECENT ACTIVITY -- a global cross-membership feed needs a new
          endpoint (today's staff_audit_log is queried per-membership from
          the Staff detail view); not built this phase. */}
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
