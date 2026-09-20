// Matches ProfilePage.tsx's existing "coming soon" convention (icon +
// heading + short honest explanation) -- reused here for every Seller
// Center module that doesn't have a real backend yet. Optional real
// links (e.g. to FAQ/Support) keep it useful without fabricating content.

import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export default function SellerComingSoon({
  icon: Icon,
  title,
  description,
  links,
}: {
  icon: LucideIcon
  title: string
  description: string
  links?: { label: string; to: string }[]
}) {
  return (
    <div className='rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5'>
      <Icon className='mx-auto h-10 w-10 text-gray-300' />
      <h2 className='mt-4 text-lg font-semibold text-slate-900'>{title}</h2>
      <p className='mx-auto mt-2 max-w-md text-sm text-gray-500'>{description}</p>
      {links && links.length > 0 && (
        <div className='mt-5 flex flex-wrap items-center justify-center gap-3'>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className='rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-gray-50'
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
