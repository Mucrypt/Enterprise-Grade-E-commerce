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
    <section aria-label='Business and bulk orders' className='bg-white py-16 sm:py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 gap-10 rounded-lg border border-slate-200 bg-slate-50 p-8 sm:p-10 lg:grid-cols-2 lg:items-center'>
          <div>
            <span className='flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-orange-400'>
              <Building2 className='h-6 w-6' aria-hidden='true' />
            </span>
            <h2 className='mt-5 text-3xl font-black tracking-tight text-slate-900'>
              {heading}
            </h2>
            <p className='mt-4 text-base leading-relaxed text-slate-600'>
              {description}
            </p>
            <Link
              to={cta.to}
              className='mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900'
            >
              {cta.label}
            </Link>
          </div>

          <ul className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {customerTypes.map((type) => (
              <li
                key={type}
                className='flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700'
              >
                <CheckCircle2
                  className='h-4 w-4 shrink-0 text-orange-500'
                  aria-hidden='true'
                />
                {type}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
