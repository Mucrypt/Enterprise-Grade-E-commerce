// ============================================
// Cookie Consent Banner
// Shown on first visit (and re-openable via Cookie Policy / footer) until
// the visitor makes a choice. Gates DriftChat (functional) and
// event-tracking.ts (analytics) -- see those files for the actual
// enforcement, this component only collects/displays the decision.
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, X } from 'lucide-react'
import { useConsentStore } from '../../stores'
import { cn } from '../../utils'

const CATEGORIES: {
  key: 'functional' | 'analytics' | 'marketing'
  label: string
  description: string
}[] = [
  {
    key: 'functional',
    label: 'Functional',
    description:
      'Enables optional features like live chat support. Off by default.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description:
      'Helps us understand how the store is used so we can improve it. No data is collected until you opt in.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description:
      "Not currently used -- reserved for future advertising features, which we'll ask about separately if we ever add them.",
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

  const visible = !hasDecided || isPreferencesOpen
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
      className='fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)]'
      role='dialog'
      aria-label='Cookie consent'
    >
      <div className='max-w-5xl mx-auto px-4 py-5 sm:px-6'>
        <div className='flex items-start gap-3'>
          <div className='hidden sm:flex w-10 h-10 shrink-0 items-center justify-center rounded-full bg-orange-100'>
            <Cookie className='w-5 h-5 text-orange-600' />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='flex items-start justify-between gap-2'>
              <h2 className='font-semibold text-gray-900'>
                We use cookies
              </h2>
              {hasDecided && (
                <button
                  onClick={handleClose}
                  aria-label='Close'
                  className='shrink-0 text-gray-400 hover:text-gray-600'
                >
                  <X className='w-5 h-5' />
                </button>
              )}
            </div>
            <p className='text-sm text-gray-600 mt-1'>
              We use strictly necessary cookies to run this site (like your
              cart and login session), plus optional cookies for chat
              support and analytics that only load if you accept them. See
              our{' '}
              <Link to='/cookies' className='text-orange-600 hover:underline'>
                Cookie Policy
              </Link>{' '}
              for details.
            </p>

            {isCustomizing && (
              <div className='mt-4 space-y-3 border-t pt-4'>
                <div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
                  <div>
                    <p className='text-sm font-medium text-gray-900'>
                      Strictly Necessary
                    </p>
                    <p className='text-xs text-gray-500'>
                      Always on -- required for the site to function.
                    </p>
                  </div>
                  <span className='px-2 py-1 text-xs font-medium bg-gray-200 text-gray-500 rounded-full'>
                    Always on
                  </span>
                </div>
                {CATEGORIES.map((category) => (
                  <div
                    key={category.key}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3'
                  >
                    <div>
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
                      aria-pressed={draft[category.key]}
                      className={cn(
                        'w-11 h-6 rounded-full transition-colors relative shrink-0',
                        draft[category.key] ? 'bg-orange-500' : 'bg-gray-300',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                          draft[category.key] ? 'right-1' : 'left-1',
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className='mt-4 flex flex-wrap gap-3'>
              {isCustomizing ? (
                <button
                  onClick={handleSave}
                  className='px-5 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors'
                >
                  Save Preferences
                </button>
              ) : (
                <>
                  <button
                    onClick={acceptAll}
                    className='px-5 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors'
                  >
                    Accept All
                  </button>
                  <button
                    onClick={rejectNonEssential}
                    className='px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors'
                  >
                    Reject Non-Essential
                  </button>
                  <button
                    onClick={startCustomizing}
                    className='px-5 py-2.5 text-gray-600 font-medium hover:text-gray-900 transition-colors'
                  >
                    Customize
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
