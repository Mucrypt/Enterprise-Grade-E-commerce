// ============================================
// Shipping Settings Store (Zustand)
// ============================================
// Single fetch-once cache for the real, admin-configurable free-shipping
// threshold (shipping_settings.free_shipping_threshold via the public
// GET /shipping/settings/public endpoint) -- replaces the ~9 independently
// hand-typed "€50" literals previously scattered across Header, Footer,
// FAQ, CartDrawer, etc. with one real source of truth. Not persisted to
// localStorage (unlike deliveryLocationStore) -- this should reflect
// whatever an admin has configured, not a stale browser cache.

import { create } from 'zustand'
import { shippingApi } from '../api'

interface ShippingSettingsStore {
  freeShippingThreshold: number | null
  loaded: boolean
  fetchOnce: () => void
}

export const useShippingSettingsStore = create<ShippingSettingsStore>((set, get) => ({
  freeShippingThreshold: null,
  loaded: false,
  fetchOnce: () => {
    if (get().loaded) return
    set({ loaded: true }) // set immediately so concurrent mounts don't double-fetch
    shippingApi
      .getPublicSettings()
      .then((data) => set({ freeShippingThreshold: data.freeShippingThreshold }))
      .catch(() => {
        /* leave freeShippingThreshold null -- callers treat null as "don't claim a threshold" */
      })
  },
}))
