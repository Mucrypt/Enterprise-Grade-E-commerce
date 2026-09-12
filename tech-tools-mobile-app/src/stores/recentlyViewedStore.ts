// ============================================
// TechTools Mobile App - Recently Viewed Store
// ============================================
// Real, on-device browsing history -- every entry is a product the user
// genuinely opened (recorded from product/[slug].tsx once that screen's
// real fetch resolves), never a fabricated "recommended" or "popular"
// list. Same persist/AsyncStorage pattern as wishlistStore.ts.
//
// Each entry carries a real viewedAt timestamp (set at the moment
// recordView actually runs) so the Recently Viewed screen can group
// entries into real Today/Yesterday/This Week/Earlier sections instead
// of one undifferentiated list -- storage key bumped to v2 since the
// previous shape (bare Product[], no timestamp) can't support that.
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../types'

const MAX_RECENTLY_VIEWED = 30

export interface RecentlyViewedEntry {
  product: Product
  viewedAt: number
}

interface RecentlyViewedState {
  items: RecentlyViewedEntry[]

  // Actions
  recordView: (product: Product) => void
  removeItem: (productId: string) => void
  clearAll: () => void
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],

      recordView: (product: Product) => {
        set((state) => {
          const withoutThisProduct = state.items.filter(
            (entry) => entry.product.id !== product.id,
          )
          // Most recently viewed first, capped so this never grows
          // unbounded in AsyncStorage.
          return {
            items: [
              { product, viewedAt: Date.now() },
              ...withoutThisProduct,
            ].slice(0, MAX_RECENTLY_VIEWED),
          }
        })
      },

      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter((entry) => entry.product.id !== productId),
        }))
      },

      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'recently-viewed-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
