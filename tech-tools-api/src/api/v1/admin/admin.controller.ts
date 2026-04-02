import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { sendAdminInvitationEmail } from '../../../utils/email'

// =====================================================
// Admin Invitation System
// =====================================================

/**
 * Invite a new admin user
 * 
 * Only super_admin can invite admins
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * 
 * @returns {Promise<Response>} - Express response object with JSON response
 * 
 * @throws {Error} - Any error encountered during the process
 */
export const inviteAdmin = async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body
    const invitedBy = (req as any).user.userId

    // Only super_admin can invite admins
    const inviterResult = await query(
      'SELECT user_type FROM users WHERE id = $1',
      [invitedBy],
    )

    if (
      inviterResult.rows.length === 0 ||
      inviterResult.rows[0].user_type !== 'super_admin'
    ) {
      return res.status(403).json({
        success: false,
        error: 'Only super administrators can invite admins',
      })
    }

    // Validate role
    if (!['admin', 'super_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be admin or super_admin',
      })
    }

    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [
      email,
    ])

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      })
    }

    // Check if invitation already exists
    const existingInvite = await query(
      'SELECT id, is_used FROM admin_invitations WHERE email = $1 AND is_used = FALSE',
      [email],
    )

    if (existingInvite.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invitation already sent to this email',
      })
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

    // Create invitation
    const result = await query(
      `INSERT INTO admin_invitations (email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, token, expires_at, created_at`,
      [email, role, token, invitedBy, expiresAt],
    )

    const invitation = result.rows[0]

    // Send invitation email
    await sendAdminInvitationEmail(email, token, role)

    // Log activity
    await query(
      `INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        invitedBy,
        'invite_admin',
        'admin_invitations',
        invitation.id,
        JSON.stringify({ email, role }),
      ],
    )

    logger.info('Admin invitation sent:', { email, role, invitedBy })

    res.status(201).json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at,
          createdAt: invitation.created_at,
        },
      },
      message: 'Admin invitation sent successfully',
    })
  } catch (error) {
    logger.error('Admin invitation error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send admin invitation',
    })
  }
}

export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const { token, password, firstName, lastName, phone } = req.body

    // Find invitation
    const inviteResult = await query(
      `SELECT id, email, role, expires_at, is_used, invited_by
       FROM admin_invitations 
       WHERE token = $1`,
      [token],
    )

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invalid invitation token',
      })
    }

    const invitation = inviteResult.rows[0]

    // Check if already used
    if (invitation.is_used) {
      return res.status(400).json({
        success: false,
        error: 'Invitation has already been used',
      })
    }

    // Check if expired
    if (new Date() > new Date(invitation.expires_at)) {
      return res.status(400).json({
        success: false,
        error: 'Invitation has expired',
      })
    }

    // Import bcrypt here to avoid circular dependencies
    const bcrypt = require('bcrypt')
    const passwordHash = await bcrypt.hash(password, 10)

    // Create admin user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type, email_verified, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
       RETURNING id, email, first_name, last_name, user_type, created_at`,
      [
        invitation.email,
        passwordHash,
        firstName,
        lastName,
        phone,
        invitation.role,
      ],
    )

    const user = userResult.rows[0]

    // Mark invitation as used
    await query(
      `UPDATE admin_invitations 
       SET is_used = TRUE, accepted_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [invitation.id],
    )

    // Log activity
    await query(
      `INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        invitation.invited_by,
        'admin_invitation_accepted',
        'users',
        user.id,
        JSON.stringify({ email: user.email, role: user.user_type }),
      ],
    )

    logger.info('Admin invitation accepted:', {
      userId: user.id,
      email: user.email,
      role: user.user_type,
    })

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.user_type,
          createdAt: user.created_at,
        },
      },
      message: 'Admin account created successfully. Please login.',
    })
  } catch (error) {
    logger.error('Accept invitation error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to accept invitation',
    })
  }
}

// =====================================================
// Admin Management
// =====================================================

