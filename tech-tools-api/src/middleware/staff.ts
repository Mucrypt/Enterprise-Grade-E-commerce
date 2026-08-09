import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { query } from '../database/connection'
import logger from '../utils/logger'
import {
  Permission,
  StaffRole,
  STAFF_ROLE_PERMISSIONS,
} from '../config/staff-permissions.config'
import { recordStaffAuditEvent } from '../services/staff-audit.service'

// Additive authorization layer for the staff system. Deliberately does not
// touch authenticate()/authorize() from ./auth -- legacy admin/super_admin
// accounts (users.user_type) continue to work through those, completely
// unaffected by anything in this file. requireStaff/requirePermission are
// a second, independent gate used only on new staff-scoped routes.

export interface StaffMembershipRow {
  id: string
  role: StaffRole
  marketScope: string[] | null
}

export interface StaffContext {
  memberships: StaffMembershipRow[]
  permissions: Set<Permission>
}

export interface StaffAuthRequest extends AuthRequest {
  staff?: StaffContext
}

async function loadStaffContext(userId: string): Promise<StaffContext> {
  const result = await query(
    `SELECT id, role, market_scope
     FROM staff_memberships
     WHERE user_id = $1 AND status = 'ACTIVE'`,
    [userId],
  )

  const memberships: StaffMembershipRow[] = result.rows.map((row: any) => ({
    id: row.id,
    role: row.role as StaffRole,
    marketScope: row.market_scope,
  }))

  const permissions = new Set<Permission>()
  for (const membership of memberships) {
    const rolePermissions = STAFF_ROLE_PERMISSIONS[membership.role]
    if (rolePermissions) {
      for (const permission of rolePermissions) permissions.add(permission)
    }
  }

  return { memberships, permissions }
}

async function getStaffContext(req: StaffAuthRequest): Promise<StaffContext> {
  if (!req.staff) {
    req.staff = await loadStaffContext(req.user!.userId)
  }
  return req.staff
}

/**
 * Gate a route to callers holding at least one ACTIVE staff_memberships
 * row with one of the given roles. Suspended/revoked memberships never
 * satisfy this -- only rows the DB itself reports as status = 'ACTIVE'.
 */
export const requireStaff = (...roles: StaffRole[]) => {
  return async (req: StaffAuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    try {
      const staff = await getStaffContext(req)
      const hasRole = staff.memberships.some((m) => roles.includes(m.role))

      if (!hasRole) {
        recordStaffAuditEvent({
          action: 'PERMISSION_DENIED',
          actorUserId: req.user.userId,
          metadata: { check: 'requireStaff', requiredRoles: roles },
        })
        return res.status(403).json({ success: false, error: 'Insufficient staff role' })
      }

      next()
    } catch (error) {
      logger.error('requireStaff error:', error)
      next(error)
    }
  }
}

/**
 * Gate a route to callers whose union of ACTIVE staff_memberships grants
 * the given permission, per the matrix in config/staff-permissions.config.ts.
 * This is the primary enforcement point -- routes should prefer this over
 * requireStaff() wherever a specific permission (not just "any staff role")
 * is the real requirement.
 */
export const requirePermission = (permission: Permission) => {
  return async (req: StaffAuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    try {
      const staff = await getStaffContext(req)

      if (!staff.permissions.has(permission)) {
        recordStaffAuditEvent({
          action: 'PERMISSION_DENIED',
          actorUserId: req.user.userId,
          metadata: { check: 'requirePermission', permission },
        })
        return res.status(403).json({ success: false, error: 'Insufficient permissions' })
      }

      next()
    } catch (error) {
      logger.error('requirePermission error:', error)
      next(error)
    }
  }
}

/**
 * Passes if the caller's legacy users.user_type is one of legacyRoles
 * (e.g. 'super_admin'), OR if their staff permissions include `permission`.
 *
 * Why this exists: immediately after the staff system is introduced, zero
 * staff_memberships rows exist -- a pure requirePermission() gate on the
 * staff-management routes themselves would lock out everyone, including
 * the founder's own existing super_admin account, with no path to ever
 * create the first grant. Legacy super_admin is already the highest trust
 * level in the current system, so it's the natural bootstrap (and
 * continuing, per "legacy admins must continue working") path for
 * administering the new one -- this isn't a new privilege, it's the
 * existing one continuing to apply to a new surface.
 */
export const requirePermissionOrLegacyRole = (
  permission: Permission,
  ...legacyRoles: string[]
) => {
  return async (req: StaffAuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    if (legacyRoles.includes(req.user.userType)) {
      return next()
    }

    return requirePermission(permission)(req, res, next)
  }
}

export interface MarketScopeFilter {
  /** SQL fragment to AND onto an existing WHERE clause. Empty string = no restriction (global access). */
  clause: string
  /** Additional query parameters the clause's placeholder(s) reference, in order. */
  params: unknown[]
}

type ScopableResource = 'orders' | 'suppliers'

const RESOURCE_COUNTRY_EXPRESSIONS: Record<ScopableResource, string> = {
  // Matches the shape already used in shipping.controller.ts/order.controller.ts
  // for shipping_address, and suppliers.country_code from
  // 025_supplier_profitability_controls.sql.
  orders: `shipping_address->>'country'`,
  suppliers: `country_code`,
}

/**
 * Builds a market-scope SQL filter for the given resource, based on the
 * caller's staff context already attached to the request by
 * requireStaff/requirePermission (call one of those first).
 *
 * Global access (no filtering) applies if the caller holds ANY active
 * membership with market_scope IS NULL -- being scoped under one role must
 * never quietly narrow access already granted globally by another role the
 * same person also holds. NULL and "explicitly set to an empty array" are
 * deliberately NOT the same thing: NULL means "not restricted"; an empty
 * array means "restricted to nothing" and fails CLOSED (`1 = 0`) rather
 * than being treated as unrestricted -- an ambiguous/accidentally-cleared
 * scope should never silently widen into global access. If every
 * membership is scoped (non-null), the filter is the union of all their
 * country codes.
 */
export function applyMarketScope(
  req: StaffAuthRequest,
  resource: ScopableResource,
  nextParamIndex: number,
): MarketScopeFilter {
  const staff = req.staff
  if (!staff || staff.memberships.length === 0) {
    return { clause: '', params: [] }
  }

  const hasGlobalMembership = staff.memberships.some((m) => m.marketScope === null)
  if (hasGlobalMembership) {
    return { clause: '', params: [] }
  }

  const scopedCountries = Array.from(
    new Set(staff.memberships.flatMap((m) => m.marketScope || [])),
  )

  if (scopedCountries.length === 0) {
    return { clause: 'AND 1 = 0', params: [] }
  }

  const expression = RESOURCE_COUNTRY_EXPRESSIONS[resource]
  return {
    clause: `AND ${expression} = ANY($${nextParamIndex})`,
    params: [scopedCountries],
  }
}
