import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    const result = await query(
      `SELECT 
        id, email, first_name, last_name, phone, 
        user_type, company_name, tax_id, business_type,
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
       RETURNING id, email, first_name, last_name, phone, user_type, company_name`,
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
