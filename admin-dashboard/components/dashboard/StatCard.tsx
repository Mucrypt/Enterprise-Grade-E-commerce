import type { LucideIcon } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type StatCardStatus = 'default' | 'good' | 'warning' | 'critical'

const STATUS_STYLES: Record<StatCardStatus, { badge: string; icon: string; line: string }> = {
  default: {
    badge: 'bg-muted',
    icon: 'text-muted-foreground',
    line: 'var(--muted-foreground)',
  },
  good: {
    badge: 'bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    line: '#10b981',
  },
  warning: {
    badge: 'bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
    line: '#f59e0b',
  },
  critical: {
    badge: 'bg-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
    line: '#ef4444',
  },
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  sublabel?: string
  status?: StatCardStatus
  sparklineData?: { value: number }[]
  loading?: boolean
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  status = 'default',
  sparklineData,
  loading,
}: StatCardProps) {
  const styles = STATUS_STYLES[status]

  if (loading) {
    return (
      <Card>
        <CardContent className='space-y-3 pt-6'>
          <Skeleton className='h-8 w-8 rounded-lg' />
          <Skeleton className='h-3 w-20' />
          <Skeleton className='h-7 w-24' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className='pt-6'>
        <div className='flex items-start justify-between'>
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', styles.badge)}>
            <Icon className={cn('h-4 w-4', styles.icon)} />
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className='h-8 w-20'>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart data={sparklineData}>
                  <Line
                    type='monotone'
                    dataKey='value'
                    stroke={styles.line}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <p className='mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          {label}
        </p>
        <p className='mt-1 text-2xl font-semibold tabular-nums'>{value}</p>
        {sublabel && <p className='mt-1 text-xs text-muted-foreground'>{sublabel}</p>}
      </CardContent>
    </Card>
  )
}
