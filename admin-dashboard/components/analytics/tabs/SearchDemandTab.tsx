'use client'

import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import analyticsV2Service from '@/services/analytics-v2.service'
import type { UseAnalyticsFiltersReturn } from '../useAnalyticsFilters'
import { AnalyticsFilterBar } from '../AnalyticsFilterBar'
import { ChartCard } from '../ChartCard'
import { AnalyticsTable, AnalyticsTableColumn } from '../AnalyticsTable'
import { DataQualityNotice } from '../DataQualityNotice'
import { formatNumber, formatPercent } from '../format'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface SearchDemandTabProps {
  filters: UseAnalyticsFiltersReturn
  onScopeResolved?: (scope: { scoped: boolean; markets: string[] }) => void
}

interface SearchRow {
  query: string
  count: number
}

interface ProductFunnelRow {
  productId: string
  productName: string
  sku: string
  views: number
  addToCarts: number
  viewToCartRate: number
  cartToPurchaseRate: number
}

const searchColumns: AnalyticsTableColumn<SearchRow>[] = [
  { key: 'query', header: 'Search Query', render: (r) => r.query },
  { key: 'count', header: 'Count', align: 'right', render: (r) => formatNumber(r.count) },
]

/** "What should we source or stock next?" -- answers WHY is it happening for search/demand mismatches. */
export function SearchDemandTab({ filters, onScopeResolved }: SearchDemandTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-v2', 'search-demand', filters.dateFilters],
    queryFn: () => analyticsV2Service.getSearchDemand(filters.dateFilters),
    staleTime: 60_000,
  })

  if (data) onScopeResolved?.({ scoped: data.scoped, markets: data.markets })

  const demandColumns: AnalyticsTableColumn<ProductFunnelRow>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (r) => (
        <div>
          <div className='font-medium'>{r.productName}</div>
          <div className='text-xs text-muted-foreground'>{r.sku}</div>
        </div>
      ),
    },
    { key: 'views', header: 'Views', align: 'right', render: (r) => formatNumber(r.views) },
    { key: 'carts', header: 'Add to Carts', align: 'right', render: (r) => formatNumber(r.addToCarts) },
    { key: 'viewToCart', header: 'View→Cart Rate', align: 'right', render: (r) => formatPercent(r.viewToCartRate) },
    { key: 'cartToPurchase', header: 'Cart→Purchase Rate', align: 'right', render: (r) => formatPercent(r.cartToPurchaseRate) },
  ]

  return (
    <div className='space-y-4'>
      <AnalyticsFilterBar filters={filters} visible={[]} />

      {isLoading ? (
        <Skeleton className='h-96 rounded-lg' />
      ) : data ? (
        <>
          <ChartCard title='Search Trend'>
            {data.searchTrend.length === 0 ? (
              <p className='py-8 text-center text-sm text-muted-foreground'>No searches in this period.</p>
            ) : (
              <ResponsiveContainer width='100%' height={220}>
                <LineChart data={data.searchTrend}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='date' fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type='monotone' dataKey='searchCount' name='Searches' stroke='#f97316' strokeWidth={2} dot={false} />
                  <Line type='monotone' dataKey='zeroResultCount' name='Zero-result' stroke='#ef4444' strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div className='grid gap-4 lg:grid-cols-2'>
            <ChartCard title='Top Searches'>
              <AnalyticsTable columns={searchColumns} rows={data.topSearches} rowKey={(r) => r.query} />
            </ChartCard>
            <ChartCard
              title='Zero-Result Searches'
              dataQualityNote='These are searches with no matching product -- real, unmet demand signals for the catalog team.'
            >
              <AnalyticsTable columns={searchColumns} rows={data.zeroResultSearches} rowKey={(r) => r.query} />
            </ChartCard>
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            <ChartCard title='High Views, Low Add-to-Cart'>
              <AnalyticsTable columns={demandColumns} rows={data.highViewLowCart} rowKey={(r) => r.productId} />
            </ChartCard>
            <ChartCard title='High Add-to-Cart, Low Purchase'>
              <AnalyticsTable columns={demandColumns} rows={data.highCartLowPurchase} rowKey={(r) => r.productId} />
            </ChartCard>
          </div>

          <ChartCard title='Viewed Repeatedly But Unavailable'>
            <AnalyticsTable
              columns={[
                { key: 'product', header: 'Product', render: (r) => r.productName },
                { key: 'sku', header: 'SKU', render: (r) => r.sku },
                { key: 'views', header: 'Views', align: 'right', render: (r) => formatNumber(r.viewCount) },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r) => (
                    <Badge variant={r.isActive ? 'secondary' : 'destructive'}>
                      {r.isActive ? 'Out of stock' : 'Inactive'}
                    </Badge>
                  ),
                },
              ]}
              rows={data.productsViewedButUnavailable}
              rowKey={(r) => r.productId}
              emptyTitle='Nothing viewed-but-unavailable this period'
            />
          </ChartCard>

          <DataQualityNotice message={data.dataQuality.note} />
        </>
      ) : null}
    </div>
  )
}
