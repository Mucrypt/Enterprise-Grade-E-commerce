import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

// =====================================================
// User Management for Admin Dashboard
//
// Originally scoped to `user_type = 'customer'` only -- an admin had no way
// to see or moderate a misbehaving supplier or fellow admin account from
// this UI at all. userType is now an optional filter (defaults to
// 'customer' to preserve existing behavior for any caller that doesn't
// pass it) instead of a hardcoded restriction, so the same page/endpoints
// can reach every account type.
// =====================================================

// 'supplier' is deliberately excluded -- users.user_type has a second,
// stricter CHECK constraint added in 002_admin_management_schema.sql
// (check_user_type_valid) that only allows 'customer'/'admin'/
// 'super_admin'. Dropshipping suppliers are a wholly separate `suppliers`
// table (see suppliers admin page), not a `users` account type, confirmed
// against a real Postgres instance before shipping this.
const VALID_USER_TYPES = ['customer', 'admin', 'super_admin']

/**
 * Every admin activity log write for this module goes through here so
 * status changes/deletions always leave a trace of who did what, when, and
 * why -- reuses the existing admin_activity_logs table (002_admin_management
 * _schema.sql), already used by admin.controller.ts/books.controller.ts/
 * supplier.controller.ts for the same purpose.
 */
const logUserModerationAction = async (options: {
  adminId?: string
  action: string
  targetUserId: string
  details: Record<string, unknown>
}) => {
  try {
    await query(
      `INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'users', $3, $4)`,
      [
        options.adminId || null,
        options.action,
        options.targetUserId,
        JSON.stringify(options.details),
      ],
    )
  } catch (error) {
    logger.warn('Failed to write admin activity log', error)
  }
}

/**
 * Get all customers with pagination, filtering, and search
 */
export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '', // 'active', 'inactive', ''
      userType = 'customer', // 'customer' | 'supplier' | 'admin' | 'super_admin' | 'all'
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query

    const pageNum = Math.max(1, parseInt(page as string, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)))
    const offset = (pageNum - 1) * limitNum

    // Build the WHERE clause. Soft-deleted accounts never show up here.
    const conditions: string[] = ['deleted_at IS NULL']
    const params: any[] = []
    let paramIndex = 1

    if (
      userType !== 'all' &&
      VALID_USER_TYPES.includes(userType as string)
    ) {
      conditions.push(`user_type = $${paramIndex}`)
      params.push(userType)
      paramIndex++
    }

    // Search filter
    if (search) {
      conditions.push(`(
        first_name ILIKE $${paramIndex} OR 
        last_name ILIKE $${paramIndex} OR 
        email ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex}
      )`)
      params.push(`%${search}%`)
      paramIndex++
    }

    // Status filter
    if (status === 'active') {
      conditions.push(`is_active = TRUE`)
    } else if (status === 'inactive') {
      conditions.push(`is_active = FALSE`)
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Validate sort options
    const validSortColumns = [
      'created_at',
      'email',
      'first_name',
      'last_name',
      'last_login',
    ]
    const validSortOrders = ['ASC', 'DESC']
    const sortColumn = validSortColumns.includes(sortBy as string)
      ? sortBy
      : 'created_at'
    const order = validSortOrders.includes((sortOrder as string).toUpperCase())
      ? (sortOrder as string).toUpperCase()
      : 'DESC'

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params,
    )
    const total = parseInt(countResult.rows[0].total, 10)

    // Get customers
    const customersResult = await query(
      `SELECT 
        id, email, first_name, last_name, phone,
        user_type, company_name, business_type,
        email_verified, phone_verified, is_active,
        last_login, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset],
    )

    // Get order counts for each customer
    const customerIds = customersResult.rows.map((c) => c.id)
    const orderCounts: Record<
      string,
      { orderCount: number; totalSpent: number }
    > = {}

    if (customerIds.length > 0) {
      const orderCountsResult = await query(
        `SELECT user_id, COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_spent
         FROM orders
         WHERE user_id = ANY($1)
         GROUP BY user_id`,
        [customerIds],
      )

      orderCountsResult.rows.forEach((row) => {
        orderCounts[row.user_id] = {
          orderCount: parseInt(row.order_count, 10),
          totalSpent: parseFloat(row.total_spent),
        }
      })
    }

    // Format customers with order info
    const customers = customersResult.rows.map((customer) => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      fullName:
        `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
        'N/A',
      phone: customer.phone,
      userType: customer.user_type,
      companyName: customer.company_name,
      businessType: customer.business_type,
      emailVerified: customer.email_verified,
      phoneVerified: customer.phone_verified,
      isActive: customer.is_active,
      lastLogin: customer.last_login,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      orderCount: orderCounts[customer.id]?.orderCount || 0,
      totalSpent: orderCounts[customer.id]?.totalSpent || 0,
    }))

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    })
  } catch (error) {
    logger.error('Get customers error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get customers',
    })
  }
}

