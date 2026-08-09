// ============================================
// Locale resolution -- the precedence rule
// ============================================
// Deliberately a pure function with no React/DOM/store dependency, so it
// stays trivially unit-testable and reusable from a non-React context
// (e.g. a future SSR entry point) without dragging in Zustand or i18next.
//
// Precedence (highest wins), per LOCALIZATION-FOUNDATION-1:
//   1. Explicit language manually selected by the user this session/before
//   2. Logged-in user's saved preference (once users.preferred_locale
//      exists -- see docs/LOCALIZATION-ARCHITECTURE.md; today this is
//      always undefined, so this step is a no-op until that lands)
//   3. Previously persisted guest preference (localeStore, localStorage)
//   4. Browser/device preferred language (navigator.languages)
//   5. English fallback
//
// A browser-language guess must NEVER override an explicit choice -- that
// falls out naturally here because step 1/3 (explicit/persisted) are
// checked before step 4 (browser) at all.

export const SUPPORTED_LOCALES = ['en', 'fr', 'it', 'de', 'es'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Reduces a BCP-47 tag (e.g. "fr-CM", "en-US", "pt-BR") to its base
 * language subtag and checks that against SUPPORTED_LOCALES. This is the
 * one and only place language gets derived from a country-shaped input --
 * it intentionally throws away the region ("CM", "US", "FR") entirely
 * rather than using it for anything: region here says nothing about which
 * of our markets/currencies the visitor is in, only a hint about which
 * language variant their browser is set to. See "language != country" in
 * the architecture doc.
 */
export function matchSupportedLocale(tag: string | null | undefined): SupportedLocale | null {
  if (!tag) return null
  const base = tag.trim().toLowerCase().split(/[-_]/)[0]
  return isSupportedLocale(base) ? base : null
}

export interface ResolveLocaleInput {
  /** Step 1 -- an explicit choice made in the current interaction (e.g. just clicked in the selector). */
  explicitChoice?: string | null
  /** Step 2 -- the authenticated user's saved preference, if any (see LOCALIZATION-ARCHITECTURE.md's future users.preferred_locale). */
  userSavedPreference?: string | null
  /** Step 3 -- a locale this browser previously persisted (guest or user), e.g. from localeStore/localStorage. */
  persistedPreference?: string | null
  /** Step 4 -- ordered browser language tags, typically `navigator.languages`. */
  browserLanguages?: readonly string[] | null
}

/**
 * Resolves the precedence chain to a single supported locale. Every step
 * is independently optional (undefined/null/unsupported values are
 * skipped, not treated as errors) so callers can pass whatever they
 * currently have without pre-filtering.
 */
export function resolveLocale(input: ResolveLocaleInput): SupportedLocale {
  const explicit = matchSupportedLocale(input.explicitChoice)
  if (explicit) return explicit

  const userPref = matchSupportedLocale(input.userSavedPreference)
  if (userPref) return userPref

  const persisted = matchSupportedLocale(input.persistedPreference)
  if (persisted) return persisted

  for (const tag of input.browserLanguages || []) {
    const match = matchSupportedLocale(tag)
    if (match) return match
  }

  return DEFAULT_LOCALE
}

/** Convenience wrapper reading straight from the real browser environment (step 4 only -- callers still supply the higher-precedence steps). */
export function getBrowserLanguages(): string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages && navigator.languages.length > 0
    ? [...navigator.languages]
    : navigator.language
      ? [navigator.language]
      : []
}
