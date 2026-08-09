import { describe, it, expect, beforeEach } from 'vitest'
import { useLocaleStore, LOCALE_STORAGE_KEY, getPersistedLocale } from './localeStore'

describe('localeStore -- persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    useLocaleStore.setState({ locale: null, isExplicit: false })
  })

  it('persists an explicit choice under the documented storage key', () => {
    useLocaleStore.getState().setLocale('fr', true)

    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.state.locale).toBe('fr')
    expect(parsed.state.isExplicit).toBe(true)
  })

  it('a manual override is retained across a simulated "page reload" (fresh read of the persisted state)', () => {
    useLocaleStore.getState().setLocale('de', true)

    // Simulate a reload: zustand's persist middleware rehydrates from
    // localStorage on next store creation, but re-reading via the same
    // getState() after a set already reflects what's durably stored.
    const { locale, isExplicit } = getPersistedLocale()
    expect(locale).toBe('de')
    expect(isExplicit).toBe(true)
  })

  it('silently ignores an attempt to persist an unsupported locale (fails closed, not with a crash)', () => {
    useLocaleStore.getState().setLocale('it', true)
    useLocaleStore.getState().setLocale('xx-not-real', true)

    expect(useLocaleStore.getState().locale).toBe('it')
  })

  it('a non-explicit (browser-derived) resolution is recorded as such, distinguishing it from a real user choice', () => {
    useLocaleStore.getState().setLocale('es', false)

    expect(useLocaleStore.getState().isExplicit).toBe(false)
  })
})
