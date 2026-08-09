// ============================================
// Locale Store (Zustand)
// Guest/browser language preference persistence
// ============================================
// Mirrors consentStore.ts's shape (persist middleware, one clear
// storage key) -- see docs/LOCALIZATION-ARCHITECTURE.md for the full
// resolution rule this store is one input to (resolveLocale.ts owns the
// actual precedence logic; this store only remembers what was chosen).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '../i18n/resolveLocale'

export const LOCALE_STORAGE_KEY = 'techtools-locale'

interface LocaleStore {
  /** Null until the visitor has an explicit or previously-resolved locale; resolveLocale() decides the effective value from this plus browser/user-account signals. */
  locale: SupportedLocale | null
  /** True once the visitor has explicitly picked a language via the selector (as opposed to it being auto-resolved from the browser) -- step 1 of the precedence rule reads this, not step 3/4. */
  isExplicit: boolean
  setLocale: (locale: string, explicit: boolean) => void
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: null,
      isExplicit: false,
      setLocale: (locale, explicit) => {
        if (!isSupportedLocale(locale)) return
        set({ locale, isExplicit: explicit })
      },
    }),
    {
      name: LOCALE_STORAGE_KEY,
    },
  ),
)

/** Non-hook accessor for use outside React (e.g. the i18n bootstrap in main.tsx, which runs before any component mounts). */
export function getPersistedLocale(): { locale: string | null; isExplicit: boolean } {
  const state = useLocaleStore.getState()
  return { locale: state.locale, isExplicit: state.isExplicit }
}

export { DEFAULT_LOCALE }
