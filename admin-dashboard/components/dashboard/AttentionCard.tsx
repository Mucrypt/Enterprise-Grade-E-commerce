import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface AttentionItem {
  label: string
  count: number
  href?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
}

const SEVERITY_BADGE: Record<
  NonNullable<AttentionItem['severity']>,
  'destructive' | 'secondary' | 'outline'
> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
}

/**
 * The "what needs my attention right now" panel -- deliberately a list of
 * counts linking to the real place to act, not a chart. Items with
 * count === 0 aren't hidden -- an empty attention list is itself useful
 * signal ("nothing's on fire"), not noise to suppress.
 */
export function AttentionCard({
  title,
  items,
}: {
  title: string
  items: AttentionItem[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-1'>
        {items.map((item) => {
          const row = (
            <div
              className={cn(
                'flex items-center justify-between rounded-md px-2 py-2 text-sm',
                item.href && 'hover:bg-accent transition-colors',
                item.count > 0 && 'font-medium',
              )}
            >
              <span>{item.label}</span>
              <Badge
                variant={item.severity ? SEVERITY_BADGE[item.severity] : 'outline'}
              >
                {item.count}
              </Badge>
            </div>
          )
          return item.href ? (
            <Link key={item.label} href={item.href}>
              {row}
            </Link>
          ) : (
            <div key={item.label}>{row}</div>
          )
        })}
      </CardContent>
    </Card>
  )
}
