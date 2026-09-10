// ============================================
// TechTools Mobile App - Recently Viewed Store
// ============================================
// Real, on-device browsing history -- every entry is a product the user
// genuinely opened (recorded from product/[slug].tsx once that screen's
// real fetch resolves), never a fabricated "recommended" or "popular"
// list. Same persist/AsyncStorage pattern as wishlistStore.ts.
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../types'

const MAX_RECENTLY_VIEWED = 30

interface RecentlyViewedState {
  items: Product[]

  // Actions
  recordView: (product: Product) => void
  clearAll: () => void
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],

      recordView: (product: Product) => {
        set((state) => {
          const withoutThisProduct = state.items.filter(
            (item) => item.id !== product.id,
          )
          // Most recently viewed first, capped so this never grows
          // unbounded in AsyncStorage.
          return {
            items: [product, ...withoutThisProduct].slice(
              0,
              MAX_RECENTLY_VIEWED,
            ),
          }
        })
      },

      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'recently-viewed-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
