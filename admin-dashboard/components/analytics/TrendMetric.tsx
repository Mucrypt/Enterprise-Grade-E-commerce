import { MetricCard } from '@/components/dashboard/MetricCard'
import type { PeriodComparison } from '@/services/analytics-v2.service'

interface TrendMetricProps {
  label: string
  comparison: PeriodComparison
  icon?: React.ComponentType<{ className?: string }>
  /** How to render `comparison.value` -- e.g. currency/percent/plain number. */
  format?: (value: number) => string
  /** 'down' for metrics where a decrease is the good outcome (refund rate, abandonment rate, ...). */
  goodDirection?: 'up' | 'down'
}

/**
 * Adapts a backend PeriodComparison ({value, previousValue,
 * absoluteChange, percentChange}, all already NaN/Infinity/null-safe --
 * see analytics-query.helpers.ts) into the existing MetricCard's
 * {direction, label} trend shape. The one place this component has to
 * think about is percentChange === null (no comparison period, or the
 * previous period was legitimately zero) -- rendered as no trend line at
 * all rather than a fabricated 0%/arrow.
 */
export function TrendMetric({ label, comparison, icon, format, goodDirection = 'up' }: TrendMetricProps) {
  const displayValue = format ? format(comparison.value) : comparison.value.toLocaleString()

  if (comparison.percentChange === null) {
    return <MetricCard label={label} value={displayValue} icon={icon} />
  }

  const direction = comparison.percentChange > 0 ? 'up' : comparison.percentChange < 0 ? 'down' : 'flat'
  const sign = comparison.percentChange > 0 ? '+' : ''

  return (
    <MetricCard
      label={label}
      value={displayValue}
      icon={icon}
      goodDirection={goodDirection}
      trend={{
        direction,
        label: `${sign}${comparison.percentChange.toFixed(1)}% vs previous period`,
      }}
    />
  )
}
