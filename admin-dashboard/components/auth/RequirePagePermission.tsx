'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useStaffAccess } from '@/contexts/StaffAccessContext'

interface RequirePagePermissionProps {
  /** One permission, or several -- combined per `mode` (default 'any'). Omit if the page only needs `legacyOnly`. */
  permission?: string | string[]
  mode?: 'all' | 'any'
  /**
   * Same escape hatch as NavItem.requiresLegacyAdmin in Sidebar.tsx -- for
   * pages whose backend route stays legacy-admin-only even though a
   * scoped role nominally holds the listed permission (e.g. the global
   * customer directory).
   */
  legacyOnly?: boolean
  redirectTo?: string
  children: ReactNode
}

/**
 * Page-level route guard. PermissionGate (components/auth/PermissionGate.tsx)
 * hides a piece of content *within* an already-rendered page; this instead
 * protects an entire page/route from direct navigation (typing the URL,
 * a bookmark, a stale link) -- sidebar hiding alone never stops that, it
 * only hides the link.
 *
 * Still not the actual security boundary: the API route(s) this page calls
 * must independently enforce the same permission (requirePermission /
 * requirePermissionOrLegacyRole in middleware/staff.ts). This only avoids
 * rendering a page whose data-fetching would otherwise just 403 anyway, and
 * gives the user an honest redirect instead of a broken/empty page.
 *
 * Usage: wrap a page's default-exported component's returned JSX, e.g.
 *   export default function SettingsPage() {
 *     return (
 *       <RequirePagePermission permission="settings.view">
 *         ...actual page content...
 *       </RequirePagePermission>
 *     )
 *   }
 */
export function RequirePagePermission({
  permission,
  mode = 'any',
  legacyOnly = false,
  redirectTo = '/dashboard',
  children,
}: RequirePagePermissionProps) {
  const router = useRouter()
  const { hasPermission, isLegacyAdmin, isLoading } = useStaffAccess()
  const hasWarnedRef = useRef(false)

  const permissions = permission ? (Array.isArray(permission) ? permission : [permission]) : []
  const permissionSatisfied =
    permissions.length === 0
      ? true
      : mode === 'all'
        ? permissions.every(hasPermission)
        : permissions.some(hasPermission)
  const allowed = isLoading ? null : (!legacyOnly || isLegacyAdmin) && permissionSatisfied

  useEffect(() => {
    if (allowed === false && !hasWarnedRef.current) {
      hasWarnedRef.current = true
      toast.error("You don't have permission to view this page.")
      router.replace(redirectTo)
    }
  }, [allowed, redirectTo, router])

  if (isLoading || allowed === null) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (allowed === false) {
    // Redirect is already underway (see the effect above) -- render
    // nothing rather than a flash of restricted content.
    return null
  }

  return <>{children}</>
}
