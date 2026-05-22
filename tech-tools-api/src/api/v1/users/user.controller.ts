import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

const isBusinessModeSwitchEnabled = () =>
  String(process.env.ENABLE_BUSINESS_MODE_SWITCH || 'false').toLowerCase() ===
  'true'

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const tableExists = async (tableName: string) => {
  const result = await query(`SELECT to_regclass($1) AS regclass`, [
    `public.${tableName}`,
  ])

  return Boolean(result.rows[0]?.regclass)
}

const createUniqueHandle = async (preferred: string) => {
  const base = toSlug(preferred).slice(0, 60) || 'creator'

  for (let index = 0; index < 20; index++) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`
    const exists = await query(
      'SELECT id FROM creator_profiles WHERE handle = $1 LIMIT 1',
      [candidate],
    )

    if (exists.rows.length === 0) {
      return candidate
    }
  }

  return `${base}-${Date.now()}`
}

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    const result = await query(
      `SELECT 
        id, email, first_name, last_name, phone, 
        user_type, company_name, tax_id, business_type,
        is_business_account, business_mode_activated_at,
        email_verified, phone_verified, is_active,
        last_login, created_at, updated_at
       FROM users 
       WHERE id = $1`,
      [userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = result.rows[0]

    // Get user addresses
    const addressesResult = await query(
      'SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [userId],
    )

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          userType: user.user_type,
          companyName: user.company_name,
          taxId: user.tax_id,
          businessType: user.business_type,
          isBusinessAccount: Boolean(user.is_business_account),
          businessModeActivatedAt: user.business_mode_activated_at,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified,
          isActive: user.is_active,
          lastLogin: user.last_login,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        addresses: addressesResult.rows,
      },
    })
  } catch (error) {
    logger.error('Get profile error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get profile',
    })
  }
}

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { firstName, lastName, phone, companyName } = req.body

    const result = await query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           company_name = COALESCE($4, company_name),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, email, first_name, last_name, phone, user_type, company_name, is_business_account, business_mode_activated_at`,
      [firstName, lastName, phone, companyName, userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = result.rows[0]

    logger.info('Profile updated:', { userId })

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          userType: user.user_type,
          companyName: user.company_name,
          isBusinessAccount: Boolean(user.is_business_account),
          businessModeActivatedAt: user.business_mode_activated_at,
        },
      },
    })
  } catch (error) {
    logger.error('Update profile error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    })
  }
}

