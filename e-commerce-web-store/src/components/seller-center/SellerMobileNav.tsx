// Accessible mobile drawer -- this app has no Radix/Dialog primitive
// (that's an admin-dashboard convention, not this one), so this is hand
// built: overlay + panel, closes on Escape and outside-click, locks body
// scroll while open, closes after navigating, returns focus to the
// trigger on close.

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import SellerSidebarNav from './SellerSidebarNav'

export default function SellerMobileNav({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      triggerFocusRef.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      panelRef.current?.focus()
    } else {
      document.body.style.overflow = ''
      triggerFocusRef.current?.focus?.()
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-50 lg:hidden'>
      <div
        className='absolute inset-0 bg-black/40'
        onClick={onClose}
        aria-hidden='true'
      />
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label='Seller Center navigation'
        tabIndex={-1}
        className='absolute inset-y-0 left-0 flex w-72 flex-col bg-slate-950 shadow-xl outline-none'
      >
        <div className='flex items-center justify-between border-b border-white/10 px-4 py-3'>
          <span className='font-black text-white'>Seller Center</span>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close navigation'
            className='rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white'
          >
            <X className='h-5 w-5' />
          </button>
        </div>
        <SellerSidebarNav onNavigate={onClose} />
      </div>
    </div>
  )
}
