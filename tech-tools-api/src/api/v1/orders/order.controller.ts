import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

// =====================================================
// Admin Order Management
// =====================================================

export const getAdminOrders = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      orderStatus,
      paymentStatus,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    const params: any[] = []
    const conditions: string[] = []
    let paramIndex = 1

    // Search by order number or customer email
    if (search) {
      conditions.push(
        `(o.order_number ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.first_name || ' ' || u.last_name ILIKE $${paramIndex})`,
      )
      params.push(`%${search}%`)
      paramIndex++
    }

    // Order status filter
    if (orderStatus && orderStatus !== 'all') {
      conditions.push(`o.order_status = $${paramIndex}`)
      params.push(orderStatus)
      paramIndex++
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      conditions.push(`o.payment_status = $${paramIndex}`)
      params.push(paymentStatus)
      paramIndex++
    }

    // Date range filter
    if (startDate) {
      conditions.push(`o.created_at >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      conditions.push(`o.created_at <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    // Amount range filter
    if (minAmount) {
      conditions.push(`o.grand_total >= $${paramIndex}`)
      params.push(minAmount)
      paramIndex++
    }

    if (maxAmount) {
      conditions.push(`o.grand_total <= $${paramIndex}`)
      params.push(maxAmount)
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Validate sort column
    const validSortColumns = [
      'created_at',
      'order_number',
      'grand_total',
      'order_status',
      'payment_status',
    ]
    const sortColumn = validSortColumns.includes(sortBy as string)
      ? sortBy
      : 'created_at'
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Get orders with customer info
    const ordersQuery = `
      SELECT 
        o.*,
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    params.push(limit, offset)

    const result = await query(ordersQuery, params)

    // Get total count
    const countParams = params.slice(0, -2) // Remove limit and offset
    const countQuery = `
      SELECT COUNT(*) 
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
    `
    const countResult = await query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].count)

    res.json({
      success: true,
      data: {
        orders: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get admin orders error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get orders',
    })
  }
}

export const getAdminOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Get order with customer info
    const orderResult = await query(
      `SELECT 
        o.*,
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = $1`,
      [id],
    )

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      })
    }

    // Get order items with product info
    const itemsResult = await query(
      `SELECT 
        oi.*,
        p.main_image_url as product_image
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at`,
      [id],
    )

    // Get payments for this order
    const paymentsResult = await query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at`,
      [id],
    )

    res.json({
      success: true,
      data: {
        order: {
          ...orderResult.rows[0],
          items: itemsResult.rows,
          payments: paymentsResult.rows,
        },
      },
    })
  } catch (error) {
    logger.error('Get admin order error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get order',
    })
  }
}

export const getOrderStats = async (req: AuthRequest, res: Response) => {
  try {
    // Get order counts by status
    const statusCountsResult = await query(`
      SELECT order_status, COUNT(*) as count 
      FROM orders 
      GROUP BY order_status
    `)

    // Get total revenue
    const revenueResult = await query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(grand_total), 0) as total_revenue,
        COALESCE(AVG(grand_total), 0) as average_order_value
      FROM orders 
      WHERE order_status NOT IN ('cancelled', 'refunded')
    `)

    // Get today's orders
    const todayResult = await query(`
      SELECT COUNT(*) as today_orders, COALESCE(SUM(grand_total), 0) as today_revenue
      FROM orders 
      WHERE created_at >= CURRENT_DATE
    `)

    // Get orders by payment status
    const paymentStatusResult = await query(`
      SELECT payment_status, COUNT(*) as count 
      FROM orders 
      GROUP BY payment_status
    `)

    // Build status counts object
    const statusCounts: Record<string, number> = {}
    statusCountsResult.rows.forEach((row: any) => {
      statusCounts[row.order_status] = parseInt(row.count)
    })

    const paymentCounts: Record<string, number> = {}
    paymentStatusResult.rows.forEach((row: any) => {
      paymentCounts[row.payment_status] = parseInt(row.count)
    })

    res.json({
      success: true,
      data: {
        stats: {
          totalOrders: parseInt(revenueResult.rows[0].total_orders),
          totalRevenue: parseFloat(revenueResult.rows[0].total_revenue),
          averageOrderValue: parseFloat(
            revenueResult.rows[0].average_order_value,
          ),
          todayOrders: parseInt(todayResult.rows[0].today_orders),
          todayRevenue: parseFloat(todayResult.rows[0].today_revenue),
          statusCounts,
          paymentCounts,
        },
      },
    })
  } catch (error) {
    logger.error('Get order stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get order statistics',
    })
  }
}

export const adminUpdateOrderStatus = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params
    const { status, internalNotes } = req.body

    const validStatuses = [
      'pending',
      'confirmed',
      'processing',
      'ready_to_ship',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
    ]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      })
    }

    // Build update query
    let updateQuery = 'UPDATE orders SET order_status = $1, updated_at = NOW()'
    const params: any[] = [status]
    let paramIndex = 2

    if (internalNotes) {
      updateQuery += `, internal_notes = COALESCE(internal_notes, '') || E'\\n' || $${paramIndex}`
      params.push(`[${new Date().toISOString()}] ${internalNotes}`)
      paramIndex++
    }

    // Set cancelled_at timestamp if cancelling
    if (status === 'cancelled') {
      updateQuery += `, cancelled_at = NOW()`
    }

    // Set delivered timestamp
    if (status === 'delivered') {
      updateQuery += `, actual_delivery_date = CURRENT_DATE`
    }

    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`
    params.push(id)

    const result = await query(updateQuery, params)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      })
    }

    res.json({
      success: true,
      data: {
        order: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Update order status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
    })
  }
}

