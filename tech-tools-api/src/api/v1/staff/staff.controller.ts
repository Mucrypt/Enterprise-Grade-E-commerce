import { Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { StaffAuthRequest } from '../../../middleware/staff'
import {
  StaffRole,
  ROLE_AUTHORITY_RANK,
  STAFF_ROLE_PERMISSIONS,
  isValidStaffRole,
} from '../../../config/staff-permissions.config'
import { recordStaffAuditEvent } from '../../../services/staff-audit.service'

// Never select password_hash or anything beyond what an Organization/Staff
// admin screen legitimately needs -- every response in this file is
// redacted to this shape or narrower.
const SAFE_USER_COLUMNS = `u.email, u.first_name, u.last_name, u.user_type`

function actorMaxRank(req: StaffAuthRequest): number {
  const memberships = req.staff?.memberships || []
  return memberships.reduce(
    (max, m) => Math.max(max, ROLE_AUTHORITY_RANK[m.role] ?? 0),
    0,
  )
}

function shapeMembership(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    legacyUserType: row.user_type,
    role: row.role,
    status: row.status,
    marketScope: row.market_scope,
    grantedBy: row.granted_by,
    grantedAt: row.granted_at,
    suspendedAt: row.suspended_at,
    suspendedBy: row.suspended_by,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loadMembership(id: string) {
  const result = await query(
    `SELECT sm.*, ${SAFE_USER_COLUMNS}
     FROM staff_memberships sm
     JOIN users u ON u.id = sm.user_id
     WHERE sm.id = $1`,
    [id],
  )
  return result.rows[0] || null
}

async function wouldRemoveLastTopAuthority(
  excludeMembershipId: string,
): Promise<boolean> {
  const result = await query(
    `SELECT COUNT(*) FROM staff_memberships
     WHERE role IN ('OWNER', 'SUPER_ADMIN') AND status = 'ACTIVE' AND id != $1`,
    [excludeMembershipId],
  )
  return parseInt(result.rows[0].count, 10) === 0
}

export const listStaff = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { status, role, page = 1, limit = 50 } = req.query
    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = []
    const params: any[] = []
    let i = 1

    if (status) {
      conditions.push(`sm.status = $${i++}`)
      params.push(status)
    }
    if (role) {
      conditions.push(`sm.role = $${i++}`)
      params.push(role)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const listParams = [...params, Number(limit), offset]
    const result = await query(
      `SELECT sm.*, ${SAFE_USER_COLUMNS}
       FROM staff_memberships sm
       JOIN users u ON u.id = sm.user_id
       ${whereClause}
       ORDER BY sm.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      listParams,
    )

    const countResult = await query(
      `SELECT COUNT(*) FROM staff_memberships sm ${whereClause}`,
      params,
    )

    res.json({
      success: true,
      data: {
        staff: result.rows.map(shapeMembership),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: parseInt(countResult.rows[0].count, 10),
        },
      },
    })
  } catch (error) {
    logger.error('List staff error:', error)
    res.status(500).json({ success: false, error: 'Failed to list staff' })
  }
}

export const getStaffById = async (req: StaffAuthRequest, res: Response) => {
  try {
    const membership = await loadMembership(req.params.id)
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Staff membership not found' })
    }
    res.json({ success: true, data: { staff: shapeMembership(membership) } })
  } catch (error) {
    logger.error('Get staff by id error:', error)
    res.status(500).json({ success: false, error: 'Failed to get staff membership' })
  }
}

export const getMyStaffContext = async (req: StaffAuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const result = await query(
      `SELECT id, role, market_scope
       FROM staff_memberships
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [req.user.userId],
    )

    const memberships = result.rows.map((row: any) => ({
      id: row.id,
      role: row.role as StaffRole,
      marketScope: row.market_scope,
    }))

    const permissions = new Set<string>()
    for (const membership of memberships) {
      const rolePermissions = STAFF_ROLE_PERMISSIONS[membership.role]
      if (rolePermissions) {
        for (const permission of rolePermissions) permissions.add(permission)
      }
    }

    res.json({
      success: true,
      data: {
        legacyUserType: req.user.userType,
        memberships,
        permissions: Array.from(permissions),
      },
    })
  } catch (error) {
    logger.error('Get my staff context error:', error)
    res.status(500).json({ success: false, error: 'Failed to get staff context' })
  }
}

// Grants target an EXISTING user by id or verified email lookup only --
// this never creates a user row. A customer account gains staff
// capability additively; users.user_type is never touched.
export const grantStaffMembership = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { userId, email, role, marketScope } = req.body
    const actorUserId = req.user!.userId

    if (!role || !isValidStaffRole(role)) {
      return res.status(400).json({ success: false, error: 'A valid role is required' })
    }

    if (ROLE_AUTHORITY_RANK[role as StaffRole] > actorMaxRank(req) && req.user!.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot grant a role with more authority than your own',
      })
    }

    if (!userId && !email) {
      return res.status(400).json({ success: false, error: 'userId or email is required' })
    }

    if (marketScope !== undefined && marketScope !== null && !Array.isArray(marketScope)) {
      return res.status(400).json({
        success: false,
        error: 'marketScope must be an array of country codes or null',
      })
    }

    const userResult = userId
      ? await query('SELECT id, email FROM users WHERE id = $1 AND is_active = true', [userId])
      : await query('SELECT id, email FROM users WHERE email = $1 AND is_active = true', [email])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No matching active user found' })
    }

    const targetUser = userResult.rows[0]

    if (targetUser.id === actorUserId) {
      return res.status(403).json({
        success: false,
        error: 'You cannot grant yourself a staff role',
      })
    }

    const existing = await query(
      `SELECT id FROM staff_memberships
       WHERE user_id = $1 AND role = $2 AND status IN ('ACTIVE', 'SUSPENDED')`,
      [targetUser.id, role],
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'This user already holds a current (active or suspended) grant of this role',
      })
    }

    const insertResult = await query(
      `INSERT INTO staff_memberships (user_id, role, market_scope, status, granted_by, granted_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, now())
       RETURNING *`,
      [targetUser.id, role, marketScope || null, actorUserId],
    )

    const membership = insertResult.rows[0]

    await recordStaffAuditEvent({
      action: 'STAFF_GRANTED',
      staffMembershipId: membership.id,
      actorUserId,
      targetUserId: targetUser.id,
      afterState: { role, marketScope: marketScope || null, status: 'ACTIVE' },
      metadata: { targetEmail: targetUser.email },
    })

    logger.info('Staff membership granted:', {
      membershipId: membership.id,
      role,
      targetUserId: targetUser.id,
      actorUserId,
    })

    res.status(201).json({
      success: true,
      data: { staff: shapeMembership({ ...membership, email: targetUser.email }) },
    })
  } catch (error) {
    logger.error('Grant staff membership error:', error)
    res.status(500).json({ success: false, error: 'Failed to grant staff membership' })
  }
}

