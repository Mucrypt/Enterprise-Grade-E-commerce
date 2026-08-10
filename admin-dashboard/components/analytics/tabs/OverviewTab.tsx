'use client'

import { useQuery } from '@tanstack/react-query'
import { DollarSign, ShoppingCart, Percent, Users, LogOut, RotateCcw, Repeat, TrendingUp } from 'lucide-react'
import analyticsV2Service from '@/services/analytics-v2.service'
import type { UseAnalyticsFiltersReturn } from '../useAnalyticsFilters'
import { AnalyticsFilterBar } from '../AnalyticsFilterBar'
import { TrendMetric } from '../TrendMetric'
import { DataQualityNotice } from '../DataQualityNotice'
import { formatCurrency, formatPercent } from '../format'
import { Skeleton } from '@/components/ui/skeleton'

interface OverviewTabProps {
  filters: UseAnalyticsFiltersReturn
  onScopeResolved?: (scope: { scoped: boolean; markets: string[] }) => void
}

/**
 * The executive summary -- every metric here answers "what is happening?"
 * at a glance, each compared against the previous period. Every value
 * flows through TrendMetric, which only ever renders numbers the backend
 * already ran through safeNumber/safeDivide/compareToPreviousPeriod --
 * this component does no math of its own that could reintroduce a
 * NaN/Infinity/null crash.
 */
export function OverviewTab({ filters, onScopeResolved }: OverviewTabProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-v2', 'overview', filters.dateFilters],
    queryFn: () => analyticsV2Service.getOverview(filters.dateFilters),
    staleTime: 60_000,
  })

  if (data) onScopeResolved?.({ scoped: data.scoped, markets: data.markets })

  return (
    <div className='space-y-4'>
      <AnalyticsFilterBar filters={filters} visible={['comparison']} />

      {isError && (
        <DataQualityNotice variant='banner' message='Could not load the overview -- try again in a moment.' />
      )}

      {isLoading ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className='h-28 rounded-lg' />
          ))}
        </div>
      ) : data ? (
        <>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <TrendMetric label='Revenue' comparison={data.metrics.revenue} icon={DollarSign} format={formatCurrency} />
            <TrendMetric label='Orders' comparison={data.metrics.orders} icon={ShoppingCart} />
            <TrendMetric label='Average Order Value' comparison={data.metrics.aov} icon={TrendingUp} format={formatCurrency} />
            <TrendMetric label='Visitors' comparison={data.metrics.visitors} icon={Users} />
            <TrendMetric
              label='Conversion Rate'
              comparison={data.metrics.conversionRate}
              icon={Percent}
              format={(v) => formatPercent(v)}
            />
            <TrendMetric
              label='Checkout Abandonment'
              comparison={data.metrics.checkoutAbandonmentRate}
              icon={LogOut}
              format={(v) => formatPercent(v)}
              goodDirection='down'
            />
            <TrendMetric
              label='Refund Rate'
              comparison={data.metrics.refundRate}
              icon={RotateCcw}
              format={(v) => formatPercent(v)}
              goodDirection='down'
            />
            <TrendMetric
              label='Returning Customer Rate'
              comparison={data.metrics.returningCustomerRate}
              icon={Repeat}
              format={(v) => formatPercent(v)}
            />
          </div>

          <div className='rounded-lg border bg-card p-4'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Gross Margin</span>
              <span className='text-lg font-bold'>{formatCurrency(data.metrics.grossMargin.value)}</span>
            </div>
            {data.dataQuality.marginCoveragePercent < 90 && (
              <DataQualityNotice
                className='mt-2'
                message={`Based on ${data.dataQuality.marginCoveragePercent.toFixed(0)}% of period revenue -- the rest comes from products with no recorded cost price.`}
              />
            )}
          </div>

          <DataQualityNotice variant='banner' message={data.dataQuality.checkoutFunnelNote} />
          {!data.dataQuality.refundRateAvailable && (
            <DataQualityNotice message='Refund rate is not available -- no refunds table exists in the current schema yet.' />
          )}
        </>
      ) : null}
    </div>
  )
}
