// ============================================
// Auth Store (Zustand)
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi, wishlistApi } from '../api';
import { useWishlistStore } from './wishlistStore';

// Guest -> account merge: whatever was favorited locally before this
// account existed (or before this login) gets folded into the real
// server-side wishlist in one request, then the store becomes the
// authoritative server list. One-directional import only (authStore ->
// wishlistStore) -- wishlistStore never imports authStore, so this
// can't create a cycle.
async function syncWishlistAfterAuth(): Promise<void> {
  try {
    const localItems = useWishlistStore.getState().items;
    const merged = await wishlistApi.sync(localItems.map((item) => item.id));
    useWishlistStore.getState().hydrateFromServer(merged);
  } catch {
    // Best-effort -- never block a successful login/register on this.
  }
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearAuth: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      hasHydrated: false,

      setHasHydrated: (state) => {
        set({ hasHydrated: state });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { user } = await authApi.login(email, password);
          set({ user, isAuthenticated: true, isLoading: false });
          void syncWishlistAfterAuth();
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const { user } = await authApi.register(data);
          set({ user, isAuthenticated: true, isLoading: false });
          void syncWishlistAfterAuth();
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        // Clear local state immediately so the UI reflects "signed out"
        // right away, instead of waiting on the backend round-trip (which
        // callers like ProfilePage's handleLogout don't await before
        // navigating away -- the store update needs to already be done by
        // then, not still pending on a network call that could take up to
        // the request timeout to settle).
        set({ user: null, isAuthenticated: false });
        await authApi.logout();
      },

      fetchUser: async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const user = await authApi.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
          // Already-logged-in cold boot -- refresh from server in case
          // the wishlist changed on another device.
          wishlistApi
            .getAll()
            .then((items) => useWishlistStore.getState().hydrateFromServer(items))
            .catch(() => {});
        } catch (error: any) {
          // A bare `catch { logout }` treated ANY failure here as "not
          // logged in" -- a 429 (the API's rate limiter; a page like
          // Home firing a dozen-plus concurrent requests on load is far
          // more likely to trip it than a lighter page), a 500, a
          // network blip, all silently wiped a perfectly valid session.
          // Reported live: refreshing on Home logged users out soon
          // after login while Profile never did -- exactly the
          // request-volume difference this explains. Only a real 401/403
          // (the token itself is genuinely invalid/expired, or the
          // interceptor's own refresh attempt already failed and turned
          // this into a 401) means the session is actually over; anything
          // else is transient and must leave the existing session alone.
          const status = error?.response?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem('auth_token');
            set({ user: null, isAuthenticated: false, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        }
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      clearAuth: () => {
        localStorage.removeItem('auth_token');
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'techtools-auth',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
