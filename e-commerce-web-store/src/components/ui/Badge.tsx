import type { ReactNode } from 'react'
import { cn } from '../../utils'

type BadgeVariant = 'sale' | 'featured' | 'neutral' | 'success'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  sale: 'bg-red-500 text-white',
  featured: 'bg-orange-500 text-white',
  neutral: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
}

export function Badge({
  children,
  variant = 'neutral',
  className,
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-bold',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