export const updateStaffRole = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { role } = req.body
    const actorUserId = req.user!.userId

    if (!role || !isValidStaffRole(role)) {
      return res.status(400).json({ success: false, error: 'A valid role is required' })
    }

    const membership = await loadMembership(id)
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Staff membership not found' })
    }
    if (membership.user_id === actorUserId) {
      return res.status(403).json({ success: false, error: 'You cannot change your own role' })
    }

    const actorRank = actorMaxRank(req)
    const isLegacySuperAdmin = req.user!.userType === 'super_admin'
    if (
      !isLegacySuperAdmin &&
      (ROLE_AUTHORITY_RANK[role as StaffRole] > actorRank ||
        ROLE_AUTHORITY_RANK[membership.role as StaffRole] > actorRank)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify a role with more authority than your own',
      })
    }

    if (
      membership.status === 'ACTIVE' &&
      ['OWNER', 'SUPER_ADMIN'].includes(membership.role) &&
      !['OWNER', 'SUPER_ADMIN'].includes(role) &&
      (await wouldRemoveLastTopAuthority(id))
    ) {
      return res.status(409).json({
        success: false,
        error: 'Cannot change this role: it is the last remaining OWNER/SUPER_ADMIN',
      })
    }

    const updateResult = await query(
      `UPDATE staff_memberships SET role = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [role, id],
    )

    await recordStaffAuditEvent({
      action: 'ROLE_CHANGED',
      staffMembershipId: id,
      actorUserId,
      targetUserId: membership.user_id,
      beforeState: { role: membership.role },
      afterState: { role },
    })

    res.json({
      success: true,
      data: { staff: shapeMembership({ ...updateResult.rows[0], email: membership.email }) },
    })
  } catch (error) {
    logger.error('Update staff role error:', error)
    res.status(500).json({ success: false, error: 'Failed to update staff role' })
  }
}

export const updateMarketScope = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { marketScope } = req.body
    const actorUserId = req.user!.userId

    if (marketScope !== null && !Array.isArray(marketScope)) {
      return res.status(400).json({
        success: false,
        error: 'marketScope must be an array of country codes or null',
      })
    }

    const membership = await loadMembership(id)
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Staff membership not found' })
    }
    if (membership.user_id === actorUserId) {
      return res.status(403).json({ success: false, error: 'You cannot change your own market scope' })
    }

    const actorRank = actorMaxRank(req)
    if (
      req.user!.userType !== 'super_admin' &&
      ROLE_AUTHORITY_RANK[membership.role as StaffRole] > actorRank
    ) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify a role with more authority than your own',
      })
    }

    const updateResult = await query(
      `UPDATE staff_memberships SET market_scope = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [marketScope, id],
    )

    await recordStaffAuditEvent({
      action: 'MARKET_SCOPE_CHANGED',
      staffMembershipId: id,
      actorUserId,
      targetUserId: membership.user_id,
      beforeState: { marketScope: membership.market_scope },
      afterState: { marketScope },
    })

    res.json({
      success: true,
      data: { staff: shapeMembership({ ...updateResult.rows[0], email: membership.email }) },
    })
  } catch (error) {
    logger.error('Update market scope error:', error)
    res.status(500).json({ success: false, error: 'Failed to update market scope' })
  }
}