/**
 * Get customer statistics for dashboard
 */
export const getCustomerStats = async (req: AuthRequest, res: Response) => {
  try {
    const { userType = 'customer' } = req.query
    const typeFilter =
      userType !== 'all' && VALID_USER_TYPES.includes(userType as string)
        ? `user_type = '${userType}' AND`
        : ''
    // (typeFilter is built from a value checked against VALID_USER_TYPES
    // above, never interpolated from unchecked input.)

    // Total
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM users WHERE ${typeFilter} deleted_at IS NULL`,
    )
    const total = parseInt(totalResult.rows[0].total, 10)

    // Active
    const activeResult = await query(
      `SELECT COUNT(*) as active FROM users WHERE ${typeFilter} deleted_at IS NULL AND is_active = TRUE`,
    )
    const active = parseInt(activeResult.rows[0].active, 10)

    // Inactive
    const inactive = total - active

    // New today
    const newTodayResult = await query(
      `SELECT COUNT(*) as new_today FROM users
       WHERE ${typeFilter} deleted_at IS NULL
       AND created_at >= CURRENT_DATE`,
    )
    const newToday = parseInt(newTodayResult.rows[0].new_today, 10)

    // New this week
    const newThisWeekResult = await query(
      `SELECT COUNT(*) as new_week FROM users
       WHERE ${typeFilter} deleted_at IS NULL
       AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
    )
    const newThisWeek = parseInt(newThisWeekResult.rows[0].new_week, 10)

    // New this month
    const newThisMonthResult = await query(
      `SELECT COUNT(*) as new_month FROM users
       WHERE ${typeFilter} deleted_at IS NULL
       AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
    )
    const newThisMonth = parseInt(newThisMonthResult.rows[0].new_month, 10)

    // Verified email
    const verifiedResult = await query(
      `SELECT COUNT(*) as verified FROM users
       WHERE ${typeFilter} deleted_at IS NULL AND email_verified = TRUE`,
    )
    const emailVerified = parseInt(verifiedResult.rows[0].verified, 10)

    // Customers with orders
    const withOrdersResult = await query(
      `SELECT COUNT(DISTINCT user_id) as with_orders FROM orders`,
    )
    const withOrders = parseInt(withOrdersResult.rows[0].with_orders, 10)

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive,
        newToday,
        newThisWeek,
        newThisMonth,
        emailVerified,
        withOrders,
      },
    })
  } catch (error) {
    logger.error('Get customer stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get customer statistics',
    })
  }
}

/**
 * Get single customer details
 */
export const getCustomerById = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params

    // Get customer info (any account type, not just 'customer')
    const customerResult = await query(
      `SELECT
        id, email, first_name, last_name, phone,
        user_type, company_name, tax_id, business_type,
        email_verified, phone_verified, is_active,
        last_login, created_at, updated_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [customerId],
    )

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      })
    }

    const customer = customerResult.rows[0]

    // Get addresses
    const addressesResult = await query(
      `SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC`,
      [customerId],
    )

    // Get orders
    const ordersResult = await query(
      `SELECT id, order_number, status, total_amount, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [customerId],
    )

    // Get order summary
    const orderSummaryResult = await query(
      `SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_spent,
        COALESCE(AVG(total_amount), 0) as average_order
       FROM orders
       WHERE user_id = $1`,
      [customerId],
    )

    const orderSummary = orderSummaryResult.rows[0]

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          fullName:
            `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
            'N/A',
          phone: customer.phone,
          userType: customer.user_type,
          companyName: customer.company_name,
          taxId: customer.tax_id,
          businessType: customer.business_type,
          emailVerified: customer.email_verified,
          phoneVerified: customer.phone_verified,
          isActive: customer.is_active,
          lastLogin: customer.last_login,
          createdAt: customer.created_at,
          updatedAt: customer.updated_at,
        },
        addresses: addressesResult.rows,
        recentOrders: ordersResult.rows,
        orderSummary: {
          totalOrders: parseInt(orderSummary.total_orders, 10),
          totalSpent: parseFloat(orderSummary.total_spent),
          averageOrder: parseFloat(orderSummary.average_order),
        },
      },
    })
  } catch (error) {
    logger.error('Get customer by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get customer details',
    })
  }
}

