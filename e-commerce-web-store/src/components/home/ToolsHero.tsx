// ============================================
// Tools Hero - Professional workshop positioning
//
// No photographic asset is used: the repository has no
// licensed hero photography (public/ contains only a
// favicon/manifest, and the previous hero's image paths
// were dead links). Instead this hero uses a dark
// industrial gradient plus a CSS-only blueprint grid and
// decorative tool glyphs, so there is no network image
// request, no layout shift and nothing copyrighted is
// invented.
// ============================================

import { Link } from 'react-router-dom'
import { ArrowRight, Hammer, HardHat, Wrench } from 'lucide-react'
import { homepageConfig } from '../../config/homepage.config'

export default function ToolsHero() {
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    homepageConfig.hero

  return (
    <section
      aria-label='TechTools professional tools and workshop equipment'
      className='relative overflow-hidden bg-[#0f1420]'
    >
      {/* Decorative blueprint grid (CSS-only, purely presentational) */}
      <div
        aria-hidden='true'
        className='absolute inset-0 opacity-[0.07]'
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Decorative glyphs, right side, hidden on small screens */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute -right-10 top-1/2 hidden -translate-y-1/2 lg:block'
      >
        <div className='relative h-96 w-96 opacity-[0.10]'>
          <Wrench className='absolute right-8 top-4 h-40 w-40 -rotate-12 text-white' />
          <HardHat className='absolute right-40 top-40 h-28 w-28 rotate-6 text-white' />
          <Hammer className='absolute right-4 bottom-6 h-32 w-32 rotate-12 text-white' />
        </div>
      </div>

      <div className='relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28'>
        <div className='max-w-2xl'>
          <span className='inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-orange-400'>
            {eyebrow}
          </span>

          <h1 className='mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl'>
            {headline}
          </h1>

          <p className='mt-6 max-w-xl text-lg leading-relaxed text-slate-300'>
            {description}
          </p>

          <div className='mt-10 flex flex-col gap-4 sm:flex-row'>
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
