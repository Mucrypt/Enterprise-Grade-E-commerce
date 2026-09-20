import { Loader2 } from 'lucide-react'

export default function SellerLoadingState({ label }: { label?: string }) {
  return (
    <div className='flex flex-col items-center justify-center gap-2 rounded-3xl bg-white py-16 shadow-sm ring-1 ring-black/5'>
      <Loader2 className='h-6 w-6 animate-spin text-orange-500' />
      {label && <p className='text-sm text-gray-500'>{label}</p>}
    </div>
  )
}
