// ============================================
// Cookie Consent Store (Zustand)
// EU ePrivacy Directive / GDPR consent state
// ============================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ConsentPreferences {
  functional: boolean
  analytics: boolean
  marketing: boolean
}

interface ConsentStore extends ConsentPreferences {
  necessary: true
  hasDecided: boolean
  decidedAt: string | null
  isPreferencesOpen: boolean

  acceptAll: () => void
  rejectNonEssential: () => void
  savePreferences: (prefs: ConsentPreferences) => void
  openPreferences: () => void
  closePreferences: () => void
}

// Persisted under this exact key so event-tracking.ts (a plain class with no
// dependency on React/Zustand) can read the same localStorage entry directly
// as its own hard gate on whether it's allowed to queue/send anything.
export const CONSENT_STORAGE_KEY = 'techtools-cookie-consent'

export const useConsentStore = create<ConsentStore>()(
  persist(
    (set) => ({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
      hasDecided: false,
      decidedAt: null,
      isPreferencesOpen: false,

      acceptAll: () => {
        set({
          functional: true,
          analytics: true,
          marketing: true,
          hasDecided: true,
          decidedAt: new Date().toISOString(),
          isPreferencesOpen: false,
        })
      },

      rejectNonEssential: () => {
        set({
          functional: false,
          analytics: false,
          marketing: false,
          hasDecided: true,
          decidedAt: new Date().toISOString(),
          isPreferencesOpen: false,
        })
      },

      savePreferences: (prefs) => {
        set({
          ...prefs,
          hasDecided: true,
          decidedAt: new Date().toISOString(),
          isPreferencesOpen: false,
        })
      },

      openPreferences: () => set({ isPreferencesOpen: true }),
      closePreferences: () => set({ isPreferencesOpen: false }),
    }),
    {
      name: CONSENT_STORAGE_KEY,
      partialize: (state) => ({
        necessary: state.necessary,
        functional: state.functional,
        analytics: state.analytics,
        marketing: state.marketing,
        hasDecided: state.hasDecided,
        decidedAt: state.decidedAt,
      }),
    },
  ),
)
