import { query } from '../database/connection'
import logger from '../utils/logger'

/**
 * Shared write helper for the `admin_activity_logs` table. This table
 * already existed (002_admin_management_schema.sql) and was already being
 * fed by 4 independently-duplicated inline INSERTs across
 * supplier.controller.ts, admin.controller.ts, books.controller.ts, and
 * customers.controller.ts -- this consolidates the *pattern* for the new
 * call sites this service was introduced for, without touching those 3
 * pre-existing duplicates (out of scope; they still work as-is).
 *
 * `action` has no DB-level enum/CHECK constraint (VARCHAR(100)), so this
 * union is additive documentation, not an exhaustive list of every string
 * that ends up in the column -- the pre-existing call sites use their own
 * free-form action strings (e.g. 'update_supplier_status', 'invite_admin').
 */
export type AdminActivityAction =
  | 'order_status_changed'
  | 'order_refunded'
  | 'product_updated'
  | 'supplier_updated'

export interface AdminActivityEventInput {
  actorUserId: string
  action: AdminActivityAction
  resourceType: string
  resourceId?: string | null
  ip?: string | null
  userAgent?: string | null
  details?: Record<string, unknown>
}

// Fire-and-forget by design, same convention as staff-audit.service.ts's
// recordStaffAuditEvent -- a failure to write an activity row must never
// break the request it's describing.
export async function recordAdminActivity(event: AdminActivityEventInput): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_activity_logs
        (admin_id, action, resource_type, resource_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        event.actorUserId,
        event.action,
        event.resourceType,
        event.resourceId || null,
        event.ip || null,
        event.userAgent || null,
        JSON.stringify(event.details || {}),
      ],
    )
  } catch (error) {
    logger.error('Failed to record admin activity event:', error)
  }
}
