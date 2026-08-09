import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}

/**
 * Honest "not yet available" state -- used instead of fabricating a
 * number or chart for a panel whose backing data/aggregation doesn't
 * exist yet. Never render a fake metric; render this instead and say
 * what phase wires it up.
 */
export function EmptyState({ title, description, icon: Icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center',
        className,
      )}
    >
      {Icon && <Icon className='mb-2 h-6 w-6 text-muted-foreground' />}
      <p className='text-sm font-medium'>{title}</p>
      {description && (
        <p className='mt-1 text-xs text-muted-foreground'>{description}</p>
      )}
    </div>
  )
}
