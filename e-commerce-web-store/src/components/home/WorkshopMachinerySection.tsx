// ============================================
// Workshop Machinery feature section
//
// No specific machinery category/products are asserted to
// exist in the live catalogue (Not verified from this repo)
// so this section is presented as a premium enquiry/category
// feature that links only to always-valid routes (the full
// catalogue and the real contact page) rather than a specific
// unverified category slug or any fabricated machinery cards.
// ============================================

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { homepageConfig } from '../../config/homepage.config'

export default function WorkshopMachinerySection() {
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    homepageConfig.workshopMachinery

  return (
    <section
      aria-label='Workshop equipment'
      className='relative overflow-hidden bg-linear-to-r from-slate-900 to-slate-800 py-10 sm:py-12'
    >
      <div
        aria-hidden='true'
        className='absolute -right-1/4 top-1/2 h-[160%] w-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl'
        style={{ background: 'radial-gradient(closest-side, #f97316, transparent 70%)' }}
      />

      <div className='relative mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8'>
        <div className='max-w-xl'>
          <span className='inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-orange-400'>
            {eyebrow}
          </span>
          <h2 className='mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl'>
            {headline}
          </h2>
          <p className='mt-2 text-sm leading-relaxed text-slate-300'>
            {description}
          </p>
        </div>

        <div className='flex shrink-0 flex-col gap-3 sm:flex-row'>
          <Link
            to={primaryCta.to}
            className='inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
          >
            {primaryCta.label}
            <ArrowRight className='h-4 w-4' aria-hidden='true' />
          </Link>
          <Link
            to={secondaryCta.to}
            className='inline-flex items-center justify-center gap-2 rounded-md border border-white/25 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
          >
            {secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  )
}
