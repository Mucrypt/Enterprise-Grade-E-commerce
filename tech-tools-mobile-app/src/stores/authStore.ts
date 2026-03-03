// ============================================
// TechTools Mobile App - Auth Store
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { User } from '../types'
import { authApi, clearTokens } from '../api'

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
