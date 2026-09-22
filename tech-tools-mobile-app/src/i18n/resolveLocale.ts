// ============================================
// Locale resolution -- the precedence rule
// ============================================
// Ported from e-commerce-web-store/src/i18n/resolveLocale.ts (same
// precedence, same reasoning) -- this version reads the device's locale
// via expo-localization instead of navigator.languages, since there's
// no browser here. Kept as a pure function with no store/React
// dependency, same reason as the web original: trivially unit-testable,
// reusable outside a component.
//
// Precedence (highest wins):
//   1. Explicit language manually selected by the user this session/before
//   2. Logged-in user's saved preference (users.preferred_locale, once synced)
//   3. Previously persisted preference (preferencesStore, AsyncStorage)
//   4. Device-detected language (expo-localization's getLocales())
//   5. English fallback
//
// A device-language guess must NEVER override an explicit choice -- that
// falls out naturally here because steps 1-3 are checked before step 4.
import * as Localization from 'expo-localization'
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type SupportedLanguage,
} from './config'

export function matchSupportedLanguage(tag: string | null | undefined): SupportedLanguage | null {
  if (!tag) return null
  const base = tag.trim().toLowerCase().split(/[-_]/)[0]
  return isSupportedLanguage(base) ? base : null
}

export interface ResolveLocaleInput {
  explicitChoice?: string | null
  userSavedPreference?: string | null
  persistedPreference?: string | null
  deviceLanguages?: readonly string[] | null
}

export function resolveLocale(input: ResolveLocaleInput): SupportedLanguage {
  const explicit = matchSupportedLanguage(input.explicitChoice)
  if (explicit) return explicit

  const userPref = matchSupportedLanguage(input.userSavedPreference)
  if (userPref) return userPref

  const persisted = matchSupportedLanguage(input.persistedPreference)
  if (persisted) return persisted

  for (const tag of input.deviceLanguages || []) {
    const match = matchSupportedLanguage(tag)
    if (match) return match
  }

  return DEFAULT_LANGUAGE
}

/** Reads the real device locales (step 4 only -- callers still supply the higher-precedence steps). */
export function getDeviceLanguageTags(): string[] {
  try {
    return Localization.getLocales().map((l) => l.languageTag)
  } catch {
    return []
  }
}

/** Device region (ISO 3166-1 alpha-2), for the region auto-detect step -- independent of language by design. */
export function getDeviceRegionCode(): string | null {
  try {
    return Localization.getLocales()[0]?.regionCode ?? null
  } catch {
    return null
  }
}
