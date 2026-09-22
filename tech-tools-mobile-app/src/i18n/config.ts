import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Must stay in sync with tech-tools-api's Joi
// userSchemas.updateLocalePreferences valid-locale list -- small,
// static, cross-repo list, not worth a generator for. Mirrors the web
// storefront's SUPPORTED_LOCALES (e-commerce-web-store/src/i18n/resolveLocale.ts)
// so both apps support exactly the same language set.
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'it', 'de', 'es'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  es: 'Español',
}

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

// Translated content is deliberately scoped to the bar that proves the
// infrastructure works end-to-end (tab labels, the Home header, the
// region/language picker itself, and shared action vocabulary) rather
// than every screen in the app -- see the plan doc for why. Adding a
// new screen's strings later is just adding keys to these same two
// namespaces or a new one, following this exact pattern.
const resources = {
  en: {
    common: require('./locales/en/common.json'),
    navigation: require('./locales/en/navigation.json'),
  },
  fr: {
    common: require('./locales/fr/common.json'),
    navigation: require('./locales/fr/navigation.json'),
  },
  it: {
    common: require('./locales/it/common.json'),
    navigation: require('./locales/it/navigation.json'),
  },
  de: {
    common: require('./locales/de/common.json'),
    navigation: require('./locales/de/navigation.json'),
  },
  es: {
    common: require('./locales/es/common.json'),
    navigation: require('./locales/es/navigation.json'),
  },
}

let initialized = false

export function initI18n(initialLanguage: SupportedLanguage): typeof i18n {
  if (!initialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: initialLanguage,
      fallbackLng: DEFAULT_LANGUAGE,
      defaultNS: 'common',
      ns: ['common', 'navigation'],
      interpolation: { escapeValue: false }, // React already escapes
      compatibilityJSON: 'v4',
    })
    initialized = true
  } else if (i18n.language !== initialLanguage) {
    i18n.changeLanguage(initialLanguage)
  }
  return i18n
}

export default i18n
