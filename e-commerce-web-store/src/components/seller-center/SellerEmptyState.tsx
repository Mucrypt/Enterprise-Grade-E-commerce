import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export default function SellerEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className='rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5'>
      <Icon className='mx-auto h-8 w-8 text-gray-300' />
      <h3 className='mt-3 text-sm font-semibold text-slate-900'>{title}</h3>
      {description && <p className='mt-1 text-sm text-gray-500'>{description}</p>}
      {action && <div className='mt-4'>{action}</div>}
    </div>
  )
}
