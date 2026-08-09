import { describe, it, expect } from 'vitest'
import {
  resolveLocale,
  matchSupportedLocale,
  isSupportedLocale,
  DEFAULT_LOCALE,
} from './resolveLocale'

describe('matchSupportedLocale -- BCP-47 tag -> supported base language', () => {
  it('maps region-qualified tags to their base language', () => {
    expect(matchSupportedLocale('fr-FR')).toBe('fr')
    expect(matchSupportedLocale('fr-CM')).toBe('fr')
    expect(matchSupportedLocale('it-IT')).toBe('it')
    expect(matchSupportedLocale('de-DE')).toBe('de')
    expect(matchSupportedLocale('es-ES')).toBe('es')
    expect(matchSupportedLocale('en-US')).toBe('en')
  })

  it('is case-insensitive and accepts underscore-separated tags', () => {
    expect(matchSupportedLocale('FR-fr')).toBe('fr')
    expect(matchSupportedLocale('en_US')).toBe('en')
  })

  it('returns null for an unsupported language regardless of region', () => {
    expect(matchSupportedLocale('pt-BR')).toBeNull()
    expect(matchSupportedLocale('zh-CN')).toBeNull()
    expect(matchSupportedLocale('ja')).toBeNull()
  })

  it('returns null for empty/missing input', () => {
    expect(matchSupportedLocale(null)).toBeNull()
    expect(matchSupportedLocale(undefined)).toBeNull()
    expect(matchSupportedLocale('')).toBeNull()
  })
})

describe('isSupportedLocale', () => {
  it('accepts exactly the 5 launch locales', () => {
    expect(isSupportedLocale('en')).toBe(true)
    expect(isSupportedLocale('fr')).toBe(true)
    expect(isSupportedLocale('it')).toBe(true)
    expect(isSupportedLocale('de')).toBe(true)
    expect(isSupportedLocale('es')).toBe(true)
  })

  it('rejects anything else, including region-qualified tags', () => {
    expect(isSupportedLocale('fr-FR')).toBe(false)
    expect(isSupportedLocale('pt')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })
})

describe('resolveLocale -- the full precedence chain', () => {
  it('an explicit choice wins over everything else', () => {
    const result = resolveLocale({
      explicitChoice: 'de',
      userSavedPreference: 'it',
      persistedPreference: 'es',
      browserLanguages: ['fr-FR'],
    })
    expect(result).toBe('de')
  })

  it('the browser language NEVER overrides an explicit or persisted choice', () => {
    const result = resolveLocale({
      persistedPreference: 'it',
      browserLanguages: ['fr-FR', 'en-US'],
    })
    expect(result).toBe('it')
  })

  it('falls back to the saved user preference when there is no explicit choice', () => {
    const result = resolveLocale({
      userSavedPreference: 'es',
      persistedPreference: 'de',
      browserLanguages: ['fr-FR'],
    })
    expect(result).toBe('es')
  })

  it('falls back to the persisted guest preference when there is no user preference', () => {
    const result = resolveLocale({
      persistedPreference: 'fr',
      browserLanguages: ['de-DE'],
    })
    expect(result).toBe('fr')
  })

  it('resolves fr-CM to fr via the browser language step', () => {
    const result = resolveLocale({ browserLanguages: ['fr-CM'] })
    expect(result).toBe('fr')
  })

  it('resolves fr-FR to fr via the browser language step', () => {
    const result = resolveLocale({ browserLanguages: ['fr-FR'] })
    expect(result).toBe('fr')
  })

  it('resolves it-IT to it, de-DE to de, es-ES to es', () => {
    expect(resolveLocale({ browserLanguages: ['it-IT'] })).toBe('it')
    expect(resolveLocale({ browserLanguages: ['de-DE'] })).toBe('de')
    expect(resolveLocale({ browserLanguages: ['es-ES'] })).toBe('es')
  })

  it('walks navigator.languages in order until it finds a supported one', () => {
    const result = resolveLocale({ browserLanguages: ['zh-CN', 'pt-BR', 'it-IT', 'en-US'] })
    expect(result).toBe('it')
  })

  it('falls back to English when nothing in the chain is supported', () => {
    const result = resolveLocale({ browserLanguages: ['zh-CN', 'pt-BR'] })
    expect(result).toBe(DEFAULT_LOCALE)
  })

  it('falls back to English when nothing at all is provided', () => {
    expect(resolveLocale({})).toBe('en')
  })

  it('skips an unsupported stored/persisted locale safely rather than throwing', () => {
    // Simulates a stale localStorage value from a locale that existed in a
    // past build but was later dropped -- must degrade, not crash.
    const result = resolveLocale({
      persistedPreference: 'zz-INVALID',
      browserLanguages: ['it-IT'],
    })
    expect(result).toBe('it')
  })
})
