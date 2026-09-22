import { useEffect, useRef } from 'react'
import { localeApi } from '../api'
import { usePreferencesStore } from '../stores/preferencesStore'
import { SUPPORTED_CURRENCIES } from '../i18n/currencyConfig'

// Fetches every supported currency's rate against EUR once per app
// session (mirrors the backend's own once-per-day cache -- refetching on
// every mount would be pointless churn) and writes it into
// preferencesStore so formatPrice() picks it up everywhere without every
// price-displaying screen needing its own fetch. Call this once from a
// high-level place (root layout) -- it's safe to mount more than once,
// the ref guards a duplicate in-flight fetch.
export function useCurrencyRates(): void {
  const setRates = usePreferencesStore((s) => s.setRates)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    const targets = SUPPORTED_CURRENCIES.filter((c) => c !== 'EUR')

    localeApi
      .getRates('EUR', [...targets])
      .then((result) => setRates(result.rates))
      .catch(() => {
        // Best-effort -- formatPrice() already falls back to the real
        // EUR price when a rate isn't available, so a failed fetch here
        // degrades gracefully rather than breaking price display.
        hasFetchedRef.current = false
      })
  }, [setRates])
}
