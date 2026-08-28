// ============================================
// Delivery Location Store (Zustand)
// Guest/browser delivery-country preference persistence
// ============================================
// Mirrors localeStore.ts's shape (persist middleware, one clear storage
// key) -- kept as its OWN store rather than folded into localeStore,
// because resolveLocale.ts already documents "language != country" as a
// deliberate principle in this codebase: a shopper's delivery country and
// their browser language are independent signals.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const DELIVERY_LOCATION_STORAGE_KEY = 'techtools-delivery-location'

interface DeliveryLocationStore {
  /** Null until resolved (by the server's IP guess or an explicit pick). */
  countryCode: string | null
  /** True once the shopper explicitly picked a country via "Update location", as opposed to it being the server's IP guess. */
  isExplicit: boolean
  setCountry: (countryCode: string, explicit: boolean) => void
}

export const useDeliveryLocationStore = create<DeliveryLocationStore>()(
  persist(
    (set) => ({
      countryCode: null,
      isExplicit: false,
      setCountry: (countryCode, explicit) => {
        set({ countryCode: countryCode.toUpperCase(), isExplicit: explicit })
      },
    }),
    {
      name: DELIVERY_LOCATION_STORAGE_KEY,
      // A geoip guess (explicit=false) is used for the current render but
      // never written to disk -- previously ANY guess, right or wrong, was
      // cached in localStorage forever with no expiry or re-check, which is
      // how a stale/wrong country (e.g. "United States") could survive
      // indefinitely for a shopper who never touched "Update location".
      // Only a real, explicit pick should outlive the session.
      partialize: (state) => (state.isExplicit ? state : { countryCode: null, isExplicit: false }),
    },
  ),
)

/** Non-hook accessor for use outside React. */
export function getPersistedDeliveryCountry(): { countryCode: string | null; isExplicit: boolean } {
  const state = useDeliveryLocationStore.getState()
  return { countryCode: state.countryCode, isExplicit: state.isExplicit }
}
