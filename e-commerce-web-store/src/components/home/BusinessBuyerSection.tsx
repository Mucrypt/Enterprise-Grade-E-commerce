// ============================================
// Business & Bulk Orders (B2B) section
//
// Invites legitimate enquiries only - no fabricated phone
// number, wholesale portal, credit terms, discounts or
// exclusive supplier claims. CTA routes to the real /contact
// page.
// ============================================

import { Link } from 'react-router-dom'
import { Building2, CheckCircle2 } from 'lucide-react'
import { homepageConfig } from '../../config/homepage.config'

export default function BusinessBuyerSection() {
  const { heading, description, customerTypes, cta } =
    homepageConfig.businessBuyer

  return (
    <section aria-label='Business and bulk orders' className='border-y border-slate-200 bg-white py-10 sm:py-12'>
      <div className='mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8'>
        <div className='flex items-center gap-4'>
          <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600'>
            <Building2 className='h-6 w-6' aria-hidden='true' />
          </span>
          <div>
            <h2 className='text-xl font-black tracking-tight text-slate-900 sm:text-2xl'>
              {heading}
            </h2>
            <p className='mt-1 max-w-xl text-sm leading-relaxed text-slate-600'>
              {description}
            </p>
          </div>
        </div>
        <Link
          to={cta.to}
          className='inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-slate-900 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900'
        >
          {cta.label}
        </Link>
      </div>

      <div className='mx-auto mt-6 flex max-w-7xl flex-wrap gap-2 px-4 sm:px-6 lg:px-8'>
        {customerTypes.map((type) => (
          <span
            key={type}
            className='inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600'
          >
            <CheckCircle2 className='h-3 w-3 shrink-0 text-orange-500' aria-hidden='true' />
            {type}
          </span>
        ))}
      </div>
    </section>
  )
}