/**
 * Update customer status (activate/deactivate)
 */
export const updateCustomerStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params
    const { isActive, reason } = req.body

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
      })
    }

    const beforeResult = await query(
      `SELECT is_active, user_type, email FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [customerId],
    )
    if (beforeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      })
    }
    const before = beforeResult.rows[0]

    const result = await query(
      `UPDATE users
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email, first_name, last_name, is_active`,
      [isActive, customerId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      })
    }

    const customer = result.rows[0]

    logger.info('Customer status updated:', {
      customerId,
      isActive,
      adminId: req.user?.userId,
    })
    await logUserModerationAction({
      adminId: req.user?.userId,
      action: isActive ? 'activate_user' : 'deactivate_user',
      targetUserId: customerId,
      details: {
        targetEmail: before.email,
        targetUserType: before.user_type,
        previousState: { isActive: before.is_active },
        newState: { isActive },
        reason: reason || null,
      },
    })

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          isActive: customer.is_active,
        },
      },
      message: `Customer ${
        isActive ? 'activated' : 'deactivated'
      } successfully`,
    })
  } catch (error) {
    logger.error('Update customer status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update customer status',
    })
  }
}

/**
 * Delete customer (soft delete by deactivating)
 */
/**
 * Delete an account. Always soft-deletes (deleted_at + is_active=false) --
 * this used to hard `DELETE FROM users` whenever the account had no order
 * history, with no reason recorded anywhere beyond a log line. A real "this
 * account did something bad" moderation action should never be
 * unrecoverable/untraceable by accident, so this now behaves the same way
 * regardless of order history: deactivate (blocks login, already a proven
 * gate -- see auth.controller.ts) and mark deleted_at, with the reason and
 * acting admin recorded in admin_activity_logs.
 */
export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params
    const { reason } = req.body

    const beforeResult = await query(
      `SELECT email, user_type FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [customerId],
    )
    if (beforeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      })
    }
    const before = beforeResult.rows[0]

    await query(
      `UPDATE users
       SET is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [customerId],
    )

    logger.info('User soft-deleted:', {
      customerId,
      adminId: req.user?.userId,
    })
    await logUserModerationAction({
      adminId: req.user?.userId,
      action: 'delete_user',
      targetUserId: customerId,
      details: {
        targetEmail: before.email,
        targetUserType: before.user_type,
        reason: reason || null,
      },
    })

    res.json({
      success: true,
      message: 'Account deactivated and marked deleted',
    })
  } catch (error) {
    logger.error('Delete customer error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete customer',
    })
  }
}
