'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import sourcingService from '@/services/sourcing.service'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PackageSearch, TrendingUp, Percent, XCircle } from 'lucide-react'

/**
 * SOURCING-1 -- pipeline analytics, purely derived from sourced_products
 * (no order/revenue join needed since cost/sale price are captured at
 * commit time). Answers "is the sourcing pipeline actually working" --
 * conversion rate, margin, and which platform is pulling its weight.
 */
function SourcingAnalyticsPageContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['sourcing', 'analytics'],
    queryFn: () => sourcingService.getAnalytics(),
  })

  const analytics = data?.analytics

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Sourcing analytics</h1>
        <p className='text-muted-foreground'>How the Alibaba/Amazon import pipeline is performing, end to end.</p>
      </div>

      {isLoading || !analytics ? (
        <Skeleton className='h-96 rounded-lg' />
      ) : (
        <>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <MetricCard label='Total captured' value={analytics.totals.total} icon={PackageSearch} />
            <MetricCard
              label='Conversion rate'
              value={analytics.totals.conversionRate !== null ? `${analytics.totals.conversionRate}%` : '—'}
              icon={TrendingUp}
            />
            <MetricCard
              label='Avg. margin (published)'
              value={analytics.avgMarginPercent !== null ? `${analytics.avgMarginPercent}%` : '—'}
              icon={Percent}
            />
            <MetricCard label='Rewrite failures' value={analytics.totals.rewriteFailed} icon={XCircle} goodDirection='down' />
          </div>

          <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
            <ChartCard title='Captures, last 30 days' className='lg:col-span-2'>
              {analytics.captureTrend.length === 0 ? (
                <p className='py-8 text-center text-sm text-muted-foreground'>No captures in the last 30 days.</p>
              ) : (
                <ResponsiveContainer width='100%' height={260}>
                  <BarChart data={analytics.captureTrend}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis dataKey='day' fontSize={11} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey='count' fill='#f97316' radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title='By platform'>
              <div className='space-y-4'>
                {analytics.byPlatform.map((p) => (
                  <div key={p.platform} className='space-y-1'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='font-medium capitalize'>{p.platform}</span>
                      <span className='text-muted-foreground'>
                        {p.committed}/{p.total} published
                      </span>
                    </div>
                    <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
                      <div
                        className='h-full bg-orange-500'
                        style={{ width: p.total > 0 ? `${(p.committed / p.total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
                {analytics.byPlatform.length === 0 && <p className='text-sm text-muted-foreground'>No data yet.</p>}
              </div>
            </ChartCard>
          </div>

          <Card>
            <CardContent className='p-0'>
              <div className='flex items-center justify-between border-b p-4'>
                <h2 className='font-semibold'>Recently published</h2>
              </div>
              {analytics.recentCommitted.length === 0 ? (
                <p className='p-6 text-center text-sm text-muted-foreground'>Nothing published yet.</p>
              ) : (
                <div className='divide-y'>
                  {analytics.recentCommitted.map((row) => (
                    <Link
                      key={row.id}
                      href={row.committedProductId ? `/products/${row.committedProductId}/edit` : `/dashboard/sourcing/${row.id}`}
                      className='flex items-center justify-between gap-4 p-4 hover:bg-muted/50'
                    >
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-medium'>{row.title}</p>
                        <p className='text-xs text-muted-foreground'>
                          {row.committedAt ? new Date(row.committedAt).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className='flex shrink-0 items-center gap-3'>
                        <Badge variant='outline' className='capitalize'>
                          {row.sourcePlatform}
                        </Badge>
                        {row.marginPercent !== null && <span className='text-sm font-medium text-green-600'>{row.marginPercent}%</span>}
                        <span className='text-sm font-semibold'>{row.finalSalePrice ? `€${Number(row.finalSalePrice).toFixed(2)}` : '—'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default function SourcingAnalyticsPage() {
  return (
    <RequirePagePermission permission='sourcing.view'>
      <SourcingAnalyticsPageContent />
    </RequirePagePermission>
  )
}
