'use client'

import { useQuery } from '@tanstack/react-query'
import analyticsV2Service, { CountryPerformanceRow } from '@/services/analytics-v2.service'
import type { UseAnalyticsFiltersReturn } from '../useAnalyticsFilters'
import { AnalyticsFilterBar } from '../AnalyticsFilterBar'
import { AnalyticsTable, AnalyticsTableColumn } from '../AnalyticsTable'
import { ExportButton } from '../ExportButton'
import { DataQualityNotice } from '../DataQualityNotice'
import { formatCurrency, formatNumber, formatPercent } from '../format'
import { Skeleton } from '@/components/ui/skeleton'

interface CountryPerformanceTabProps {
  filters: UseAnalyticsFiltersReturn
  onScopeResolved?: (scope: { scoped: boolean; markets: string[] }) => void
}

/**
 * Explicitly labeled "Country Performance" everywhere in the UI too, not
 * "Markets" -- the real Markets workspace needs the Global Commerce
 * countries/markets schema, which doesn't exist yet (see the backend
 * endpoint's own header comment). This is a preview.
 */
export function CountryPerformanceTab({ filters, onScopeResolved }: CountryPerformanceTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-v2', 'country-performance', filters.dateFilters],
    queryFn: () => analyticsV2Service.getCountryPerformance(filters.dateFilters),
    staleTime: 60_000,
  })

  if (data) onScopeResolved?.({ scoped: data.scoped, markets: data.markets })

  const columns: AnalyticsTableColumn<CountryPerformanceRow>[] = [
    { key: 'country', header: 'Country', render: (r) => r.country },
    { key: 'visitors', header: 'Visitors', align: 'right', render: (r) => formatNumber(r.visitors) },
    { key: 'orders', header: 'Orders', align: 'right', render: (r) => formatNumber(r.orders) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
    { key: 'conversion', header: 'Conversion', align: 'right', render: (r) => formatPercent(r.conversionRate) },
    { key: 'topProduct', header: 'Top Product', render: (r) => r.topProduct?.productName || '—' },
    { key: 'topSearch', header: 'Top Search', render: (r) => r.topSearch?.query || '—' },
    { key: 'topChannel', header: 'Top Channel', render: (r) => r.topChannel || '—' },
  ]

  return (
    <div className='space-y-4'>
      <AnalyticsFilterBar
        filters={filters}
        visible={[]}
        trailing={data && <ExportButton filename='country-performance.csv' rows={data.countries} />}
      />

      {isLoading ? (
        <Skeleton className='h-96 rounded-lg' />
      ) : data ? (
        <>
          <AnalyticsTable columns={columns} rows={data.countries} rowKey={(r) => r.country} />
          <DataQualityNotice message={data.dataQuality.note} />
        </>
      ) : null}
    </div>
  )
}
