// ============================================
// Wishlist Store (Zustand)
//
// Local-first, so a guest's wishlist works exactly as before (persisted
// to localStorage, no account needed). For a signed-in user, addItem/
// removeItem/clearWishlist ALSO fire a best-effort real API call so the
// wishlist is genuinely server-backed -- fire-and-forget, errors
// swallowed, since a 401 (guest, not logged in) is an expected, normal
// outcome here, not a failure to surface. hydrateFromServer() replaces
// local items wholesale -- used right after the guest->account merge on
// login/register, and on app boot for an already-logged-in user.
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../types';
import { wishlistApi } from '../api';

interface WishlistStore {
  items: Product[];

  // Actions
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  toggleItem: (product: Product) => void;
  clearWishlist: () => void;
  hydrateFromServer: (items: Product[]) => void;

  // Computed
  isInWishlist: (productId: string) => boolean;
  getItemCount: () => number;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        const items = get().items;
        if (!items.find((item) => item.id === product.id)) {
          set({ items: [...items, product] });
          wishlistApi.add(product.id).catch(() => {
            // Guest (401) or offline -- stays local-only, that's fine.
          });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((item) => item.id !== productId) });
        wishlistApi.remove(productId).catch(() => {
          // Guest (401) or offline -- stays local-only, that's fine.
        });
      },

      toggleItem: (product) => {
        const items = get().items;
        const exists = items.find((item) => item.id === product.id);

        if (exists) {
          get().removeItem(product.id);
        } else {
          get().addItem(product);
        }
      },

      clearWishlist: () => {
        set({ items: [] });
        wishlistApi.clear().catch(() => {
          // Guest (401) or offline -- stays local-only, that's fine.
        });
      },

      hydrateFromServer: (items) => {
        set({ items });
      },

      isInWishlist: (productId) => {
        return get().items.some((item) => item.id === productId);
      },

      getItemCount: () => {
        return get().items.length;
      },
    }),
    {
      name: 'techtools-wishlist',
    }
  )
);
