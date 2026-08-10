'use client'

import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import analyticsV2Service, { SalesDataPayload } from '@/services/analytics-v2.service'
import type { UseAnalyticsFiltersReturn } from '../useAnalyticsFilters'
import { AnalyticsFilterBar } from '../AnalyticsFilterBar'
import { ChartCard } from '../ChartCard'
import { AnalyticsTable, AnalyticsTableColumn } from '../AnalyticsTable'
import { ExportButton } from '../ExportButton'
import { MixedCurrencyNotice } from '../MixedCurrencyNotice'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { formatCurrency, formatNumber, formatPercent } from '../format'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, Package, RotateCcw, XCircle } from 'lucide-react'

interface SalesTabProps {
  filters: UseAnalyticsFiltersReturn
  onScopeResolved?: (scope: { scoped: boolean; markets: string[] }) => void
}

export function SalesTab({ filters, onScopeResolved }: SalesTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-v2', 'sales', filters.dateFilters, filters.state.productId, filters.state.categoryId],
    queryFn: () =>
      analyticsV2Service.getSales({
        ...filters.dateFilters,
        productId: filters.state.productId || undefined,
        categoryId: filters.state.categoryId || undefined,
      }),
    staleTime: 60_000,
  })

  if (data) onScopeResolved?.({ scoped: data.scoped, markets: data.markets })

  const productColumns: AnalyticsTableColumn<SalesDataPayload['revenueByProduct'][number]>[] = [
    { key: 'product', header: 'Product', render: (r) => <span className='font-medium'>{r.productName}</span> },
    { key: 'sku', header: 'SKU', render: (r) => r.sku },
    { key: 'units', header: 'Units Sold', align: 'right', render: (r) => formatNumber(r.unitsSold) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
  ]

  const countryColumns: AnalyticsTableColumn<{ country: string; orders: number; revenue: number }>[] = [
    { key: 'country', header: 'Country', render: (r) => r.country },
    { key: 'orders', header: 'Orders', align: 'right', render: (r) => formatNumber(r.orders) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
  ]

  return (
    <div className='space-y-4'>
      <AnalyticsFilterBar filters={filters} visible={[]} />

      {isLoading ? (
        <Skeleton className='h-64 rounded-lg' />
      ) : data && data.mixedCurrencies ? (
        <MixedCurrencyNotice message={data.message} breakdown={data.currencyBreakdown} />
      ) : data ? (
        <>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <MetricCard label='Units Sold' value={formatNumber(data.unitsSold)} icon={Package} />
            <MetricCard
              label='Total Revenue'
              value={formatCurrency(data.trend.reduce((sum, d) => sum + d.revenue, 0))}
              icon={DollarSign}
            />
            <MetricCard label='Cancellation Rate' value={formatPercent(data.cancellationRate)} icon={XCircle} goodDirection='down' />
            <MetricCard
              label='Refund Rate'
              value={data.refundRate === null ? 'Unavailable' : formatPercent(data.refundRate)}
              icon={RotateCcw}
              goodDirection='down'
            />
          </div>

          <ChartCard title='Revenue Trend' action={<ExportButton filename='sales-trend.csv' rows={data.trend} />}>
            {data.trend.length === 0 ? (
              <p className='py-8 text-center text-sm text-muted-foreground'>No sales in this period.</p>
            ) : (
              <ResponsiveContainer width='100%' height={280}>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='date' fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type='monotone' dataKey='revenue' stroke='#f97316' strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div className='grid gap-4 lg:grid-cols-2'>
            <ChartCard title='Revenue by Product' action={<ExportButton filename='revenue-by-product.csv' rows={data.revenueByProduct} />}>
              <AnalyticsTable columns={productColumns} rows={data.revenueByProduct} rowKey={(r) => r.productId} />
            </ChartCard>
            <ChartCard title='Revenue by Country' action={<ExportButton filename='revenue-by-country.csv' rows={data.revenueByCountry} />}>
              <AnalyticsTable columns={countryColumns} rows={data.revenueByCountry} rowKey={(r) => r.country} />
            </ChartCard>
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            <ChartCard title='Order Status'>
              <ul className='space-y-1 text-sm'>
                {data.orderStatusDistribution.map((s) => (
                  <li key={s.status} className='flex justify-between'>
                    <span className='capitalize'>{s.status}</span>
                    <span className='font-medium'>{formatNumber(s.count)}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title='Payment Status'>
              <ul className='space-y-1 text-sm'>
                {data.paymentStatusDistribution.map((s) => (
                  <li key={s.status} className='flex justify-between'>
                    <span className='capitalize'>{s.status}</span>
                    <span className='font-medium'>{formatNumber(s.count)}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </div>

          {!data.dataQuality.refundRateAvailable && (
            <p className='text-xs text-muted-foreground'>Refund rate unavailable -- no refunds table exists in the current schema.</p>
          )}
        </>
      ) : null}
    </div>
  )
}
