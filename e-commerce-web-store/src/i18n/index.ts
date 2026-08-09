// ============================================
// i18next bootstrap
// ============================================
// Resources are bundled at build time (small, known set of locales -- see
// SUPPORTED_LOCALES) rather than lazy-fetched per namespace; revisit with
// i18next-http-backend only if the catalog grows large enough that bundle
// size actually matters. See docs/LOCALIZATION-ARCHITECTURE.md.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  resolveLocale,
  getBrowserLanguages,
} from './resolveLocale'
import { getPersistedLocale, useLocaleStore } from '../stores/localeStore'

import enCommon from '../locales/en/common.json'
import enNavigation from '../locales/en/navigation.json'
import enCart from '../locales/en/cart.json'
import enAuth from '../locales/en/auth.json'
import enProducts from '../locales/en/products.json'

import frCommon from '../locales/fr/common.json'
import frNavigation from '../locales/fr/navigation.json'
import frCart from '../locales/fr/cart.json'
import frAuth from '../locales/fr/auth.json'
import frProducts from '../locales/fr/products.json'

import itCommon from '../locales/it/common.json'
import itNavigation from '../locales/it/navigation.json'
import itCart from '../locales/it/cart.json'
import itAuth from '../locales/it/auth.json'
import itProducts from '../locales/it/products.json'

import deCommon from '../locales/de/common.json'
import deNavigation from '../locales/de/navigation.json'
import deCart from '../locales/de/cart.json'
import deAuth from '../locales/de/auth.json'
import deProducts from '../locales/de/products.json'

import esCommon from '../locales/es/common.json'
import esNavigation from '../locales/es/navigation.json'
import esCart from '../locales/es/cart.json'
import esAuth from '../locales/es/auth.json'
import esProducts from '../locales/es/products.json'

const resources = {
  en: { common: enCommon, navigation: enNavigation, cart: enCart, auth: enAuth, products: enProducts },
  fr: { common: frCommon, navigation: frNavigation, cart: frCart, auth: frAuth, products: frProducts },
  it: { common: itCommon, navigation: itNavigation, cart: itCart, auth: itAuth, products: itProducts },
  de: { common: deCommon, navigation: deNavigation, cart: deCart, auth: deAuth, products: deProducts },
  es: { common: esCommon, navigation: esNavigation, cart: esCart, auth: esAuth, products: esProducts },
}

// Step 2 of the precedence rule (logged-in user's saved preference) has no
// backend field yet -- see docs/LOCALIZATION-ARCHITECTURE.md's proposed
// users.preferred_locale. Once it exists, read it here (e.g. from
// authStore's hydrated user) and pass it as userSavedPreference below.
const { locale: persisted } = getPersistedLocale()
const initialLocale = resolveLocale({
  persistedPreference: persisted,
  browserLanguages: getBrowserLanguages(),
})

i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  ns: ['common', 'navigation', 'cart', 'auth', 'products'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false, // React already escapes
  },
  returnNull: false,
})

// If this was the very first visit (nothing persisted yet), remember the
// browser-derived resolution as a non-explicit preference so a page reload
// resolves to the same locale from step 3 rather than re-deriving from the
// browser every time (step 3 also survives the user later clearing/changing
// browser language settings without that silently relanguaging the site).
if (!persisted) {
  useLocaleStore.getState().setLocale(initialLocale, false)
}

document.documentElement.lang = initialLocale

export function changeLanguage(locale: string, explicit = true) {
  const resolved = resolveLocale({ explicitChoice: locale })
  useLocaleStore.getState().setLocale(resolved, explicit)
  i18n.changeLanguage(resolved)
  document.documentElement.lang = resolved
}

export default i18n
