// ============================================
// TechTools Mobile App - Auth Store
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { User } from '../types'
import { authApi, clearTokens, wishlistApi } from '../api'
import { MobileNotificationService } from '../services/notification.service'
import { useWishlistStore } from './wishlistStore'
import { usePreferencesStore } from './preferencesStore'

// Guest -> account merge: whatever was favorited locally before this
// account existed (or before this login) gets folded into the real
// server-side wishlist in one request, then the store becomes the
// authoritative server list. One-directional import only (authStore ->
// wishlistStore) -- wishlistStore never imports authStore, so this can't
// create a cycle.
async function syncWishlistAfterAuth(): Promise<void> {
  try {
    const localItems = useWishlistStore.getState().items
    const merged = await wishlistApi.sync(localItems.map((item) => item.id))
    useWishlistStore.getState().hydrateFromServer(merged)
  } catch {
    // Best-effort -- never block a successful login/register on this.
  }
}

// Already-logged-in cold boot -- refresh from server in case the
// wishlist changed on another device.
function refreshWishlistFromServer(): void {
  wishlistApi
    .getAll()
    .then((items) => useWishlistStore.getState().hydrateFromServer(items))
    .catch(() => {})
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  hasHydrated: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    password: string
    firstName: string
    lastName: string
  }) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  initialize: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
  clearError: () => void
  setHasHydrated: (state: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      isInitialized: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const { user } = await authApi.login(email, password)
          set({ user, isAuthenticated: true, isLoading: false })
          void syncWishlistAfterAuth()
          // An EXISTING account may already have a real saved preference
          // (e.g. set on another device) -- that should win over
          // whatever this device just auto-detected.
          void usePreferencesStore.getState().syncFromServer()
        } catch (error: any) {
          const message =
            error.response?.data?.message || error.message || 'Login failed'
          set({ error: message, isLoading: false })
          throw error
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const { user } = await authApi.register(data)
          set({ user, isAuthenticated: true, isLoading: false })
          void syncWishlistAfterAuth()
          // A brand-new account has nothing saved server-side yet (just
          // column defaults) -- push this device's already-detected
          // preference up, the opposite direction from login's sync,
          // so it isn't clobbered back to EUR/English.
          usePreferencesStore.getState().persistToServerIfSignedIn(true)
        } catch (error: any) {
          const message =
            error.response?.data?.message ||
            error.message ||
            'Registration failed'
          set({ error: message, isLoading: false })
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          // Best-effort, and must run before clearTokens() below -- it
          // needs the still-valid session to authenticate the unregister
          // call, so a signed-out device stops receiving pushes meant for
          // the account that just signed out of it.
          await MobileNotificationService.unregisterPushToken()
          await authApi.logout()
        } catch {
          // Ignore logout errors
        } finally {
          await clearTokens()
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      checkAuth: async () => {
        // Wait for hydration before checking auth
        const waitForHydration = (): Promise<void> => {
          return new Promise((resolve) => {
            if (get().hasHydrated) {
              resolve()
              return
            }
            const unsubscribe = useAuthStore.subscribe((state) => {
              if (state.hasHydrated) {
                unsubscribe()
                resolve()
              }
            })
          })
        }

        await waitForHydration()

        // If already authenticated from persisted state, validate the session
        const currentState = get()
        if (currentState.isAuthenticated && currentState.user) {
          // User data is already persisted, try to validate but don't logout on failure
          set({ isLoading: true })
          try {
            const isAuth = await authApi.isAuthenticated()
            if (isAuth) {
              refreshWishlistFromServer()
              void usePreferencesStore.getState().syncFromServer()
              // Optionally refresh user data, but don't fail if it errors
              try {
                const user = await authApi.getCurrentUser()
                set({ user, isAuthenticated: true, isLoading: false })
              } catch {
                // Keep existing user data on API error
                set({ isLoading: false })
              }
            } else {
              // Token is definitely gone from SecureStore
              set({ user: null, isAuthenticated: false, isLoading: false })
            }
          } catch {
            // Network error - keep existing auth state
            set({ isLoading: false })
          }
          return
        }

        // Not authenticated from persisted state, check if there's a token
        set({ isLoading: true })
        try {
          const isAuth = await authApi.isAuthenticated()
          if (isAuth) {
            const user = await authApi.getCurrentUser()
            set({ user, isAuthenticated: true, isLoading: false })
            refreshWishlistFromServer()
            void usePreferencesStore.getState().syncFromServer()
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false })
          }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      initialize: async () => {
        // Wait for hydration then check auth
        await get().checkAuth()
        set({ isInitialized: true })
      },

      updateUser: (updates) => {
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                ...updates,
              }
            : state.user,
        }))
      },

      clearError: () => set({ error: null }),

      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
