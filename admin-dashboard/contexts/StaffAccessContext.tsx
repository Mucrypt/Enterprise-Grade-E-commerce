'use client'

import { createContext, useContext, ReactNode, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { staffService } from '@/services/staff.service'
import { useAuth } from './AuthContext'

interface StaffAccessContextType {
  isLoading: boolean
  legacyUserType: string | null
  isLegacyAdmin: boolean
  memberships: Array<{ id: string; role: string; marketScope: string[] | null }>
  permissions: Set<string>
  /**
   * Legacy admin/super_admin are treated as having every permission --
   * matching their existing, unrestricted access to every current admin
   * route (nothing in this phase narrows what they could already do).
   * Everyone else is checked against their actual staff permission set.
   */
  hasPermission: (permission: string) => boolean
}

const StaffAccessContext = createContext<StaffAccessContextType | undefined>(undefined)

export function StaffAccessProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['staff-me'],
    queryFn: () => staffService.getMyContext(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  })

  const value = useMemo<StaffAccessContextType>(() => {
    const legacyUserType = data?.data?.legacyUserType ?? null
    const isLegacyAdmin = legacyUserType === 'admin' || legacyUserType === 'super_admin'
    const permissions = new Set(data?.data?.permissions || [])

    return {
      isLoading,
      legacyUserType,
      isLegacyAdmin,
      memberships: data?.data?.memberships || [],
      permissions,
      hasPermission: (permission: string) => isLegacyAdmin || permissions.has(permission),
    }
  }, [data, isLoading])

  return (
    <StaffAccessContext.Provider value={value}>{children}</StaffAccessContext.Provider>
  )
}

export function useStaffAccess() {
  const ctx = useContext(StaffAccessContext)
  if (ctx === undefined) {
    throw new Error('useStaffAccess must be used within a StaffAccessProvider')
  }
  return ctx
}
