// ============================================
// Trust Strip - four truthful, verifiable statements
// ============================================

import { Wrench, Users, Euro, MessageCircle } from 'lucide-react'
import { homepageConfig } from '../../config/homepage.config'

const icons = [Wrench, Users, Euro, MessageCircle]

export default function TrustStrip() {
  return (
    <section
      aria-label='Why buy from TechTools'
      className='border-b border-slate-200 bg-white'
    >
      <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
        <ul className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'>
          {homepageConfig.trustStrip.map((item, index) => {
            const Icon = icons[index] ?? Wrench
            return (
              <li key={item.title} className='flex items-start gap-3'>
                <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-orange-400'>
                  <Icon className='h-5 w-5' aria-hidden='true' />
                </span>
                <div>
                  <p className='text-sm font-bold text-slate-900'>
                    {item.title}
                  </p>
                  <p className='mt-0.5 text-sm text-slate-500'>
                    {item.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
