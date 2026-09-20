import { AlertTriangle } from 'lucide-react'

export default function SellerErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className='rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5'>
      <AlertTriangle className='mx-auto h-8 w-8 text-red-300' />
      <p className='mt-3 text-sm font-medium text-slate-900'>{message}</p>
      {onRetry && (
        <button
          type='button'
          onClick={onRetry}
          className='mt-4 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-gray-50'
        >
          Try again
        </button>
      )}
    </div>
  )
}
