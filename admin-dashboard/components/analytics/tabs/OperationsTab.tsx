'use client'

import { useQuery } from '@tanstack/react-query'
import analyticsV2Service from '@/services/analytics-v2.service'
import type { UseAnalyticsFiltersReturn } from '../useAnalyticsFilters'
import { AnalyticsFilterBar } from '../AnalyticsFilterBar'
import { ChartCard } from '../ChartCard'
import { AnalyticsTable, AnalyticsTableColumn } from '../AnalyticsTable'
import { DataQualityNotice } from '../DataQualityNotice'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { formatCurrency, formatNumber } from '../format'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { CreditCard, XCircle, Truck, Clock, PackageX, AlertTriangle } from 'lucide-react'

interface OperationsTabProps {
  filters: UseAnalyticsFiltersReturn
  onScopeResolved?: (scope: { scoped: boolean; markets: string[] }) => void
}

interface LowStockRow {
  productId: string
  productName: string
  sku: string
  addToCartCount: number
  currentStock: number
}

const lowStockColumns: AnalyticsTableColumn<LowStockRow>[] = [
  { key: 'product', header: 'Product', render: (r) => r.productName },
  { key: 'sku', header: 'SKU', render: (r) => r.sku },
  { key: 'demand', header: 'Add to Carts', align: 'right', render: (r) => formatNumber(r.addToCartCount) },
  {
    key: 'stock',
    header: 'Current Stock',
    align: 'right',
    render: (r) => <Badge variant={r.currentStock === 0 ? 'destructive' : 'secondary'}>{formatNumber(r.currentStock)}</Badge>,
  },
]

export function OperationsTab({ filters, onScopeResolved }: OperationsTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-v2', 'operations', filters.dateFilters],
    queryFn: () => analyticsV2Service.getOperations(filters.dateFilters),
    staleTime: 60_000,
  })

  if (data) onScopeResolved?.({ scoped: data.scoped, markets: data.markets })

  return (
    <div className='space-y-4'>
      <AnalyticsFilterBar filters={filters} visible={[]} />

      {isLoading ? (
        <Skeleton className='h-96 rounded-lg' />
      ) : data ? (
        <>
          {data.activeAlerts ? (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <MetricCard label='Critical Alerts' value={data.activeAlerts.critical} icon={AlertTriangle} goodDirection='down' />
              <MetricCard label='High Alerts' value={data.activeAlerts.high} icon={AlertTriangle} goodDirection='down' />
              <MetricCard label='Medium Alerts' value={data.activeAlerts.medium} icon={AlertTriangle} goodDirection='down' />
              <MetricCard label='Low Alerts' value={data.activeAlerts.low} icon={AlertTriangle} goodDirection='down' />
            </div>
          ) : (
            data.dataQuality.alertsNote && <DataQualityNotice variant='banner' message={data.dataQuality.alertsNote} />
          )}

          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <MetricCard
              label='Payment Failures'
              value={`${formatNumber(data.paymentFailures.count)} (${formatCurrency(data.paymentFailures.amount)})`}
              icon={CreditCard}
              goodDirection='down'
            />
            <MetricCard label='Cancellations' value={formatNumber(data.cancellations)} icon={XCircle} goodDirection='down' />
            <MetricCard
              label='Refunds'
              value={data.refunds === null ? 'Unavailable' : formatNumber(data.refunds)}
              icon={XCircle}
              goodDirection='down'
            />
            <MetricCard label='Supplier Import Failures' value={formatNumber(data.supplierImportFailures)} icon={PackageX} goodDirection='down' />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <ChartCard title='Overdue Shipments' dataQualityNote={data.dataQuality.shippingNote}>
              <div className='flex items-center gap-2 text-2xl font-bold'>
                <Truck className='h-5 w-5 text-muted-foreground' />
                {formatNumber(data.overdueShipments)}
              </div>
            </ChartCard>
            <ChartCard title={`Orders Stuck > ${data.stuckOrders.thresholdDays} days`}>
              <div className='flex items-center gap-2 text-2xl font-bold'>
                <Clock className='h-5 w-5 text-muted-foreground' />
                {formatNumber(data.stuckOrders.count)}
              </div>
            </ChartCard>
          </div>

          <ChartCard title='Recent Alerts'>
            <AnalyticsTable
              columns={[
                { key: 'title', header: 'Alert', render: (r: (typeof data.recentAlerts)[number]) => r.title },
                {
                  key: 'severity',
                  header: 'Severity',
                  render: (r: (typeof data.recentAlerts)[number]) => (
                    <Badge variant={r.severity === 'critical' || r.severity === 'high' ? 'destructive' : 'secondary'}>
                      {r.severity}
                    </Badge>
                  ),
                },
                {
                  key: 'triggeredAt',
                  header: 'Triggered',
                  align: 'right',
                  render: (r: (typeof data.recentAlerts)[number]) => new Date(r.triggeredAt).toLocaleString(),
                },
              ]}
              rows={data.recentAlerts}
              rowKey={(r) => r.id}
              emptyTitle={data.activeAlerts ? 'No recent alerts' : 'Not shown for a market-scoped view'}
            />
          </ChartCard>

          <ChartCard title='Low Stock + High Demand' dataQualityNote='Products with real recent demand and 5 or fewer units available -- a procurement priority list.'>
            <AnalyticsTable columns={lowStockColumns} rows={data.lowStockHighDemand} rowKey={(r) => r.productId} />
          </ChartCard>
        </>
      ) : null}
    </div>
  )
}
