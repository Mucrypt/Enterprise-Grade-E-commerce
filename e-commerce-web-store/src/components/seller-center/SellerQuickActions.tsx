import { Link } from 'react-router-dom'
import { Package, Plus, Store, UserCheck } from 'lucide-react'

export default function SellerQuickActions({
  handle,
  dashboardReady,
}: {
  handle: string | null
  dashboardReady: boolean
}) {
  return (
    <div className='flex flex-wrap gap-3'>
      <Link
        to='/seller-center/products'
        className='inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700'
      >
        <Plus className='h-4 w-4' /> Add product
      </Link>
      <Link
        to='/seller-center/products'
        className='inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50'
      >
        <Package className='h-4 w-4' /> Manage products
      </Link>
      {handle && (
        <Link
          to={`/seller/${handle}`}
          target='_blank'
          rel='noreferrer'
          className='inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50'
        >
          <Store className='h-4 w-4' /> View storefront
        </Link>
      )}
      {!dashboardReady && (
        <Link
          to='/seller-hub'
          className='inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100'
        >
          <UserCheck className='h-4 w-4' /> Complete seller setup
        </Link>
      )}
    </div>
  )
}
