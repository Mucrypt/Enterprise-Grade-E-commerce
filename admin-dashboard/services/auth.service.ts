import apiClient from '@/lib/api-client'
import type { AuthResponse, ApiResponse, User } from '@/types'

export const authService = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', { email, password })
  },

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<ApiResponse<{ accessToken: string }>> {
    return apiClient.post<ApiResponse<{ accessToken: string }>>(
      '/auth/refresh',
      { refreshToken },
    )
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return apiClient.get<ApiResponse<{ user: User }>>('/auth/me')
  },

  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse<any>> {
    return apiClient.post<ApiResponse<any>>('/auth/logout')
  },

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post<ApiResponse<any>>('/auth/change-password', {
      currentPassword,
      newPassword,
    })
  },

  /**
   * Get stored access token
   */
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken')
    }
    return null
  },

  /**
   * Get stored refresh token
   */
  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refreshToken')
    }
    return null
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken()
  },
}

export { User }
