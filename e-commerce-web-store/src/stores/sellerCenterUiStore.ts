// ============================================
// Seller Center UI Store (Zustand)
// ============================================
// Tiny, persisted-preference-only store -- mirrors authStore's use of
// zustand/middleware persist. Holds nothing sensitive, just a per-device
// UI preference (sidebar collapsed or not) that should survive reloads.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SellerCenterUiStore {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useSellerCenterUiStore = create<SellerCenterUiStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'techtools-seller-center-ui',
    },
  ),
)
