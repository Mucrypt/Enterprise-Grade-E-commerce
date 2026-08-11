'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import analyticsV2Service, { AcquisitionChannel } from '@/services/analytics-v2.service'
import type { UseAnalyticsFiltersReturn } from '../useAnalyticsFilters'
import { AnalyticsFilterBar } from '../AnalyticsFilterBar'
import { AnalyticsTable, AnalyticsTableColumn } from '../AnalyticsTable'
import { ExportButton } from '../ExportButton'
import { DataQualityNotice } from '../DataQualityNotice'
import { MixedCurrencyNotice } from '../MixedCurrencyNotice'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { formatCurrency, formatNumber, formatPercent } from '../format'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, ShoppingCart, DollarSign } from 'lucide-react'

interface AcquisitionTabProps {
  filters: UseAnalyticsFiltersReturn
  onScopeResolved?: (scope: { scoped: boolean; markets: string[] }) => void
}

export function AcquisitionTab({ filters, onScopeResolved }: AcquisitionTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-v2', 'acquisition', filters.dateFilters],
    queryFn: () => analyticsV2Service.getAcquisition(filters.dateFilters),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (data) onScopeResolved?.({ scoped: data.scoped, markets: data.markets })
  }, [data, onScopeResolved])

  const columns: AnalyticsTableColumn<AcquisitionChannel>[] = [
    { key: 'source', header: 'Source', render: (r) => r.source },
    { key: 'medium', header: 'Medium', render: (r) => r.medium },
    { key: 'campaign', header: 'Campaign', render: (r) => r.campaign || '—' },
    { key: 'sessions', header: 'Sessions', align: 'right', render: (r) => formatNumber(r.sessions) },
    { key: 'views', header: 'Product Views', align: 'right', render: (r) => formatNumber(r.productViews) },
    { key: 'carts', header: 'Add to Carts', align: 'right', render: (r) => formatNumber(r.addToCarts) },
    { key: 'checkouts', header: 'Checkout Starts', align: 'right', render: (r) => formatNumber(r.checkoutStarts) },
    { key: 'orders', header: 'Orders', align: 'right', render: (r) => formatNumber(r.orders) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
    { key: 'conversion', header: 'Conversion', align: 'right', render: (r) => formatPercent(r.conversionRate) },
  ]

  return (
    <div className='space-y-4'>
      <AnalyticsFilterBar
        filters={filters}
        visible={[]}
        trailing={data && !data.mixedCurrencies && <ExportButton filename='acquisition.csv' rows={data.channels} />}
      />

      {isLoading ? (
        <Skeleton className='h-80 rounded-lg' />
      ) : data && data.mixedCurrencies ? (
        <MixedCurrencyNotice message={data.message} breakdown={data.currencyBreakdown} />
      ) : data ? (
        <>
          <div className='grid gap-4 sm:grid-cols-3'>
            <MetricCard label='Total Sessions' value={formatNumber(data.totals.sessions)} icon={Users} />
            <MetricCard label='Total Orders' value={formatNumber(data.totals.orders)} icon={ShoppingCart} />
            <MetricCard label='Total Revenue' value={formatCurrency(data.totals.revenue)} icon={DollarSign} />
          </div>

          <AnalyticsTable columns={columns} rows={data.channels} rowKey={(r) => `${r.source}-${r.medium}-${r.campaign}`} />

          <DataQualityNotice message={data.dataQuality.note} />
        </>
      ) : null}
    </div>
  )
}