export const activateBusinessMode = async (req: AuthRequest, res: Response) => {
  try {
    if (!isBusinessModeSwitchEnabled()) {
      return res.status(404).json({
        success: false,
        error: 'Business mode switching is not enabled',
      })
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { displayName, handle, companyName, businessType, source } = req.body

    const userResult = await query(
      `SELECT id, email, first_name, last_name, user_type, is_business_account,
              company_name, business_type
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = userResult.rows[0]

    await query(
      `UPDATE users
       SET is_business_account = true,
           business_mode_activated_at = COALESCE(business_mode_activated_at, CURRENT_TIMESTAMP),
           business_mode_source = COALESCE($1, business_mode_source),
           company_name = COALESCE($2, company_name),
           business_type = COALESCE($3, business_type),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [source || 'self_service', companyName || null, businessType || null, userId],
    )

    let profile: any = null
    const creatorTableReady = await tableExists('creator_profiles')

    if (creatorTableReady) {
      const existingProfile = await query(
        `SELECT id, user_id, handle, display_name, verification_status, is_public, created_at
         FROM creator_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [userId],
      )

      if (existingProfile.rows.length > 0) {
        profile = existingProfile.rows[0]
      } else {
        const preferredHandle =
          String(handle || '').trim() ||
          String(user.email || '').split('@')[0] ||
          `${user.first_name || ''}-${user.last_name || ''}`

        const normalizedHandle = await createUniqueHandle(preferredHandle)
        const resolvedDisplayName =
          String(displayName || '').trim() ||
          [user.first_name, user.last_name].filter(Boolean).join(' ') ||
          normalizedHandle

        const created = await query(
          `INSERT INTO creator_profiles (
             user_id, handle, display_name, verification_status, is_public, updated_at
           )
           VALUES ($1, $2, $3, 'pending', true, CURRENT_TIMESTAMP)
           RETURNING id, user_id, handle, display_name, verification_status, is_public, created_at`,
          [userId, normalizedHandle, resolvedDisplayName],
        )

        profile = created.rows[0]
      }
    }

    const auditReady = await tableExists('user_business_mode_audit')
    if (auditReady) {
      await query(
        `INSERT INTO user_business_mode_audit
          (user_id, action, metadata, ip_address, user_agent)
         VALUES ($1, 'activate_business_mode', $2::jsonb, $3, $4)`,
        [
          userId,
          JSON.stringify({
            source: source || 'self_service',
            hasCreatorProfile: Boolean(profile),
          }),
          req.ip || null,
          req.headers['user-agent'] || null,
        ],
      )
    }

    logger.info('Business mode activated', {
      userId,
      source: source || 'self_service',
      hasCreatorProfile: Boolean(profile),
    })

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          userType: user.user_type,
          companyName: companyName || user.company_name,
          businessType: businessType || user.business_type,
          isBusinessAccount: true,
        },
        creatorProfile: profile,
      },
    })
  } catch (error) {
    logger.error('Activate business mode error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to activate business mode',
    })
  }
}

export const getUserAddresses = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    const result = await query(
      `SELECT * FROM user_addresses 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [userId],
    )

    res.json({
      success: true,
      data: {
        addresses: result.rows,
      },
    })
  } catch (error) {
    logger.error('Get addresses error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get addresses',
    })
  }
}

export const addUserAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const {
      addressType,
      fullName,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      postalCode,
      phone,
      isDefault,
    } = req.body

    // If setting as default, unset other defaults
    if (isDefault) {
      await query(
        'UPDATE user_addresses SET is_default = false WHERE user_id = $1 AND address_type = $2',
        [userId, addressType],
      )
    }

    const result = await query(
      `INSERT INTO user_addresses (
        user_id, address_type, full_name, address_line1, address_line2,
        city, state, country, postal_code, phone, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        userId,
        addressType,
        fullName,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        postalCode,
        phone,
        isDefault || false,
      ],
    )

    logger.info('Address added:', { userId, addressId: result.rows[0].id })

    res.status(201).json({
      success: true,
      data: {
        address: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Add address error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to add address',
    })
  }
}

export const updateUserAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const addressId = req.params.addressId
    const updates = req.body

    // Check if address belongs to user
    const checkResult = await query(
      'SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2',
      [addressId, userId],
    )

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Address not found',
      })
    }

    // If setting as default, unset other defaults of same type
    if (updates.isDefault) {
      const addressResult = await query(
        'SELECT address_type FROM user_addresses WHERE id = $1',
        [addressId],
      )

      if (addressResult.rows.length > 0) {
        await query(
          'UPDATE user_addresses SET is_default = false WHERE user_id = $1 AND address_type = $2 AND id != $3',
          [userId, addressResult.rows[0].address_type, addressId],
        )
      }
    }

    // Build update query dynamically
    const updateFields: string[] = []
    const updateValues: any[] = []
    let paramCount = 1

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`)
        updateValues.push(value)
        paramCount++
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      })
    }

    updateFields.push('updated_at = NOW()')
    updateValues.push(addressId, userId)

    const queryStr = `
      UPDATE user_addresses 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `

    const result = await query(queryStr, updateValues)

    logger.info('Address updated:', { userId, addressId })

    res.json({
      success: true,
      data: {
        address: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Update address error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update address',
    })
  }
}

export const deleteUserAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const addressId = req.params.addressId

    // Check if address belongs to user
    const checkResult = await query(
      'SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2',
      [addressId, userId],
    )

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Address not found',
      })
    }

    // Check if this is the last address
    const countResult = await query(
      'SELECT COUNT(*) FROM user_addresses WHERE user_id = $1',
      [userId],
    )

    if (parseInt(countResult.rows[0].count) === 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the last address',
      })
    }

    await query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [
      addressId,
      userId,
    ])

    logger.info('Address deleted:', { userId, addressId })

    res.json({
      success: true,
      message: 'Address deleted successfully',
    })
  } catch (error) {
    logger.error('Delete address error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete address',
    })
  }
}
