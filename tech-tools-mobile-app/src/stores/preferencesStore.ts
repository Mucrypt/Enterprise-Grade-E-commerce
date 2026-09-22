// ============================================
// TechTools Mobile App - Region/Language/Currency Preferences Store
// ============================================
// Region (country), language, and currency are three INDEPENDENT
// choices by design -- the founder's own example: physically in Italy,
// app language set to English. Auto-detected once on first launch via
// the device's locale (expo-localization), then fully user-overridable
// through the region/language picker. For a signed-in user, a choice
// syncs to the backend (users.country/preferred_currency/preferred_locale)
// so it follows them across devices; the server value wins over a fresh
// device guess on login, matching authStore's guest->account merge
// pattern for the wishlist.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { localeApi } from '../api'
import { initI18n, DEFAULT_LANGUAGE, isSupportedLanguage, type SupportedLanguage } from '../i18n/config'
import { isSupportedCurrency, type SupportedCurrency } from '../i18n/currencyConfig'
import {
  getDeviceLanguageTags,
  getDeviceRegionCode,
  resolveLocale,
} from '../i18n/resolveLocale'
import {
  getDefaultCurrencyForCountry,
  getDefaultLanguageForCountry,
} from '../i18n/countryDefaults'

interface PreferencesState {
  country: string | null
  language: SupportedLanguage
  currency: SupportedCurrency
  // Latest fetched EUR->target rates (e.g. { USD: 1.08, GBP: 0.86 }).
  // Deliberately NOT persisted -- always refetched on boot via
  // useCurrencyRates, since a stale rate from days ago is worse than
  // briefly showing the real EUR price while a fresh one loads.
  rates: Record<string, number>
  hasHydrated: boolean
  // Guards initializeFromDevice() so the one-time auto-detect only ever
  // runs once per install, never re-overwriting a later manual choice.
  hasInitializedFromDevice: boolean

  setHasHydrated: (value: boolean) => void
  initializeFromDevice: () => void
  setCountry: (countryCode: string) => void
  setLanguage: (language: SupportedLanguage) => void
  setRates: (rates: Record<string, number>) => void
  /** Called after a successful login -- server preference wins if present. */
  syncFromServer: () => Promise<void>
  /** Called after a manual change while signed in -- best-effort, never blocks the UI. */
  persistToServerIfSignedIn: (isSignedIn: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      country: null,
      language: DEFAULT_LANGUAGE,
      currency: 'EUR',
      rates: {},
      hasHydrated: false,
      hasInitializedFromDevice: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),
      setRates: (rates) => set({ rates }),

      initializeFromDevice: () => {
        if (get().hasInitializedFromDevice) return

        const deviceRegion = getDeviceRegionCode()
        const language = resolveLocale({
          persistedPreference: null, // this IS the first run -- nothing persisted yet
          deviceLanguages: getDeviceLanguageTags(),
        })
        const country = deviceRegion || null
        const currency = country ? getDefaultCurrencyForCountry(country) : 'EUR'

        set({ country, language, currency, hasInitializedFromDevice: true })
        initI18n(language)
      },

      setCountry: (countryCode) => {
        const currency = getDefaultCurrencyForCountry(countryCode)
        set({ country: countryCode, currency })
      },

      setLanguage: (language) => {
        set({ language })
        initI18n(language)
      },

      syncFromServer: async () => {
        try {
          const prefs = await localeApi.getMyPreferences()
          const next: Partial<PreferencesState> = {}

          if (prefs.country) next.country = prefs.country
          if (prefs.preferredCurrency && isSupportedCurrency(prefs.preferredCurrency)) {
            next.currency = prefs.preferredCurrency
          }
          if (prefs.preferredLocale && isSupportedLanguage(prefs.preferredLocale)) {
            next.language = prefs.preferredLocale
          }

          if (Object.keys(next).length > 0) {
            set(next)
            if (next.language) initI18n(next.language)
          }
        } catch {
          // Best-effort -- a signed-in user just keeps whatever was
          // already detected/persisted locally if this fails.
        }
      },

      persistToServerIfSignedIn: (isSignedIn) => {
        if (!isSignedIn) return
        const { country, currency, language } = get()
        localeApi
          .updatePreferences({
            country: country || undefined,
            preferredCurrency: currency,
            preferredLocale: language,
          })
          .catch(() => {
            // Best-effort -- the local choice already took effect either way.
          })
      },
    }),
    {
      name: 'preferences-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        country: state.country,
        language: state.language,
        currency: state.currency,
        hasInitializedFromDevice: state.hasInitializedFromDevice,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // A returning user already has a persisted language -- apply
          // it to i18next immediately, don't wait for a re-render to
          // notice. A first-ever launch has no persisted state yet, so
          // this is a no-op and initializeFromDevice (called once from
          // the root layout) handles it instead.
          initI18n(state.language)
        }
        state?.setHasHydrated(true)
      },
    },
  ),
)

// Re-exported for convenience so screens don't need two imports for the
// common "give me a label for this country" case.
export { getDefaultLanguageForCountry }
