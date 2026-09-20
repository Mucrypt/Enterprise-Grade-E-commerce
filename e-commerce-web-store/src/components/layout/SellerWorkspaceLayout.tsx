// A dedicated shell for the seller workspace (Seller Hub, Creator
// Dashboard, seller support) -- deliberately does NOT render the
// customer storefront's header/footer/promo drawer/newsletter/live
// chat widget. A seller managing their business isn't "shopping," and
// shouldn't see shopping chrome wrapped around their own tools.
//
// Kept as a thin shell rather than a full app-shell rebuild (sidebar,
// command palette, etc.) -- this is the one safely-scoped, immediately
// valuable slice of a much larger "Seller Center" ambition: remove the
// storefront chrome without risking the working pages underneath it.

import { Link, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../../stores'
import { NotificationToast } from '../notifications/NotificationToast'

export default function SellerWorkspaceLayout() {
  const { fetchUser } = useAuthStore()

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return (
    <div className='min-h-screen bg-stone-50'>
      <div className='border-b border-black/5 bg-white'>
        <div className='mx-auto flex max-w-6xl items-center justify-between px-4 py-3'>
          <Link to='/seller-hub' className='flex items-center gap-2'>
            <span className='flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-sm font-black text-white'>
              T
            </span>
            <span className='font-black text-slate-900'>TechTools</span>
            <span className='text-sm font-semibold text-gray-400'>Seller Center</span>
          </Link>
          <Link
            to='/'
            className='text-sm font-semibold text-gray-500 transition hover:text-slate-900'
          >
            &larr; Return to TechTools
          </Link>
        </div>
      </div>

      <Outlet />
      <NotificationToast />
    </div>
  )
}
