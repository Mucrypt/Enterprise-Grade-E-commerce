// Real navigation + action search only -- every Seller Center
// destination plus "Add product," filtered client-side. No simulated
// backend search; the decorative "⌘K" hint in the customer Header.tsx
// never had a real listener behind it -- this is the first one.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { SELLER_NAV_FLAT } from './sellerNav'
import { cn } from '../../utils'

interface CommandItem {
  label: string
  to: string
  icon: (typeof SELLER_NAV_FLAT)[number]['icon']
}

export default function SellerCommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const items: CommandItem[] = useMemo(() => {
    const actions: CommandItem[] = [{ label: 'Add product', to: '/seller-center/products', icon: Plus }]
    const all = [...actions, ...SELLER_NAV_FLAT]
    if (!query.trim()) return all
    const q = query.trim().toLowerCase()
    return all.filter((item) => item.label.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleSelect = (item: CommandItem) => {
    navigate(item.to)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && items[activeIndex]) {
        e.preventDefault()
        handleSelect(items[activeIndex])
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items, activeIndex])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24'>
      <div className='absolute inset-0' onClick={onClose} aria-hidden='true' />
      <div
        role='dialog'
        aria-modal='true'
        aria-label='Seller Center command palette'
        className='relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl'
      >
        <div className='flex items-center gap-2 border-b border-gray-100 px-4 py-3'>
          <Search className='h-4 w-4 text-gray-400' />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search Seller Center...'
            className='w-full text-sm outline-none'
          />
          <kbd className='rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400'>
            Esc
          </kbd>
        </div>
        <div className='max-h-80 overflow-y-auto p-2'>
          {items.length === 0 ? (
            <p className='px-3 py-6 text-center text-sm text-gray-400'>No matches.</p>
          ) : (
            items.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={`${item.label}-${item.to}`}
                  type='button'
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
                    index === activeIndex ? 'bg-orange-50 text-orange-700' : 'text-slate-700',
                  )}
                >
                  <Icon className='h-4 w-4 shrink-0' />
                  {item.label}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