export const suspendStaffMembership = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const actorUserId = req.user!.userId

    const membership = await loadMembership(id)
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Staff membership not found' })
    }
    if (membership.user_id === actorUserId) {
      return res.status(403).json({ success: false, error: 'You cannot suspend your own staff access' })
    }
    if (membership.status !== 'ACTIVE') {
      return res.status(409).json({ success: false, error: `Membership is already ${membership.status}` })
    }

    const actorRank = actorMaxRank(req)
    if (
      req.user!.userType !== 'super_admin' &&
      ROLE_AUTHORITY_RANK[membership.role as StaffRole] > actorRank
    ) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify a role with more authority than your own',
      })
    }

    if (
      ['OWNER', 'SUPER_ADMIN'].includes(membership.role) &&
      (await wouldRemoveLastTopAuthority(id))
    ) {
      return res.status(409).json({
        success: false,
        error: 'Cannot suspend the last remaining OWNER/SUPER_ADMIN',
      })
    }

    const updateResult = await query(
      `UPDATE staff_memberships
       SET status = 'SUSPENDED', suspended_at = now(), suspended_by = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [actorUserId, id],
    )

    await recordStaffAuditEvent({
      action: 'STAFF_SUSPENDED',
      staffMembershipId: id,
      actorUserId,
      targetUserId: membership.user_id,
      beforeState: { status: membership.status },
      afterState: { status: 'SUSPENDED' },
      metadata: reason ? { reason } : {},
    })

    res.json({
      success: true,
      data: { staff: shapeMembership({ ...updateResult.rows[0], email: membership.email }) },
    })
  } catch (error) {
    logger.error('Suspend staff membership error:', error)
    res.status(500).json({ success: false, error: 'Failed to suspend staff membership' })
  }
}

export const reactivateStaffMembership = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const actorUserId = req.user!.userId

    const membership = await loadMembership(id)
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Staff membership not found' })
    }
    if (membership.user_id === actorUserId) {
      return res.status(403).json({ success: false, error: 'You cannot reactivate your own staff access' })
    }
    if (membership.status !== 'SUSPENDED') {
      return res.status(409).json({
        success: false,
        error: `Only a suspended membership can be reactivated (current status: ${membership.status})`,
      })
    }

    const actorRank = actorMaxRank(req)
    if (
      req.user!.userType !== 'super_admin' &&
      ROLE_AUTHORITY_RANK[membership.role as StaffRole] > actorRank
    ) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify a role with more authority than your own',
      })
    }

    const updateResult = await query(
      `UPDATE staff_memberships
       SET status = 'ACTIVE', suspended_at = NULL, suspended_by = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id],
    )

    await recordStaffAuditEvent({
      action: 'STAFF_REACTIVATED',
      staffMembershipId: id,
      actorUserId,
      targetUserId: membership.user_id,
      beforeState: { status: membership.status },
      afterState: { status: 'ACTIVE' },
    })

    res.json({
      success: true,
      data: { staff: shapeMembership({ ...updateResult.rows[0], email: membership.email }) },
    })
  } catch (error) {
    logger.error('Reactivate staff membership error:', error)
    res.status(500).json({ success: false, error: 'Failed to reactivate staff membership' })
  }
}

