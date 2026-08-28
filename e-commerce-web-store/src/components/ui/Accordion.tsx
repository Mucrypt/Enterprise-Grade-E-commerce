import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils'

interface AccordionItemProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = `accordion-panel-${title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div className='border-b last:border-b-0'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className='flex w-full items-center justify-between py-4 text-left font-medium text-gray-900'
      >
        {title}
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={panelId} className='pb-4 text-gray-700'>
          {children}
        </div>
      )}
    </div>
  )
}

export function Accordion({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y', className)}>{children}</div>
}