export const bulkUpdateOrderStatus = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { orderIds, status, internalNotes } = req.body

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'orderIds must be a non-empty array',
      })
    }

    const validStatuses = [
      'pending',
      'confirmed',
      'processing',
      'ready_to_ship',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
    ]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      })
    }

    // Build update query
    let updateQuery = 'UPDATE orders SET order_status = $1, updated_at = NOW()'
    const params: any[] = [status]
    let paramIndex = 2

    if (internalNotes) {
      updateQuery += `, internal_notes = COALESCE(internal_notes, '') || E'\\n' || $${paramIndex}`
      params.push(`[${new Date().toISOString()}] Bulk update: ${internalNotes}`)
      paramIndex++
    }

    if (status === 'cancelled') {
      updateQuery += `, cancelled_at = NOW()`
    }

    if (status === 'delivered') {
      updateQuery += `, actual_delivery_date = CURRENT_DATE`
    }

    // Create placeholders for orderIds
    const placeholders = orderIds.map((_, i) => `$${paramIndex + i}`).join(', ')
    params.push(...orderIds)

    updateQuery += ` WHERE id IN (${placeholders}) RETURNING id`

    const result = await query(updateQuery, params)

    res.json({
      success: true,
      data: {
        updatedCount: result.rows.length,
        updatedIds: result.rows.map((r: any) => r.id),
      },
    })
  } catch (error) {
    logger.error('Bulk update order status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update orders',
    })
  }
}

export const updateOrderShipping = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { trackingNumber, carrier, estimatedDeliveryDate } = req.body

    const updates: string[] = ['updated_at = NOW()']
    const params: any[] = []
    let paramIndex = 1

    if (trackingNumber) {
      updates.push(
        `shipping_address = shipping_address || jsonb_build_object('tracking_number', $${paramIndex})`,
      )
      params.push(trackingNumber)
      paramIndex++
    }

    if (carrier) {
      updates.push(
        `shipping_address = shipping_address || jsonb_build_object('carrier', $${paramIndex})`,
      )
      params.push(carrier)
      paramIndex++
    }

    if (estimatedDeliveryDate) {
      updates.push(`estimated_delivery_date = $${paramIndex}`)
      params.push(estimatedDeliveryDate)
      paramIndex++
    }

    params.push(id)

    const result = await query(
      `UPDATE orders SET ${updates.join(
        ', ',
      )} WHERE id = $${paramIndex} RETURNING *`,
      params,
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      })
    }

    res.json({
      success: true,
      data: {
        order: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Update order shipping error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update order shipping',
    })
  }
}

