// ============================================
// Shopping Cart Store (Zustand)
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, ProductVariant } from '../types';

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  
  // Actions
  addItem: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  
  // Computed
  getItemCount: () => number;
  getSubtotal: () => number;
  getItem: (productId: string, variantId?: string) => CartItem | undefined;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product, quantity = 1, variant) => {
        const items = get().items;
        const existingItem = items.find(
          (item) => 
            item.product.id === product.id && 
            item.variant?.id === variant?.id
        );

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.id === existingItem.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          });
        } else {
          const newItem: CartItem = {
            id: `${product.id}-${variant?.id || 'default'}-${Date.now()}`,
            product,
            quantity,
            variant,
          };
          set({ items: [...items, newItem] });
        }
        
        // Open cart drawer on add
        set({ isOpen: true });
      },

      removeItem: (itemId) => {
        set({ items: get().items.filter((item) => item.id !== itemId) });
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }
        set({
          items: get().items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      toggleCart: () => {
        set({ isOpen: !get().isOpen });
      },

      openCart: () => {
        set({ isOpen: true });
      },

      closeCart: () => {
        set({ isOpen: false });
      },

      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          const price = Number(item.product.sale_price || item.product.base_price);
          const variantAdjustment = Number(item.variant?.price_adjustment || 0);
          return total + (price + variantAdjustment) * item.quantity;
        }, 0);
      },

      getItem: (productId, variantId) => {
        return get().items.find(
          (item) =>
            item.product.id === productId &&
            (!variantId || item.variant?.id === variantId)
        );
      },
    }),
    {
      name: 'techtools-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);
