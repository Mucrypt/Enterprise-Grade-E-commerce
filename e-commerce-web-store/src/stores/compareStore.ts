// ============================================
// Product Comparison Store (Zustand)
// ============================================
// Mirrors wishlistStore.ts's exact shape -- same persist pattern, same
// item-array + toggle/isIn/count convention.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../types';

export const MAX_COMPARE_ITEMS = 4;

interface CompareStore {
  items: Product[];

  // Actions
  toggleItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  clearCompare: () => void;

  // Computed
  isInCompare: (productId: string) => boolean;
  getItemCount: () => number;
  isFull: () => boolean;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      items: [],

      toggleItem: (product) => {
        const items = get().items;
        const exists = items.find((item) => item.id === product.id);

        if (exists) {
          set({ items: items.filter((item) => item.id !== product.id) });
        } else if (items.length < MAX_COMPARE_ITEMS) {
          set({ items: [...items, product] });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((item) => item.id !== productId) });
      },

      clearCompare: () => {
        set({ items: [] });
      },

      isInCompare: (productId) => {
        return get().items.some((item) => item.id === productId);
      },

      getItemCount: () => {
        return get().items.length;
      },

      isFull: () => {
        return get().items.length >= MAX_COMPARE_ITEMS;
      },
    }),
    {
      name: 'techtools-compare',
    }
  )
);