export const exportOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, orderStatus, format = 'json' } = req.query

    const params: any[] = []
    const conditions: string[] = []
    let paramIndex = 1

    if (startDate) {
      conditions.push(`o.created_at >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      conditions.push(`o.created_at <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    if (orderStatus && orderStatus !== 'all') {
      conditions.push(`o.order_status = $${paramIndex}`)
      params.push(orderStatus)
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await query(
      `
      SELECT 
        o.order_number,
        o.order_status,
        o.payment_status,
        o.grand_total,
        o.total_amount,
        o.tax_amount,
        o.shipping_amount,
        o.discount_amount,
        o.currency,
        o.payment_method,
        o.created_at,
        u.email as customer_email,
        u.first_name || ' ' || u.last_name as customer_name,
        o.shipping_address->>'city' as shipping_city,
        o.shipping_address->>'country' as shipping_country
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `,
      params,
    )

    if (format === 'csv') {
      // Simple CSV export
      const headers = [
        'Order Number',
        'Status',
        'Payment Status',
        'Total',
        'Customer Email',
        'Customer Name',
        'Created At',
      ]
      const csvRows = [headers.join(',')]

      result.rows.forEach((row: any) => {
        csvRows.push(
          [
            row.order_number,
            row.order_status,
            row.payment_status,
            row.grand_total,
            row.customer_email || '',
            row.customer_name || '',
            row.created_at,
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        )
      })

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=orders-export-${
          new Date().toISOString().split('T')[0]
        }.csv`,
      )
      return res.send(csvRows.join('\n'))
    }

    res.json({
      success: true,
      data: {
        orders: result.rows,
        exportedAt: new Date().toISOString(),
        count: result.rows.length,
      },
    })
  } catch (error) {
    logger.error('Export orders error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to export orders',
    })
  }
}

// =====================================================
// Customer Order Management
// =====================================================

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { page = 1, limit = 20 } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    const result = await query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset],
    )

    const countResult = await query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [userId],
    )

    const total = parseInt(countResult.rows[0].count)

    res.json({
      success: true,
      data: {
        orders: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get orders error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get orders',
    })
  }
}

export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { id } = req.params

    const result = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      })
    }

    res.json({
      success: true,
      data: {
        order: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Get order error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get order',
    })
  }
}

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const {
      items,
      shippingAddress,
      billingAddress,
      customerNotes,
      paymentIntentId,
      paymentMethod = 'card',
    } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order items are required',
      })
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        error: 'Shipping address is required',
      })
    }

    // Calculate totals
    let totalAmount = 0
    const orderItems = []

    for (const item of items) {
      // Verify product exists and get current price + stock from inventory
      const productResult = await query(
        `SELECT p.id, p.name, p.sku, p.base_price, p.sale_price, 
                COALESCE((SELECT SUM(i.available_stock) FROM inventory i WHERE i.product_id = p.id), 0) as total_stock
         FROM products p 
         WHERE p.id = $1 AND p.is_active = true`,
        [item.productId],
      )

      if (!productResult.rows[0]) {
        return res.status(400).json({
          success: false,
          error: `Product not found: ${item.productId}`,
        })
      }

      const product = productResult.rows[0]

      // Check stock from inventory table
      const availableStock = parseInt(product.total_stock, 10)
      if (availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${product.name}. Available: ${availableStock}`,
        })
      }

      // Use sale_price if available, otherwise base_price
      const effectivePrice = parseFloat(
        product.sale_price || product.base_price,
      )
      const itemTotal = effectivePrice * item.quantity
      totalAmount += itemTotal

      orderItems.push({
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: effectivePrice,
        totalPrice: itemTotal,
      })
    }

    // Calculate tax and shipping
    const taxRate = 0.08 // 8% tax - can be configurable
    const taxAmount = totalAmount * taxRate
    const shippingAmount = totalAmount >= 50 ? 0 : 5.99
    const grandTotal = totalAmount + taxAmount + shippingAmount

    // Generate order number
    const orderNumber = `TT-${Date.now().toString().slice(-8)}-${Math.random()
      .toString(36)
      .substr(2, 4)
      .toUpperCase()}`

    // Create order
    const orderResult = await query(
      `INSERT INTO orders (
        order_number, user_id, order_status, payment_status,
        total_amount, tax_amount, shipping_amount, grand_total,
        shipping_address, billing_address, customer_notes,
        payment_method, payment_gateway, transaction_id,
        estimated_delivery_date
      ) VALUES (
        $1, $2, 'pending', 'pending',
        $3, $4, $5, $6,
        $7, $8, $9,
        $10, 'stripe', $11,
        CURRENT_DATE + INTERVAL '5 days'
      ) RETURNING *`,
      [
        orderNumber,
        userId || null,
        totalAmount,
        taxAmount,
        shippingAmount,
        grandTotal,
        JSON.stringify(shippingAddress),
        billingAddress
          ? JSON.stringify(billingAddress)
          : JSON.stringify(shippingAddress),
        customerNotes || null,
        paymentMethod,
        paymentIntentId || null,
      ],
    )

    const order = orderResult.rows[0]

    // Create order items
    for (const item of orderItems) {
      await query(
        `INSERT INTO order_items (
          order_id, product_id, sku, product_name,
          quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.productId,
          item.sku,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.totalPrice,
        ],
      )

      // Reduce stock from inventory table
      await query(
        `UPDATE inventory SET 
          available_stock = available_stock - $1,
          reserved_stock = reserved_stock + $1,
          updated_at = NOW()
         WHERE product_id = $2`,
        [item.quantity, item.productId],
      )
    }

    // If payment intent ID provided, update it with order ID
    if (paymentIntentId) {
      try {
        const stripeService = (await import('../../../services/stripe.service'))
          .default
        await stripeService.updatePaymentIntent(paymentIntentId, {
          metadata: {
            orderId: order.id,
            orderNumber: order.order_number,
          },
        })
      } catch (error) {
        logger.warn('Failed to update payment intent with order ID:', error)
      }
    }

    // Get created order items
    const itemsResult = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id],
    )

    res.status(201).json({
      success: true,
      data: {
        order: {
          ...order,
          items: itemsResult.rows,
        },
      },
    })
  } catch (error) {
    logger.error('Create order error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
    })
  }
}

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body

    res.json({
      success: true,
      message: 'Update order status - Not yet fully implemented',
      data: {
        orderId: id,
        status,
      },
    })
  } catch (error) {
    logger.error('Update order status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
    })
  }
}

export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { id } = req.params
    const { reason } = req.body

    // Verify order belongs to user
    const orderResult = await query(
      `SELECT o.*, p.transaction_id, p.amount as payment_amount, p.status as payment_status
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id AND p.status = 'completed'
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, userId],
    )

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      })
    }

    const order = orderResult.rows[0]

    // Check if order can be cancelled
    const nonCancellableStatuses = [
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
    ]
    if (nonCancellableStatuses.includes(order.order_status)) {
      return res.status(400).json({
        success: false,
        error: `Order cannot be cancelled. Current status: ${order.order_status}`,
      })
    }

    // If payment was made, initiate refund
    if (order.transaction_id && order.payment_status === 'completed') {
      try {
        const stripeService = (await import('../../../services/stripe.service'))
          .default
        await stripeService.createRefund(
          order.transaction_id,
          undefined, // Full refund
          'requested_by_customer',
        )
      } catch (error) {
        logger.error('Failed to create refund:', error)
        // Continue with cancellation even if refund fails
        // Admin can handle manually
      }
    }

    // Restore stock
    const itemsResult = await query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [id],
    )

    for (const item of itemsResult.rows) {
      await query(
        `UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW()
         WHERE id = $2`,
        [item.quantity, item.product_id],
      )
    }

    // Update order status
    const updateResult = await query(
      `UPDATE orders SET 
        order_status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_reason = $1,
        updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reason || 'Cancelled by customer', id],
    )

    res.json({
      success: true,
      data: {
        order: updateResult.rows[0],
      },
    })
  } catch (error) {
    logger.error('Cancel order error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
    })
  }
}

export const getOrderItems = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    res.json({
      success: true,
      message: 'Get order items - Not yet fully implemented',
      data: {
        orderId: id,
        items: [],
      },
    })
  } catch (error) {
    logger.error('Get order items error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get order items',
    })
  }
}
