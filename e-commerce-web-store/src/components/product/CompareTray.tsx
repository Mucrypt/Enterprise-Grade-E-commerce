// ============================================
// Compare Tray -- floating bottom bar, visible only while items are
// selected for comparison. Mounted once at the layout level, same pattern
// as CartDrawer/NotificationToast.
// ============================================

import { Link } from 'react-router-dom'
import { X, GitCompareArrows } from 'lucide-react'
import { useCompareStore } from '../../stores'
import { getProductImage } from '../../utils'

export function CompareTray() {
  const { items, removeItem, clearCompare } = useCompareStore()

  if (items.length === 0) return null

  return (
    <div className='fixed inset-x-0 bottom-0 z-40 border-t bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)]'>
      <div className='mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3'>
        <div className='flex items-center gap-2 text-sm font-medium text-gray-700'>
          <GitCompareArrows className='h-4 w-4 text-orange-500' />
          Compare ({items.length}/4)
        </div>

        <div className='flex flex-1 flex-wrap items-center gap-2'>
          {items.map((product) => (
            <div
              key={product.id}
              className='relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-gray-50'
            >
              <img
                src={getProductImage(product, { w: 56, h: 56 })}
                alt={product.name}
                className='h-full w-full rounded-lg object-cover'
              />
              <button
                type='button'
                onClick={() => removeItem(product.id)}
                aria-label={`Remove ${product.name} from comparison`}
                className='absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-900'
              >
                <X className='h-3 w-3' />
              </button>
            </div>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={clearCompare}
            className='text-sm text-gray-500 hover:text-gray-700'
          >
            Clear
          </button>
          <Link
            to='/compare'
            className={
              items.length < 2
                ? 'pointer-events-none rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-400'
                : 'rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600'
            }
          >
            Compare
          </Link>
        </div>
      </div>
    </div>
  )
}
