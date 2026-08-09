import { query } from '../database/connection'
import logger from '../utils/logger'

export type StaffAuditAction =
  | 'STAFF_GRANTED'
  | 'STAFF_SUSPENDED'
  | 'STAFF_REACTIVATED'
  | 'STAFF_REVOKED'
  | 'ROLE_CHANGED'
  | 'MARKET_SCOPE_CHANGED'
  | 'PERMISSION_DENIED'
  | 'STAFF_LOGIN'

export interface StaffAuditEventInput {
  action: StaffAuditAction
  staffMembershipId?: string | null
  actorUserId?: string | null
  targetUserId?: string | null
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  // Operational context only -- never passwords, JWTs, refresh tokens, API
  // keys, or payment credentials. Callers are responsible for keeping this
  // clean; this function does not attempt to redact arbitrary input.
  metadata?: Record<string, unknown>
}

// Fire-and-forget by design: a failure to write an audit row must never
// break the request it's describing, the same pattern already used for
// notification dispatch elsewhere in this codebase (e.g.
// anomaly.detector.ts's createAlert -> dispatchAlertToAllAdmins).
export async function recordStaffAuditEvent(
  event: StaffAuditEventInput,
): Promise<void> {
  try {
    await query(
      `INSERT INTO staff_audit_log
        (staff_membership_id, action, actor_user_id, target_user_id, before_state, after_state, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.staffMembershipId || null,
        event.action,
        event.actorUserId || null,
        event.targetUserId || null,
        event.beforeState ? JSON.stringify(event.beforeState) : null,
        event.afterState ? JSON.stringify(event.afterState) : null,
        JSON.stringify(event.metadata || {}),
      ],
    )
  } catch (error) {
    logger.error('Failed to record staff audit event:', error)
  }
}
