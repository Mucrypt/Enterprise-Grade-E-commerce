'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import analyticsV2Service, { ProductSort, ProductIntelligenceRow } from '@/services/analytics-v2.service'
import type { UseAnalyticsFiltersReturn } from '../useAnalyticsFilters'
import { AnalyticsFilterBar } from '../AnalyticsFilterBar'
import { AnalyticsTable, AnalyticsTableColumn } from '../AnalyticsTable'
import { ExportButton } from '../ExportButton'
import { DataQualityNotice } from '../DataQualityNotice'
import { formatCurrency, formatNumber, formatPercent } from '../format'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface ProductsTabProps {
  filters: UseAnalyticsFiltersReturn
  onScopeResolved?: (scope: { scoped: boolean; markets: string[] }) => void
}

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'most_revenue', label: 'Most revenue' },
  { value: 'most_viewed', label: 'Most viewed' },
  { value: 'best_conversion', label: 'Best conversion' },
  { value: 'worst_conversion', label: 'Worst conversion' },
  { value: 'highest_demand', label: 'Highest demand' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'high_demand_zero_stock', label: 'High demand + zero stock' },
]

type ProductRow = ProductIntelligenceRow

/**
 * The procurement-facing table -- "what should we source or stock next?"
 * Row click sets the shared productId filter, which every other tab
 * (Sales/Funnel) already reads, so drilling into one product's Sales
 * trend or Funnel is a one-click action from here.
 */
export function ProductsTab({ filters, onScopeResolved }: ProductsTabProps) {
  const [sort, setSort] = useState<ProductSort>('most_revenue')

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-v2', 'products', filters.dateFilters, filters.state.categoryId, sort],
    queryFn: () =>
      analyticsV2Service.getProductIntelligence({
        ...filters.dateFilters,
        categoryId: filters.state.categoryId || undefined,
        sort,
      }),
    staleTime: 60_000,
  })

  if (data) onScopeResolved?.({ scoped: data.scoped, markets: data.markets })

  const columns: AnalyticsTableColumn<ProductRow>[] = [
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
    { key: 'visitors', header: 'Unique Visitors', align: 'right', render: (r) => formatNumber(r.uniqueVisitors) },
    { key: 'carts', header: 'Add to Carts', align: 'right', render: (r) => formatNumber(r.addToCarts) },
    { key: 'purchases', header: 'Purchases', align: 'right', render: (r) => formatNumber(r.purchases) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
    { key: 'conversion', header: 'Conversion', align: 'right', render: (r) => formatPercent(r.conversionRate) },
    { key: 'cartToPurchase', header: 'Cart→Purchase', align: 'right', render: (r) => formatPercent(r.cartToPurchaseRate) },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      render: (r) =>
        r.currentStock === null ? (
          '—'
        ) : (
          <Badge variant={r.currentStock === 0 ? 'destructive' : r.currentStock < 10 ? 'secondary' : 'outline'}>
            {formatNumber(r.currentStock)}
          </Badge>
        ),
    },
    {
      key: 'margin',
      header: 'Margin/unit',
      align: 'right',
      render: (r) => (r.margin ? formatCurrency(r.margin.perUnit) : '—'),
    },
  ]

  return (
    <div className='space-y-4'>
      <AnalyticsFilterBar
        filters={filters}
        visible={[]}
        trailing={
          <>
            <Select value={sort} onValueChange={(v: string) => setSort(v as ProductSort)}>
              <SelectTrigger className='w-56' aria-label='Sort products'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data && <ExportButton filename='product-intelligence.csv' rows={data.products} />}
          </>
        }
      />

      {isLoading ? (
        <Skeleton className='h-96 rounded-lg' />
      ) : data ? (
        <>
          <AnalyticsTable
            columns={columns}
            rows={data.products}
            rowKey={(r) => r.productId}
            onRowClick={(r) => filters.setField('productId', r.productId)}
            emptyTitle='No product activity in this period'
          />
          <div className='space-y-1'>
            {data.dataQuality.currencyNote && <DataQualityNotice variant='banner' message={data.dataQuality.currencyNote} />}
            <DataQualityNotice message={data.dataQuality.checkoutStartsNote} />
            <DataQualityNotice message={data.dataQuality.marginNote} />
            <DataQualityNotice message={data.dataQuality.stockNote} />
          </div>
        </>
      ) : null}
    </div>
  )
}
