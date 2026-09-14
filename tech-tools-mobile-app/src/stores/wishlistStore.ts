// ============================================
// TechTools Mobile App - Wishlist Store
//
// Local-first, so a guest's wishlist works exactly as before (persisted
// to AsyncStorage, no account needed). For a signed-in user, addItem/
// removeItem ALSO fire a best-effort real API call so the wishlist is
// genuinely server-backed -- fire-and-forget, errors swallowed, since a
// 401 (guest, not logged in) is an expected, normal outcome here, not a
// failure to surface. hydrateFromServer() replaces local items wholesale
// -- used right after the guest->account merge on login/register, and on
// app boot for an already-logged-in user.
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../types'
import { wishlistApi } from '../api'

interface WishlistState {
  items: Product[]

  // Actions
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  toggleItem: (product: Product) => void
  isInWishlist: (productId: string) => boolean
  clearWishlist: () => void
  hydrateFromServer: (items: Product[]) => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product: Product) => {
        set((state) => {
          if (state.items.some((item) => item.id === product.id)) {
            return state
          }
          return { items: [...state.items, product] }
        })
        wishlistApi.add(product.id).catch(() => {
          // Guest (401) or offline -- stays local-only, that's fine.
        })
      },

      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== productId),
        }))
        wishlistApi.remove(productId).catch(() => {
          // Guest (401) or offline -- stays local-only, that's fine.
        })
      },

      toggleItem: (product: Product) => {
        const isInWishlist = get().isInWishlist(product.id)
        if (isInWishlist) {
          get().removeItem(product.id)
        } else {
          get().addItem(product)
        }
      },

      isInWishlist: (productId: string) => {
        return get().items.some((item) => item.id === productId)
      },

      clearWishlist: () => {
        set({ items: [] })
        wishlistApi.clear().catch(() => {
          // Guest (401) or offline -- stays local-only, that's fine.
        })
      },

      hydrateFromServer: (items: Product[]) => {
        set({ items })
      },
    }),
    {
      name: 'wishlist-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
