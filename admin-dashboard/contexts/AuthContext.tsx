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
import { toast } from 'sonner'

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
        setUser(userData.data.user)
      }
    } catch (error) {
      console.error('Failed to load user:', error)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
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

      // Check if user is admin or super_admin
      if (
        userData.userType !== 'admin' &&
        userData.userType !== 'super_admin'
      ) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        throw new Error('Access denied. Admin privileges required.')
      }

      setUser(userData)
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
