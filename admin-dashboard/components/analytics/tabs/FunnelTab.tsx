'use client'

import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import analyticsV2Service from '@/services/analytics-v2.service'
import type { UseAnalyticsFiltersReturn } from '../useAnalyticsFilters'
import { AnalyticsFilterBar } from '../AnalyticsFilterBar'
import { ChartCard } from '../ChartCard'
import { DataQualityNotice } from '../DataQualityNotice'
import { formatNumber, formatPercent } from '../format'
import { Skeleton } from '@/components/ui/skeleton'

interface FunnelTabProps {
  filters: UseAnalyticsFiltersReturn
  onScopeResolved?: (scope: { scoped: boolean; markets: string[] }) => void
}

const STAGE_COLOR = '#f97316'
const STAGE_COLOR_PARTIAL = '#fdba74'

export function FunnelTab({ filters, onScopeResolved }: FunnelTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: [
      'analytics-v2',
      'funnel',
      filters.dateFilters,
      filters.state.device,
      filters.state.source,
      filters.state.campaign,
      filters.state.productId,
      filters.state.categoryId,
    ],
    queryFn: () =>
      analyticsV2Service.getFunnel({
        ...filters.dateFilters,
        device: filters.state.device || undefined,
        source: filters.state.source || undefined,
        campaign: filters.state.campaign || undefined,
        productId: filters.state.productId || undefined,
        categoryId: filters.state.categoryId || undefined,
      }),
    staleTime: 60_000,
  })

  if (data) onScopeResolved?.({ scoped: data.scoped, markets: data.markets })

  return (
    <div className='space-y-4'>
      <AnalyticsFilterBar filters={filters} visible={['source', 'campaign', 'device']} />

      {isLoading ? (
        <Skeleton className='h-96 rounded-lg' />
      ) : data ? (
        <>
          <DataQualityNotice variant='banner' message={data.dataQuality.note} />

          <ChartCard title='Conversion Funnel'>
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={data.stages} layout='vertical' margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis type='number' fontSize={12} />
                <YAxis type='category' dataKey='label' fontSize={12} width={110} />
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Bar dataKey='count' radius={[0, 4, 4, 0]}>
                  {data.stages.map((stage) => (
                    <Cell key={stage.key} fill={stage.dataQuality === 'partial' ? STAGE_COLOR_PARTIAL : STAGE_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className='mt-2 text-xs text-muted-foreground'>
              <span className='mr-1 inline-block h-2 w-2 rounded-full' style={{ background: STAGE_COLOR_PARTIAL }} />
              Lighter bars = partially instrumented (see note above)
            </p>
          </ChartCard>

          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='p-2 text-left font-medium'>Stage</th>
                  <th className='p-2 text-right font-medium'>Count</th>
                  <th className='p-2 text-right font-medium'>Stage Conversion</th>
                  <th className='p-2 text-right font-medium'>Drop-off</th>
                  <th className='p-2 text-right font-medium'>Drop-off %</th>
                </tr>
              </thead>
              <tbody>
                {data.stages.map((stage) => (
                  <tr key={stage.key} className='border-t'>
                    <td className='p-2'>
                      {stage.label}
                      {stage.dataQuality === 'partial' && (
                        <span className='ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300'>
                          partial
                        </span>
                      )}
                    </td>
                    <td className='p-2 text-right'>{formatNumber(stage.count)}</td>
                    <td className='p-2 text-right'>{formatPercent(stage.stageConversionPercent)}</td>
                    <td className='p-2 text-right'>{formatNumber(stage.dropOffCount)}</td>
                    <td className='p-2 text-right'>{formatPercent(stage.dropOffPercent)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className='border-t bg-muted/30 font-medium'>
                  <td className='p-2'>Overall Conversion</td>
                  <td colSpan={4} className='p-2 text-right'>{formatPercent(data.overallConversionPercent)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
