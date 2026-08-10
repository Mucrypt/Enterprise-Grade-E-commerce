import { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

interface AnalyticsShellProps {
  title: string
  description: string
  /** Set by whichever tab is active, once its data has loaded -- shows "Scoped to CM" / left off entirely for a global viewer. Passing null before data loads avoids a flash of an incorrect badge. */
  scopeBadge?: { scoped: boolean; markets: string[] } | null
  children: ReactNode
}

/**
 * Outer chrome shared by the whole Analytics 2.0 workspace -- title +
 * scope indicator. The actual navigation is AnalyticsTabs, rendered as
 * this component's children so each page composes them together (kept
 * separate rather than folded into one component, since the page needs to
 * own tab state/URL sync, not this wrapper).
 */
export function AnalyticsShell({ title, description, scopeBadge, children }: AnalyticsShellProps) {
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
          <p className='text-muted-foreground text-sm'>{description}</p>
        </div>
        {scopeBadge && (
          <Badge variant={scopeBadge.scoped ? 'secondary' : 'outline'}>
            {scopeBadge.scoped ? `Scoped: ${scopeBadge.markets.join(', ') || 'none'}` : 'Global'}
          </Badge>
        )}
      </div>
      {children}
    </div>
  )
}
