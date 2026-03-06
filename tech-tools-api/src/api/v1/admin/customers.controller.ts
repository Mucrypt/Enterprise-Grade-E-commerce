import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

// =====================================================
// Customer Management for Admin Dashboard
// =====================================================

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
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query

    const pageNum = Math.max(1, parseInt(page as string, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)))
    const offset = (pageNum - 1) * limitNum

    // Build the WHERE clause
    const conditions: string[] = ["user_type = 'customer'"]
    const params: any[] = []
    let paramIndex = 1

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
    // Total customers
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM users WHERE user_type = 'customer'`,
    )
    const total = parseInt(totalResult.rows[0].total, 10)

    // Active customers
    const activeResult = await query(
      `SELECT COUNT(*) as active FROM users WHERE user_type = 'customer' AND is_active = TRUE`,
    )
    const active = parseInt(activeResult.rows[0].active, 10)

    // Inactive customers
    const inactive = total - active

    // New customers today
    const newTodayResult = await query(
      `SELECT COUNT(*) as new_today FROM users 
       WHERE user_type = 'customer' 
       AND created_at >= CURRENT_DATE`,
    )
    const newToday = parseInt(newTodayResult.rows[0].new_today, 10)

    // New customers this week
    const newThisWeekResult = await query(
      `SELECT COUNT(*) as new_week FROM users 
       WHERE user_type = 'customer' 
       AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
    )
    const newThisWeek = parseInt(newThisWeekResult.rows[0].new_week, 10)

    // New customers this month
    const newThisMonthResult = await query(
      `SELECT COUNT(*) as new_month FROM users 
       WHERE user_type = 'customer' 
       AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
    )
    const newThisMonth = parseInt(newThisMonthResult.rows[0].new_month, 10)

    // Verified email customers
    const verifiedResult = await query(
      `SELECT COUNT(*) as verified FROM users 
       WHERE user_type = 'customer' AND email_verified = TRUE`,
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

    // Get customer info
    const customerResult = await query(
      `SELECT 
        id, email, first_name, last_name, phone,
        user_type, company_name, tax_id, business_type,
        email_verified, phone_verified, is_active,
        last_login, created_at, updated_at
       FROM users
       WHERE id = $1 AND user_type = 'customer'`,
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
    const { isActive } = req.body

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
      })
    }

    const result = await query(
      `UPDATE users 
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND user_type = 'customer'
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
export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params

    // Check if customer has orders - if so, just deactivate
    const ordersResult = await query(
      `SELECT COUNT(*) as order_count FROM orders WHERE user_id = $1`,
      [customerId],
    )

    const hasOrders = parseInt(ordersResult.rows[0].order_count, 10) > 0

    if (hasOrders) {
      // Soft delete - just deactivate
      await query(
        `UPDATE users 
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1 AND user_type = 'customer'`,
        [customerId],
      )

      logger.info('Customer deactivated (has orders):', {
        customerId,
        adminId: req.user?.userId,
      })

      return res.json({
        success: true,
        message: 'Customer deactivated (has order history)',
      })
    }

    // Hard delete if no orders
    const result = await query(
      `DELETE FROM users WHERE id = $1 AND user_type = 'customer' RETURNING id`,
      [customerId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      })
    }

    logger.info('Customer deleted:', {
      customerId,
      adminId: req.user?.userId,
    })

    res.json({
      success: true,
      message: 'Customer deleted successfully',
    })
  } catch (error) {
    logger.error('Delete customer error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete customer',
    })
  }
}
