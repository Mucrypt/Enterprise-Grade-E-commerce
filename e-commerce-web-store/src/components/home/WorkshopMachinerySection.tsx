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
import { Factory, ArrowRight } from 'lucide-react'
import { homepageConfig } from '../../config/homepage.config'

export default function WorkshopMachinerySection() {
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    homepageConfig.workshopMachinery

  return (
    <section
      aria-label='Workshop equipment'
      className='relative overflow-hidden bg-slate-900 py-20 sm:py-24'
    >
      <div
        aria-hidden='true'
        className='absolute inset-0 opacity-[0.06]'
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute -right-16 -top-16 hidden opacity-[0.08] lg:block'
      >
        <Factory className='h-96 w-96 text-white' />
      </div>

      <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='max-w-2xl'>
          <span className='inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-orange-400'>
            {eyebrow}
          </span>
          <h2 className='mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl'>
            {headline}
          </h2>
          <p className='mt-4 text-base leading-relaxed text-slate-300'>
            {description}
          </p>

          <div className='mt-8 flex flex-col gap-4 sm:flex-row'>
            <Link
              to={primaryCta.to}
              className='inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
            >
              {primaryCta.label}
              <ArrowRight className='h-4 w-4' aria-hidden='true' />
            </Link>
            <Link
              to={secondaryCta.to}
              className='inline-flex items-center justify-center gap-2 rounded-md border border-white/25 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
            >
              {secondaryCta.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
