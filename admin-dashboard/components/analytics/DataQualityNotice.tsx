import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataQualityNoticeProps {
  message: string
  className?: string
  /** 'inline' for a small note under a single metric/chart, 'banner' for a tab-level notice. */
  variant?: 'inline' | 'banner'
}

/**
 * A professional analytics system exposes its own limitations instead of
 * hiding them -- this is the one component every tab uses to say "this
 * number is real but partial/approximate," e.g. mobile funnel
 * instrumentation gaps, margin coverage, or session-derived attribution.
 * Never used to apologize for a bug; only for a genuine, permanent data
 * limitation the underlying schema can't currently resolve.
 */
export function DataQualityNotice({ message, className, variant = 'inline' }: DataQualityNoticeProps) {
  if (variant === 'banner') {
    return (
      <div
        role='note'
        className={cn(
          'flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
          className,
        )}
      >
        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
        <span>{message}</span>
      </div>
    )
  }

  return (
    <p role='note' className={cn('flex items-start gap-1.5 text-xs text-muted-foreground', className)}>
      <AlertTriangle className='mt-0.5 h-3 w-3 shrink-0' />
      <span>{message}</span>
    </p>
  )
}
