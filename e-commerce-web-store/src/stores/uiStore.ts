// ============================================
// UI Store (Zustand) - For global UI state
// ============================================

import { create } from 'zustand';

interface UIStore {
  // Search
  isSearchOpen: boolean;
  searchQuery: string;
  
  // Mobile Menu
  isMobileMenuOpen: boolean;
  
  // Modals
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  
  // Notifications
  notifications: Notification[];
  
  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export const useUIStore = create<UIStore>((set, get) => ({
  isSearchOpen: false,
  searchQuery: '',
  isMobileMenuOpen: false,
  activeModal: null,
  modalData: null,
  notifications: [],

  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false, searchQuery: '' }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleMobileMenu: () => set({ isMobileMenuOpen: !get().isMobileMenuOpen }),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),

  openModal: (modalId, data) => set({ activeModal: modalId, modalData: data || null }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  addNotification: (notification) => {
    const id = `notification-${Date.now()}`;
    const newNotification = { ...notification, id };
    
    set({ notifications: [...get().notifications, newNotification] });
    
    // Auto remove after duration
    const duration = notification.duration || 5000;
    setTimeout(() => {
      get().removeNotification(id);
    }, duration);
  },

  removeNotification: (id) => {
    set({ notifications: get().notifications.filter((n) => n.id !== id) });
  },
}));
