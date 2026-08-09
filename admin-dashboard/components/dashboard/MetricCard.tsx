import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  trend?: { direction: 'up' | 'down' | 'flat'; label: string }
  /** Positive trend direction for THIS metric -- e.g. 'up' is good for
   * revenue but 'down' is good for refund rate. Defaults to 'up'. */
  goodDirection?: 'up' | 'down'
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  goodDirection = 'up',
}: MetricCardProps) {
  const isGood = trend && (trend.direction === goodDirection || trend.direction === 'flat')

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>{label}</CardTitle>
        {Icon && <Icon className='h-4 w-4 text-muted-foreground' />}
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {trend && (
          <p
            className={cn(
              'mt-1 flex items-center text-xs',
              isGood ? 'text-emerald-600' : 'text-destructive',
            )}
          >
            {trend.direction === 'up' && <ArrowUp className='mr-1 h-3 w-3' />}
            {trend.direction === 'down' && <ArrowDown className='mr-1 h-3 w-3' />}
            {trend.direction === 'flat' && <Minus className='mr-1 h-3 w-3' />}
            {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
