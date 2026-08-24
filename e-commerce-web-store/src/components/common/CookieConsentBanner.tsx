// ============================================
// Cookie Consent Banner
// Shown on first visit (and re-openable via Cookie Policy / footer) until
// the visitor makes a choice. Gates DriftChat (functional) and
// event-tracking.ts (analytics) -- see those files for the actual
// enforcement, this component only collects/displays the decision.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Cookie,
  X,
  ShieldCheck,
  Sliders,
  BarChart3,
  Megaphone,
  ChevronDown,
} from 'lucide-react'
import { useConsentStore } from '../../stores'
import { cn } from '../../utils'

const CATEGORIES: {
  key: 'functional' | 'analytics' | 'marketing'
  label: string
  description: string
  icon: typeof Sliders
}[] = [
  {
    key: 'functional',
    label: 'Functional',
    description:
      'Enables optional features like live chat support. Off by default.',
    icon: Sliders,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description:
      'Helps us understand how the store is used so we can improve it. No data is collected until you opt in.',
    icon: BarChart3,
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description:
      "Not currently used -- reserved for future advertising features, which we'll ask about separately if we ever add them.",
    icon: Megaphone,
  },
]

export default function CookieConsentBanner() {
  const {
    hasDecided,
    isPreferencesOpen,
    functional,
    analytics,
    marketing,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    closePreferences,
  } = useConsentStore()

  const [isCustomizing, setIsCustomizing] = useState(false)
  const [draft, setDraft] = useState({ functional, analytics, marketing })
  const [entered, setEntered] = useState(false)

  const visible = !hasDecided || isPreferencesOpen

  useEffect(() => {
    if (!visible) {
      setEntered(false)
      return
    }
    // Mount closed, then flip open a tick later so the transition classes
    // actually animate in rather than snapping to their final state.
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [visible])

  if (!visible) return null

  const startCustomizing = () => {
    setDraft({ functional, analytics, marketing })
    setIsCustomizing(true)
  }

  const handleSave = () => {
    savePreferences(draft)
    setIsCustomizing(false)
  }

  const handleClose = () => {
    // Only closable without deciding if this is a re-open of preferences
    // (hasDecided already true) -- the first-visit banner has no dismiss-X.
    if (hasDecided) {
      closePreferences()
      setIsCustomizing(false)
    }
  }

  return (
    <div
      className='fixed inset-x-0 bottom-0 z-50 flex justify-center px-0 sm:px-4 sm:pb-4'
      role='dialog'
      aria-label='Cookie consent'
      aria-modal={!hasDecided}
    >
      <div
        className={cn(
          'w-full sm:max-w-2xl transition-all duration-500 ease-out',
          entered
            ? 'translate-y-0 opacity-100'
            : 'translate-y-8 opacity-0',
        )}
      >
        <div className='relative overflow-hidden rounded-t-2xl sm:rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl'>
          {/* Brand accent bar */}
          <div className='h-1 w-full bg-linear-to-r from-orange-400 via-orange-500 to-pink-500' />

          <div className='px-5 py-5 sm:px-7 sm:py-6'>
            <div className='flex items-start gap-4'>
              <div className='hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-orange-400 to-pink-500 shadow-lg shadow-orange-500/25'>
                <Cookie className='h-5 w-5 text-white' />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-start justify-between gap-3'>
                  <h2 className='text-base font-semibold tracking-tight text-gray-900'>
                    We value your privacy
                  </h2>
                  {hasDecided && (
                    <button
                      onClick={handleClose}
                      aria-label='Close'
                      className='shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  )}
                </div>
                <p className='mt-1.5 text-sm leading-relaxed text-gray-600'>
                  We use strictly necessary cookies to run this site (like
                  your cart and login session), plus optional cookies for
                  chat support and analytics that only load if you accept
                  them. See our{' '}
                  <Link
                    to='/cookies'
                    className='font-medium text-orange-600 underline-offset-2 hover:underline'
                  >
                    Cookie Policy
                  </Link>{' '}
                  for details.
                </p>

                <div
                  className={cn(
                    'grid transition-all duration-300 ease-out',
                    isCustomizing
                      ? 'mt-4 grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className='overflow-hidden'>
                    <div className='space-y-2.5 border-t border-gray-100 pt-4'>
                      <div className='flex items-center gap-3 rounded-xl bg-gray-50 p-3'>
                        <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-200/80'>
                          <ShieldCheck className='h-4 w-4 text-gray-600' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <p className='text-sm font-medium text-gray-900'>
                            Strictly Necessary
                          </p>
                          <p className='text-xs text-gray-500'>
                            Always on -- required for the site to function.
                          </p>
                        </div>
                        <span className='shrink-0 rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500'>
                          Always on
                        </span>
                      </div>
                      {CATEGORIES.map((category) => {
                        const Icon = category.icon
                        const isOn = draft[category.key]
                        return (
                          <div
                            key={category.key}
                            className='flex items-center gap-3 rounded-xl bg-gray-50 p-3'
                          >
                            <div
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                                isOn
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-gray-200/80 text-gray-500',
                              )}
                            >
                              <Icon className='h-4 w-4' />
                            </div>
                            <div className='min-w-0 flex-1'>
                              <p className='text-sm font-medium text-gray-900'>
                                {category.label}
                              </p>
                              <p className='text-xs text-gray-500'>
                                {category.description}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [category.key]: !prev[category.key],
                                }))
                              }
                              aria-pressed={isOn}
                              aria-label={`Toggle ${category.label} cookies`}
                              className={cn(
                                'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
                                isOn
                                  ? 'bg-linear-to-r from-orange-400 to-orange-500'
                                  : 'bg-gray-300',
                              )}
                            >
                              <span
                                className={cn(
                                  'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                                  isOn ? 'right-1' : 'left-1',
                                )}
                              />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className='mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:flex-wrap sm:items-center'>
                  {isCustomizing ? (
                    <button
                      onClick={handleSave}
                      className='rounded-xl bg-linear-to-r from-orange-500 to-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 hover:brightness-105 active:scale-[0.98]'
                    >
                      Save Preferences
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={acceptAll}
                        className='order-1 rounded-xl bg-linear-to-r from-orange-500 to-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 hover:brightness-105 active:scale-[0.98] sm:order-0'
                      >
                        Accept All
                      </button>
                      <button
                        onClick={rejectNonEssential}
                        className='order-2 rounded-xl border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:order-0'
                      >
                        Reject Non-Essential
                      </button>
                      <button
                        onClick={startCustomizing}
                        className='order-3 flex items-center justify-center gap-1 px-2 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 sm:order-0 sm:ml-1'
                      >
                        Customize
                        <ChevronDown className='h-3.5 w-3.5' />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