export const revokeStaffMembership = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const actorUserId = req.user!.userId

    const membership = await loadMembership(id)
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Staff membership not found' })
    }
    if (membership.user_id === actorUserId) {
      return res.status(403).json({ success: false, error: 'You cannot revoke your own staff access' })
    }
    if (membership.status === 'REVOKED') {
      return res.status(409).json({ success: false, error: 'Membership is already revoked' })
    }

    const actorRank = actorMaxRank(req)
    if (
      req.user!.userType !== 'super_admin' &&
      ROLE_AUTHORITY_RANK[membership.role as StaffRole] > actorRank
    ) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify a role with more authority than your own',
      })
    }

    if (
      membership.status === 'ACTIVE' &&
      ['OWNER', 'SUPER_ADMIN'].includes(membership.role) &&
      (await wouldRemoveLastTopAuthority(id))
    ) {
      return res.status(409).json({
        success: false,
        error: 'Cannot revoke the last remaining OWNER/SUPER_ADMIN',
      })
    }

    const updateResult = await query(
      `UPDATE staff_memberships
       SET status = 'REVOKED', revoked_at = now(), revoked_by = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [actorUserId, id],
    )

    await recordStaffAuditEvent({
      action: 'STAFF_REVOKED',
      staffMembershipId: id,
      actorUserId,
      targetUserId: membership.user_id,
      beforeState: { status: membership.status },
      afterState: { status: 'REVOKED' },
      metadata: reason ? { reason } : {},
    })

    res.json({
      success: true,
      data: { staff: shapeMembership({ ...updateResult.rows[0], email: membership.email }) },
    })
  } catch (error) {
    logger.error('Revoke staff membership error:', error)
    res.status(500).json({ success: false, error: 'Failed to revoke staff membership' })
  }
}

export const getStaffAuditLog = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { limit = 50 } = req.query

    const result = await query(
      `SELECT id, action, actor_user_id, target_user_id, before_state, after_state, metadata, created_at
       FROM staff_audit_log
       WHERE staff_membership_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, Number(limit)],
    )

    res.json({
      success: true,
      data: {
        entries: result.rows.map((row: any) => ({
          id: row.id,
          action: row.action,
          actorUserId: row.actor_user_id,
          targetUserId: row.target_user_id,
          beforeState: row.before_state,
          afterState: row.after_state,
          metadata: row.metadata,
          createdAt: row.created_at,
        })),
      },
    })
  } catch (error) {
    logger.error('Get staff audit log error:', error)
    res.status(500).json({ success: false, error: 'Failed to get staff audit log' })
  }
}
