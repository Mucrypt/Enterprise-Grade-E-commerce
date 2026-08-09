'use client'

import { ReactNode } from 'react'
import { useStaffAccess } from '@/contexts/StaffAccessContext'

interface PermissionGateProps {
  /** One permission, or several -- combined per `mode` (default 'all'). */
  permission: string | string[]
  mode?: 'all' | 'any'
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Server-side enforcement (requirePermission/requireStaff in the API) is
 * the actual security boundary -- this component only decides what to
 * render. Never treat hiding a link here as authorization by itself; every
 * route this gates must also be enforced by the API. See Part W of the
 * ADMIN-PLATFORM-2 roadmap for why frontend-only gating is explicitly
 * called out as insufficient.
 */
export function PermissionGate({
  permission,
  mode = 'all',
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, isLoading } = useStaffAccess()

  // Avoid a flash of restricted content while /staff/me is still resolving.
  if (isLoading) return null

  const permissions = Array.isArray(permission) ? permission : [permission]
  const authorized =
    mode === 'all' ? permissions.every(hasPermission) : permissions.some(hasPermission)

  if (!authorized) return <>{fallback}</>

  return <>{children}</>
}
