import type { ComponentType } from 'react'
import { cn } from '../../utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  className?: string
}

export function EmptyState({ title, description, icon: Icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center', className)}>
      {Icon && <Icon className='mb-2 h-6 w-6 text-gray-400' />}
      <p className='text-sm font-medium text-gray-700'>{title}</p>
      {description && <p className='mt-1 text-xs text-gray-500'>{description}</p>}
    </div>
  )
}
