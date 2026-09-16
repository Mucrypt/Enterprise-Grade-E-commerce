// ============================================
// TechTools Mobile App - Cart Store
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CartItem, Product, ProductVariant } from '../types'

interface CartState {
  items: CartItem[]
  isOpen: boolean

  // Computed
  itemCount: () => number
  subtotal: () => number

  // Actions
  addItem: (
    product: Product,
    quantity?: number,
    variant?: ProductVariant,
    sourceDiscoverPostId?: string,
  ) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void
  clearCart: () => void
  toggleCart: () => void
  setCartOpen: (isOpen: boolean) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      itemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      subtotal: () => {
        return get().items.reduce((total, item) => {
          const price =
            Number(item.product.sale_price) || Number(item.product.base_price)
          const variantAdjustment = Number(item.variant?.price_adjustment || 0)
          return total + (price + variantAdjustment) * item.quantity
        }, 0)
      },

      addItem: (product: Product, quantity = 1, variant, sourceDiscoverPostId) => {
        set((state) => {
          const existingItem = state.items.find(
            (item) =>
              item.product.id === product.id && item.variant?.id === variant?.id,
          )

          if (existingItem) {
            // First-touch attribution -- merging more of an already-in-cart
            // item never overwrites whatever source originally added it.
            return {
              items: state.items.map((item) =>
                item.id === existingItem.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              ),
            }
          }

          return {
            items: [
              ...state.items,
              {
                id: `cart-${product.id}-${variant?.id || 'default'}-${Date.now()}`,
                product,
                quantity,
                variant,
                sourceDiscoverPostId,
              },
            ],
          }
        })
      },

      removeItem: (productId: string, variantId?: string) => {
        set((state) => ({
          items: state.items.filter(
            (item) =>
              !(item.product.id === productId && item.variant?.id === variantId),
          ),
        }))
      },

      updateQuantity: (productId: string, quantity: number, variantId?: string) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId)
          return
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.product.id === productId && item.variant?.id === variantId
              ? { ...item, quantity }
              : item,
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      setCartOpen: (isOpen: boolean) => set({ isOpen }),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
)
