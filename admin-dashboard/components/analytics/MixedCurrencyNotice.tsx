import { DataQualityNotice } from './DataQualityNotice'
import { formatCurrencyWithCode, formatNumber } from './format'
import type { CurrencyBreakdownRow } from '@/services/analytics-v2.service'

interface MixedCurrencyNoticeProps {
  message: string
  breakdown: CurrencyBreakdownRow[]
}

/**
 * Shown instead of a blended metrics/trend/channel view whenever an
 * endpoint's whole-response circuit breaker fires (Overview/Sales/
 * Acquisition -- see analytics-v2.service.ts's MixedCurrencyPayload). This
 * system never sums or converts across currencies, so a mixed period is
 * reported honestly with real per-currency totals instead of a fabricated
 * blended number.
 */
export function MixedCurrencyNotice({ message, breakdown }: MixedCurrencyNoticeProps) {
  return (
    <div className='space-y-3'>
      <DataQualityNotice variant='banner' message={message} />
      <div className='overflow-hidden rounded-lg border'>
        <table className='w-full text-sm'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-3 py-2 text-left font-medium'>Currency</th>
              <th className='px-3 py-2 text-right font-medium'>Orders</th>
              <th className='px-3 py-2 text-right font-medium'>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row) => (
              <tr key={row.currency} className='border-t'>
                <td className='px-3 py-2'>{row.currency}</td>
                <td className='px-3 py-2 text-right'>{formatNumber(row.orderCount)}</td>
                <td className='px-3 py-2 text-right'>{formatCurrencyWithCode(row.revenue, row.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