export const getAdmins = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let queryText = `
      SELECT id, email, first_name, last_name, user_type, is_active, 
             email_verified, last_login_at, created_at, updated_at
      FROM users 
      WHERE user_type IN ('admin', 'super_admin')
    `
    const params: any[] = []
    let paramCount = 1

    if (role) {
      queryText += ` AND user_type = $${paramCount}`
      params.push(role)
      paramCount++
    }

    if (search) {
      queryText += ` AND (
        email ILIKE $${paramCount} OR 
        first_name ILIKE $${paramCount} OR 
        last_name ILIKE $${paramCount}
      )`
      params.push(`%${search}%`)
      paramCount++
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    params.push(Number(limit), offset)

    const result = await query(queryText, params)

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users WHERE user_type IN ('admin', 'super_admin')`,
    )
    const total = parseInt(countResult.rows[0].count)

    res.json({
      success: true,
      data: {
        admins: result.rows.map((row) => ({
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: row.user_type,
          isActive: row.is_active,
          emailVerified: row.email_verified,
          lastLoginAt: row.last_login_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get admins error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admins',
    })
  }
}

export const getAdminById = async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params

    const result = await query(
      `SELECT id, email, first_name, last_name, phone, user_type, is_active,
              email_verified, last_login_at, last_login_ip, failed_login_attempts,
              two_factor_enabled, created_at, updated_at
       FROM users 
       WHERE id = $1 AND user_type IN ('admin', 'super_admin')`,
      [adminId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found',
      })
    }

    const admin = result.rows[0]

    // Get admin permissions
    const permsResult = await query(
      `SELECT p.name, p.description, p.resource, p.actions
       FROM admin_permissions p
       JOIN admin_role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role = $1`,
      [admin.user_type],
    )

    res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.first_name,
          lastName: admin.last_name,
          phone: admin.phone,
          role: admin.user_type,
          isActive: admin.is_active,
          emailVerified: admin.email_verified,
          lastLoginAt: admin.last_login_at,
          lastLoginIp: admin.last_login_ip,
          failedLoginAttempts: admin.failed_login_attempts,
          twoFactorEnabled: admin.two_factor_enabled,
          createdAt: admin.created_at,
          updatedAt: admin.updated_at,
          permissions: permsResult.rows,
        },
      },
    })
  } catch (error) {
    logger.error('Get admin by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin',
    })
  }
}

export const updateAdmin = async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params
    const { isActive, role } = req.body
    const currentUserId = (req as any).user.userId

    // Check if current user is super_admin
    const currentUserResult = await query(
      'SELECT user_type FROM users WHERE id = $1',
      [currentUserId],
    )

    if (
      currentUserResult.rows.length === 0 ||
      currentUserResult.rows[0].user_type !== 'super_admin'
    ) {
      return res.status(403).json({
        success: false,
        error: 'Only super administrators can update admin users',
      })
    }

    // Prevent self-modification
    if (adminId === currentUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify your own admin account',
      })
    }

    const updates: string[] = []
    const params: any[] = []
    let paramCount = 1

    if (typeof isActive === 'boolean') {
      updates.push(`is_active = $${paramCount}`)
      params.push(isActive)
      paramCount++
    }

    if (role && ['admin', 'super_admin'].includes(role)) {
      updates.push(`user_type = $${paramCount}`)
      params.push(role)
      paramCount++
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided',
      })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    params.push(adminId)

    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND user_type IN ('admin', 'super_admin')
       RETURNING id, email, first_name, last_name, user_type, is_active`,
      params,
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found',
      })
    }

    // Log activity
    await query(
      `INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        currentUserId,
        'update_admin',
        'users',
        adminId,
        JSON.stringify({ isActive, role }),
      ],
    )

    logger.info('Admin updated:', { adminId, updatedBy: currentUserId })

    res.json({
      success: true,
      data: {
        admin: result.rows[0],
      },
      message: 'Admin updated successfully',
    })
  } catch (error) {
    logger.error('Update admin error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update admin',
    })
  }
}

export const deleteAdmin = async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params
    const currentUserId = (req as any).user.userId

    // Check if current user is super_admin
    const currentUserResult = await query(
      'SELECT user_type FROM users WHERE id = $1',
      [currentUserId],
    )

    if (
      currentUserResult.rows.length === 0 ||
      currentUserResult.rows[0].user_type !== 'super_admin'
    ) {
      return res.status(403).json({
        success: false,
        error: 'Only super administrators can delete admin users',
      })
    }

    // Prevent self-deletion
    if (adminId === currentUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own admin account',
      })
    }

    const result = await query(
      `DELETE FROM users 
       WHERE id = $1 AND user_type IN ('admin', 'super_admin')
       RETURNING id, email`,
      [adminId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found',
      })
    }

    // Log activity
    await query(
      `INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        currentUserId,
        'delete_admin',
        'users',
        adminId,
        JSON.stringify({ email: result.rows[0].email }),
      ],
    )

    logger.info('Admin deleted:', { adminId, deletedBy: currentUserId })

    res.json({
      success: true,
      message: 'Admin deleted successfully',
    })
  } catch (error) {
    logger.error('Delete admin error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete admin',
    })
  }
}

// =====================================================
// Admin Activity Logs
// =====================================================

export const getAdminActivityLogs = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, adminId, action, resourceType } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let queryText = `
      SELECT al.*, u.email, u.first_name, u.last_name
      FROM admin_activity_logs al
      JOIN users u ON al.admin_id = u.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramCount = 1

    if (adminId) {
      queryText += ` AND al.admin_id = $${paramCount}`
      params.push(adminId)
      paramCount++
    }

    if (action) {
      queryText += ` AND al.action = $${paramCount}`
      params.push(action)
      paramCount++
    }

    if (resourceType) {
      queryText += ` AND al.resource_type = $${paramCount}`
      params.push(resourceType)
      paramCount++
    }

    queryText += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    params.push(Number(limit), offset)

    const result = await query(queryText, params)

    res.json({
      success: true,
      data: {
        logs: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
        },
      },
    })
  } catch (error) {
    logger.error('Get admin activity logs error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity logs',
    })
  }
}

// =====================================================
// Admin Permissions
// =====================================================

export const getAdminPermissions = async (req: Request, res: Response) => {
  try {
    const { role } = req.params

    if (!['admin', 'super_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
      })
    }

    const result = await query(
      `SELECT p.name, p.description, p.resource, p.actions
       FROM admin_permissions p
       JOIN admin_role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role = $1
       ORDER BY p.resource, p.name`,
      [role],
    )

    res.json({
      success: true,
      data: {
        role,
        permissions: result.rows,
      },
    })
  } catch (error) {
    logger.error('Get admin permissions error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions',
    })
  }
}
