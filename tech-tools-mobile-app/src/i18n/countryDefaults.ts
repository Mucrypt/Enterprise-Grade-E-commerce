// Country -> (default display currency, default UI language) lookup for
// the region/language picker's auto-detect step. Deliberately NOT a
// field on every entry in data/countries.ts (195+ countries) -- almost
// all of them would just be {EUR, en}, so a small, explicit table of the
// real exceptions is more honest and easier to audit than 195 mostly-
// duplicate rows. Both are only a STARTING GUESS: the whole point of the
// picker is that the user can independently override either one (the
// founder's own example: physically in Italy, app language set to
// English).
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from './currencyConfig'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './config'

// Currencies actually different from the store's base (EUR) among
// SUPPORTED_CURRENCIES. Any country not listed here displays EUR --
// documented, not a silent wrong guess, same discipline as the
// backend's currency-rate.service.ts never guessing a rate.
const CURRENCY_BY_COUNTRY: Record<string, SupportedCurrency> = {
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  CH: 'CHF',
  LI: 'CHF', // Liechtenstein uses the Swiss franc
}

// Primary-language guess for the countries where it's unambiguous
// among our 5 supported languages. Everything else defaults to English,
// same ultimate fallback the web app's resolveLocale.ts uses.
const LANGUAGE_BY_COUNTRY: Record<string, SupportedLanguage> = {
  IT: 'it',
  SM: 'it', // San Marino
  VA: 'it', // Vatican City
  FR: 'fr',
  BE: 'fr',
  LU: 'fr',
  MC: 'fr', // Monaco
  DE: 'de',
  AT: 'de',
  LI: 'de', // Liechtenstein
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  VE: 'es',
  EC: 'es',
  GT: 'es',
  CU: 'es',
  BO: 'es',
  DO: 'es',
  HN: 'es',
  PY: 'es',
  SV: 'es',
  NI: 'es',
  CR: 'es',
  PA: 'es',
  UY: 'es',
  GQ: 'es',
}

export function getDefaultCurrencyForCountry(countryCode: string): SupportedCurrency {
  return CURRENCY_BY_COUNTRY[countryCode?.toUpperCase()] || 'EUR'
}

export function getDefaultLanguageForCountry(countryCode: string): SupportedLanguage {
  return LANGUAGE_BY_COUNTRY[countryCode?.toUpperCase()] || 'en'
}

// Re-exported so callers that only need the country-default logic don't
// have to import both modules separately.
export { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES }
