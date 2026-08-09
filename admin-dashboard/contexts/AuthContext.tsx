'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { authService, User } from '@/services/auth.service'
import { staffService } from '@/services/staff.service'
import { toast } from 'sonner'
import { setAdminRoleCookie, clearAdminRoleCookie } from '@/lib/admin-role-cookie'

const LEGACY_ADMIN_TYPES = ['admin', 'super_admin']

// Resolves what should go in the dashboard-access cookie for a given user:
// their own legacy user_type if it's admin/super_admin (unchanged
// behavior), or the 'staff' marker if they hold at least one ACTIVE
// staff_memberships grant despite a non-admin user_type (e.g. a
// MARKET_MANAGER whose user_type is still 'customer' -- staff access is
// additive and never touches user_type, see
// docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md). Returns null if neither applies.
async function resolveDashboardAccessMarker(
  userType: string | undefined,
): Promise<string | null> {
  if (userType && LEGACY_ADMIN_TYPES.includes(userType)) {
    return userType
  }

  try {
    const staffContext = await staffService.getMyContext()
    const hasActiveMembership = (staffContext.data?.memberships?.length || 0) > 0
    return hasActiveMembership ? 'staff' : null
  } catch (error) {
    console.error('Failed to check staff access:', error)
    return null
  }
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const isAuthenticated = !!user

  // Load user on mount
  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setIsLoading(false)
        return
      }

      const userData = await authService.getCurrentUser()
      if (userData.data?.user) {
        const fetchedUser = userData.data.user
        const accessMarker = await resolveDashboardAccessMarker(fetchedUser.userType)
        setUser(fetchedUser)
        setAdminRoleCookie(accessMarker)
      }
    } catch (error) {
      console.error('Failed to load user:', error)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      clearAdminRoleCookie()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password)
      const { user: userData, tokens } = response.data

      const accessToken = tokens?.accessToken
      const refreshToken = tokens?.refreshToken

      if (!accessToken) {
        throw new Error('Login failed: missing access token')
      }

      // Save token
      localStorage.setItem('accessToken', accessToken)
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken)
      }

      // Admin/super_admin (unchanged) OR an active staff_memberships grant
      // (e.g. MARKET_MANAGER) may use this dashboard -- a plain customer
      // with neither is rejected exactly as before.
      const accessMarker = await resolveDashboardAccessMarker(userData.userType)
      if (!accessMarker) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        throw new Error('Access denied. Admin or staff privileges required.')
      }

      setUser(userData)
      setAdminRoleCookie(accessMarker)
      toast.success('Login successful')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Login failed:', error)
      const message =
        error.response?.data?.error || error.message || 'Login failed'
      toast.error(message)
      throw error
    }
  }

  const logout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      clearAdminRoleCookie()
      setUser(null)
      router.push('/login')
      toast.success('Logged out successfully')
    }
  }

  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser()
      if (userData.data?.user) {
        setUser(userData.data.user)
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
      await logout()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
