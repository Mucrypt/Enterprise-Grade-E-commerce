import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query, getClient } from '../../../database/connection'
import logger from '../../../utils/logger'
import emailService from '../../../services/email.service'
import { sendOrderConfirmationEmail, OrderDetails } from '../../../utils/email'
import {
  sendOrderConfirmationWhatsApp,
  OrderDetails as WhatsAppOrderDetails,
} from '../../../services/whatsapp.service'
import { resolveSupplierForOrderItem } from '../../../services/fulfillment.service'
import { buildOrderAdminAlertHtml } from '../../../utils/order-notifications'

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
    logger.info(`Fetching order details for ID: ${id}`)

    // Get order with customer info
    logger.debug('Executing order query...')
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
      logger.warn(`Order not found: ${id}`)
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      })
    }

    logger.debug('Executing order items query...')
    // Get order items with product info and image from product_media table
    const itemsResult = await query(
      `SELECT
        oi.*,
        p.name as product_title,
        s.company_name as supplier_name,
        (SELECT url FROM product_media
         WHERE product_id = oi.product_id AND type = 'image'
         ORDER BY position ASC, created_at ASC
         LIMIT 1) as product_image
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN suppliers s ON oi.supplier_id = s.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at`,
      [id],
    )

    // Log item details for debugging
    if (itemsResult.rows.length > 0) {
      itemsResult.rows.forEach((item, idx) => {
        logger.info(
          `Item ${idx + 1}: product_id=${item.product_id}, product_image=${
            item.product_image ? 'FOUND' : 'NULL'
          }`,
        )
      })
    }

    logger.debug('Executing payments query...')
    // Get payments for this order
    const paymentsResult = await query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at`,
      [id],
    )

    logger.info(
      `Successfully fetched order ${id} with ${itemsResult.rows.length} items and ${paymentsResult.rows.length} payments`,
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
    logger.error('Get admin order error:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      orderId: req.params.id,
    })
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

  // Order + items + inventory reservation run inside one transaction (using
  // the same helpers the checkout-session flow uses) so a mid-request
  // failure can never leave an order with missing items, or stock reserved
  // against an order that doesn't fully exist -- previously each INSERT/
  // UPDATE here was an independent, unguarded query.
  const client = await getClient()
  let committed = false
  try {
    await client.query('BEGIN')

    const { orderItems, totalAmount } = await validateAndPriceOrderItems(
      client,
      items,
    )
    const { taxAmount, shippingAmount, grandTotal } =
      calculateOrderTotals(totalAmount)
    const orderNumber = generateOrderNumber()

    // Create order
    const orderResult = await client.query(
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

    await insertOrderItemsAndReserveStock(client, order.id, orderItems)

    await client.query('COMMIT')
    committed = true

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

    // Send order confirmation email
    try {
      const emailDetails: OrderDetails = {
        orderNumber: order.order_number,
        customerName:
          `${shippingAddress.firstName || ''} ${
            shippingAddress.lastName || ''
          }`.trim() || 'Customer',
        customerEmail: shippingAddress.email,
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        subtotal: totalAmount,
        taxAmount: taxAmount,
        shippingAmount: shippingAmount,
        grandTotal: grandTotal,
        shippingAddress: {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
        },
        estimatedDelivery: order.estimated_delivery_date
          ? new Date(order.estimated_delivery_date).toLocaleDateString(
              'en-US',
              {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              },
            )
          : undefined,
      }

      await sendOrderConfirmationEmail(shippingAddress.email, emailDetails)
      logger.info('Order confirmation email sent:', {
        orderNumber: order.order_number,
        email: shippingAddress.email,
      })
      await query(
        'UPDATE orders SET confirmation_sent_at = NOW() WHERE id = $1',
        [order.id],
      )

      await emailService.sendAdminNotification({
        subject: `New order received: ${order.order_number}`,
        html: buildOrderAdminAlertHtml({
          orderNumber: order.order_number,
          customerName: emailDetails.customerName,
          customerEmail: shippingAddress.email,
          grandTotal: grandTotal,
          itemCount: orderItems.length,
        }),
        emailType: 'custom',
      })
    } catch (emailError) {
      // Don't fail the order if email fails
      logger.error('Failed to send order confirmation email:', emailError)
    }

    // Send WhatsApp notification (if phone number provided and WhatsApp is configured)
    try {
      const customerPhone = shippingAddress.phone
      if (customerPhone) {
        const whatsappDetails: WhatsAppOrderDetails = {
          orderNumber: order.order_number,
          customerName:
            `${shippingAddress.firstName || ''} ${
              shippingAddress.lastName || ''
            }`.trim() || 'Customer',
          customerPhone,
          items: orderItems.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
          subtotal: totalAmount,
          taxAmount: taxAmount,
          shippingAmount: shippingAmount,
          grandTotal: grandTotal,
          estimatedDelivery: order.estimated_delivery_date
            ? new Date(order.estimated_delivery_date).toLocaleDateString(
                'en-US',
                {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                },
              )
            : undefined,
        }

        await sendOrderConfirmationWhatsApp(whatsappDetails)
        logger.info('Order confirmation WhatsApp sent:', {
          orderNumber: order.order_number,
          phone: customerPhone,
        })
      }
    } catch (whatsappError) {
      // Don't fail the order if WhatsApp fails
      logger.error('Failed to send order confirmation WhatsApp:', whatsappError)
    }

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
    if (!committed) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // ignore -- original error is what matters
      }
    }
    if (error instanceof OrderValidationError) {
      return res.status(error.status).json({ success: false, error: error.message })
    }
    logger.error('Create order error:', error)
    // In development/debugging, include more details
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create order'
    res.status(500).json({
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV !== 'production' && error instanceof Error
          ? error.stack
          : undefined,
    })
  } finally {
    client.release()
  }
}

// ============================================
// Checkout session (order draft + PaymentIntent created together)
//
// Unlike createOrder/createGuestOrder above (which still exist, unchanged,
// for backward compatibility with the mobile app), these two endpoints
// create the order BEFORE payment is attempted, so a successful Stripe
// charge can never exist without a corresponding order row, and the
// PaymentIntent always has the correct orderId in its metadata from the
// moment it's created. See docs/PRODUCTION-READINESS-AUDIT.md.
// ============================================

type PricedItem = {
  productId: string
  sku: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

/** Thrown by validateAndPriceOrderItems for a client-facing validation failure. */
class OrderValidationError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Server-side price/stock validation, run inside the caller's open
 * transaction (via `client`) so it can never see a different product/stock
 * state than the INSERTs that follow it in the same request.
 */
async function validateAndPriceOrderItems(
  client: { query: (text: string, params?: any[]) => Promise<any> },
  items: Array<{ productId: string; quantity: number }>,
): Promise<{ orderItems: PricedItem[]; totalAmount: number }> {
  let totalAmount = 0
  const orderItems: PricedItem[] = []

  for (const item of items) {
    const productResult = await client.query(
      `SELECT p.id, p.name, p.sku, p.base_price, p.sale_price,
              COALESCE((SELECT SUM(i.available_stock) FROM inventory i WHERE i.product_id = p.id), 0) as total_stock
       FROM products p
       WHERE p.id = $1 AND p.is_active = true`,
      [item.productId],
    )

    if (!productResult.rows[0]) {
      throw new OrderValidationError(400, `Product not found: ${item.productId}`)
    }

    const product = productResult.rows[0]
    const availableStock = parseInt(product.total_stock, 10)
    if (availableStock < item.quantity) {
      throw new OrderValidationError(
        400,
        `Insufficient stock for ${product.name}. Available: ${availableStock}`,
      )
    }

    const effectivePrice = parseFloat(product.sale_price || product.base_price)
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

  return { orderItems, totalAmount }
}

/** Same tax/shipping formula as createOrder/createGuestOrder, in one place. */
function calculateOrderTotals(totalAmount: number): {
  taxAmount: number
  shippingAmount: number
  grandTotal: number
} {
  const taxRate = 0.08 // 8% tax - can be configurable
  const taxAmount = totalAmount * taxRate
  const shippingAmount = totalAmount >= 50 ? 0 : 5.99
  const grandTotal = totalAmount + taxAmount + shippingAmount
  return { taxAmount, shippingAmount, grandTotal }
}

function generateOrderNumber(): string {
  return `TT-${Date.now().toString().slice(-8)}-${Math.random()
    .toString(36)
    .substr(2, 4)
    .toUpperCase()}`
}

async function insertOrderItemsAndReserveStock(
  client: { query: (text: string, params?: any[]) => Promise<any> },
  orderId: string,
  orderItems: PricedItem[],
) {
  for (const item of orderItems) {
    const supplierId = await resolveSupplierForOrderItem(item.productId)
    await client.query(
      `INSERT INTO order_items (
        order_id, product_id, sku, product_name,
        quantity, unit_price, supplier_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        orderId,
        item.productId,
        item.sku,
        item.productName,
        item.quantity,
        item.unitPrice,
        supplierId,
      ],
    )
    await client.query(
      `UPDATE inventory SET
        reserved_stock = reserved_stock + $1,
        updated_at = NOW()
       WHERE product_id = $2`,
      [item.quantity, item.productId],
    )
  }
}

/**
 * Authenticated checkout session: creates the order (pending payment) and a
 * Stripe PaymentIntent for it in one call, returning clientSecret + orderId.
 */
export const createOrderCheckoutSession = async (
  req: AuthRequest,
  res: Response,
) => {
  const userId = req.user?.userId
  const { items, shippingAddress, billingAddress, customerNotes } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: 'Order items are required' })
  }
  if (!shippingAddress) {
    return res
      .status(400)
      .json({ success: false, error: 'Shipping address is required' })
  }

  let userEmail: string | undefined
  if (userId) {
    const userResult = await query('SELECT email FROM users WHERE id = $1', [
      userId,
    ])
    userEmail = userResult.rows[0]?.email
  }

  const client = await getClient()
  let committed = false
  try {
    await client.query('BEGIN')

    const { orderItems, totalAmount } = await validateAndPriceOrderItems(
      client,
      items,
    )
    const { taxAmount, shippingAmount, grandTotal } = calculateOrderTotals(totalAmount)
    const orderNumber = generateOrderNumber()

    const orderResult = await client.query(
      `INSERT INTO orders (
        order_number, user_id, order_status, payment_status,
        total_amount, tax_amount, shipping_amount, grand_total, currency,
        shipping_address, billing_address, customer_notes,
        payment_method, payment_gateway,
        estimated_delivery_date
      ) VALUES (
        $1, $2, 'pending', 'pending',
        $3, $4, $5, $6, 'EUR',
        $7, $8, $9,
        'card', 'stripe',
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
      ],
    )
    const order = orderResult.rows[0]

    await insertOrderItemsAndReserveStock(client, order.id, orderItems)

    await client.query('COMMIT')
    committed = true

    // Stripe call happens after commit -- never hold DB locks/connections
    // open across a network call to a third party.
    const stripeService = (await import('../../../services/stripe.service'))
      .default
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(grandTotal * 100),
      currency: 'eur',
      orderId: order.id,
      customerEmail: userEmail,
      receiptEmail: userEmail,
      description: `TechTools Order ${order.order_number}`,
      shippingAddress: {
        name: `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim(),
        address: {
          line1: shippingAddress.address,
          line2: shippingAddress.apartment || undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country: shippingAddress.country,
        },
      },
      metadata: {
        orderNumber: order.order_number,
        userId: userId || 'guest',
      },
    })

    await query(
      `UPDATE orders SET transaction_id = $1, updated_at = NOW() WHERE id = $2`,
      [paymentIntent.id, order.id],
    )

    res.status(201).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
        orderNumber: order.order_number,
        currency: 'EUR',
        taxAmount,
        shippingAmount,
        grandTotal,
      },
    })
  } catch (error) {
    if (!committed) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // ignore -- original error is what matters
      }
    }
    if (error instanceof OrderValidationError) {
      return res.status(error.status).json({ success: false, error: error.message })
    }
    logger.error('Create checkout session error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start checkout',
    })
  } finally {
    client.release()
  }
}

/**
 * Guest checkout session: same as createOrderCheckoutSession but for
 * unauthenticated shoppers -- no `authenticate` middleware on this route.
 */
export const createGuestOrderCheckoutSession = async (req: any, res: Response) => {
  const {
    items,
    shippingAddress,
    billingAddress,
    customerNotes,
    guestEmail,
    guestPhone,
  } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: 'Order items are required' })
  }
  if (!shippingAddress) {
    return res
      .status(400)
      .json({ success: false, error: 'Shipping address is required' })
  }
  if (!guestEmail) {
    return res
      .status(400)
      .json({ success: false, error: 'Email address is required' })
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(guestEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' })
  }

  const userCheck = await query('SELECT id FROM users WHERE email = $1', [
    guestEmail,
  ])
  if (userCheck.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Email already registered. Please login instead.',
    })
  }

  const client = await getClient()
  let committed = false
  try {
    await client.query('BEGIN')

    const { orderItems, totalAmount } = await validateAndPriceOrderItems(
      client,
      items,
    )
    const { taxAmount, shippingAmount, grandTotal } = calculateOrderTotals(totalAmount)
    const orderNumber = generateOrderNumber()

    const orderResult = await client.query(
      `INSERT INTO orders (
        order_number, user_id, guest_email, guest_first_name, guest_last_name, guest_phone,
        order_status, payment_status,
        total_amount, tax_amount, shipping_amount, grand_total, currency,
        shipping_address, billing_address, customer_notes,
        payment_method, payment_gateway,
        estimated_delivery_date
      ) VALUES (
        $1, NULL, $2, $3, $4, $5,
        'pending', 'pending',
        $6, $7, $8, $9, 'EUR',
        $10, $11, $12,
        'card', 'stripe',
        CURRENT_DATE + INTERVAL '5 days'
      ) RETURNING *`,
      [
        orderNumber,
        guestEmail,
        shippingAddress.firstName || '',
        shippingAddress.lastName || '',
        guestPhone || null,
        totalAmount,
        taxAmount,
        shippingAmount,
        grandTotal,
        JSON.stringify(shippingAddress),
        billingAddress
          ? JSON.stringify(billingAddress)
          : JSON.stringify(shippingAddress),
        customerNotes || null,
      ],
    )
    const order = orderResult.rows[0]

    await insertOrderItemsAndReserveStock(client, order.id, orderItems)

    const { generateCheckoutToken } = await import(
      '../../../services/guest-checkout.service'
    )
    const checkoutToken = generateCheckoutToken()
    await client.query(
      `INSERT INTO guest_checkouts (email, order_id, checkout_token, created_by_ip)
       VALUES ($1, $2, $3, $4)`,
      [guestEmail, order.id, checkoutToken, req.ip || null],
    )

    await client.query('COMMIT')
    committed = true

    const stripeService = (await import('../../../services/stripe.service'))
      .default
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(grandTotal * 100),
      currency: 'eur',
      orderId: order.id,
      customerEmail: guestEmail,
      receiptEmail: guestEmail,
      description: `TechTools Order ${order.order_number}`,
      shippingAddress: {
        name: `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim(),
        address: {
          line1: shippingAddress.address,
          line2: shippingAddress.apartment || undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country: shippingAddress.country,
        },
      },
      metadata: {
        orderNumber: order.order_number,
        userId: 'guest',
      },
    })

    await query(
      `UPDATE orders SET transaction_id = $1, updated_at = NOW() WHERE id = $2`,
      [paymentIntent.id, order.id],
    )

    res.status(201).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
        orderNumber: order.order_number,
        checkoutToken,
        currency: 'EUR',
        taxAmount,
        shippingAmount,
        grandTotal,
      },
    })
  } catch (error) {
    if (!committed) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // ignore -- original error is what matters
      }
    }
    if (error instanceof OrderValidationError) {
      return res.status(error.status).json({ success: false, error: error.message })
    }
    logger.error('Create guest checkout session error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start checkout',
    })
  } finally {
    client.release()
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

    // Verify order belongs to user. (Previously this joined `payments` and
    // aliased payments.status as `payment_status`, shadowing the real
    // orders.payment_status column of the same name on the returned row --
    // fragile and confusing. orders.transaction_id already holds the Stripe
    // PaymentIntent id directly, no join needed.)
    const orderResult = await query(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
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
    let refundIssued = false
    if (order.transaction_id && order.payment_status === 'paid') {
      try {
        const stripeService = (await import('../../../services/stripe.service'))
          .default
        await stripeService.createRefund(
          order.transaction_id,
          undefined, // Full refund
          'requested_by_customer',
        )
        refundIssued = true
      } catch (error) {
        logger.error('Failed to create refund:', error)
        // Continue with cancellation even if refund fails
        // Admin can handle manually
      }
    }

    // Release the stock reservation made at checkout. Checkout only ever
    // increments inventory.reserved_stock (never products.stock_quantity),
    // so restoring stock must release that same reservation -- crediting
    // products.stock_quantity instead (as this used to) silently left
    // cancelled orders' units stuck reserved forever, permanently shrinking
    // available_stock (current_stock - reserved_stock) with every
    // cancellation.
    const itemsResult = await query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [id],
    )

    for (const item of itemsResult.rows) {
      await query(
        `UPDATE inventory SET
          reserved_stock = GREATEST(0, reserved_stock - $1),
          updated_at = NOW()
         WHERE product_id = $2`,
        [item.quantity, item.product_id],
      )
    }

    // Update order status. Also reflect the refund/cancellation on
    // payment_status -- previously this was left untouched (e.g. a
    // successfully-refunded order would still show payment_status='paid').
    const updateResult = await query(
      `UPDATE orders SET
        order_status = 'cancelled',
        payment_status = CASE
          WHEN $3 THEN 'refunded'
          WHEN payment_status = 'pending' THEN 'cancelled'
          ELSE payment_status
        END,
        cancelled_at = NOW(),
        cancelled_reason = $1,
        updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reason || 'Cancelled by customer', id, refundIssued],
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

// =====================================================
// Guest Checkout
// =====================================================

/**
 * Create guest order (no authentication required)
 */
export const createGuestOrder = async (req: any, res: Response) => {
  const {
    items,
    shippingAddress,
    billingAddress,
    customerNotes,
    paymentIntentId,
    paymentMethod = 'card',
    guestEmail,
    guestPhone,
  } = req.body

  // Validate required fields
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

  if (!guestEmail) {
    return res.status(400).json({
      success: false,
      error: 'Email address is required',
    })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(guestEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email address',
    })
  }

  // Check if email is already registered
  const userCheck = await query('SELECT id FROM users WHERE email = $1', [
    guestEmail,
  ])
  if (userCheck.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Email already registered. Please login instead.',
    })
  }

  // Order + items + inventory reservation + guest_checkouts session all run
  // inside one transaction -- see the same rationale on createOrder above.
  const client = await getClient()
  let committed = false
  let order: any
  let checkoutToken = ''
  let orderItems: PricedItem[] = []
  let totalAmount = 0
  let taxAmount = 0
  let shippingAmount = 0
  let grandTotal = 0

  try {
    await client.query('BEGIN')

    const priced = await validateAndPriceOrderItems(client, items)
    orderItems = priced.orderItems
    totalAmount = priced.totalAmount
    ;({ taxAmount, shippingAmount, grandTotal } =
      calculateOrderTotals(totalAmount))
    const orderNumber = generateOrderNumber()

    // Create order with NULL user_id for guest
    const orderResult = await client.query(
      `INSERT INTO orders (
        order_number, user_id, guest_email, guest_first_name, guest_last_name, guest_phone,
        order_status, payment_status,
        total_amount, tax_amount, shipping_amount, grand_total,
        shipping_address, billing_address, customer_notes,
        payment_method, payment_gateway, transaction_id,
        estimated_delivery_date
      ) VALUES (
        $1, NULL, $2, $3, $4, $5,
        'pending', 'pending',
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, 'stripe', $14,
        CURRENT_DATE + INTERVAL '5 days'
      ) RETURNING *`,
      [
        orderNumber,
        guestEmail,
        shippingAddress.firstName || '',
        shippingAddress.lastName || '',
        guestPhone || null,
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

    order = orderResult.rows[0]

    await insertOrderItemsAndReserveStock(client, order.id, orderItems)

    // Create guest checkout session
    const guestCheckoutService = await import(
      '../../../services/guest-checkout.service'
    )
    checkoutToken = guestCheckoutService.generateCheckoutToken()
    await client.query(
      `INSERT INTO guest_checkouts (email, order_id, checkout_token, created_by_ip)
       VALUES ($1, $2, $3, $4)`,
      [guestEmail, order.id, checkoutToken, req.ip || null],
    )

    await client.query('COMMIT')
    committed = true

    // Send confirmation email
    try {
      await sendOrderConfirmationEmail(guestEmail, {
        orderNumber: order.order_number,
        customerName:
          `${shippingAddress.firstName || ''} ${
            shippingAddress.lastName || ''
          }`.trim() || 'Valued Customer',
        customerEmail: guestEmail,
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        subtotal: totalAmount,
        taxAmount: taxAmount,
        shippingAmount: shippingAmount,
        grandTotal: grandTotal,
        shippingAddress: {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
          phone: guestPhone,
        },
      })
      await query(
        'UPDATE orders SET confirmation_sent_at = NOW() WHERE id = $1',
        [order.id],
      )

      await emailService.sendAdminNotification({
        subject: `New guest order received: ${order.order_number}`,
        html: buildOrderAdminAlertHtml({
          orderNumber: order.order_number,
          customerName:
            `${shippingAddress.firstName || ''} ${
              shippingAddress.lastName || ''
            }`.trim() || 'Valued Customer',
          customerEmail: guestEmail,
          grandTotal: grandTotal,
          itemCount: orderItems.length,
        }),
        emailType: 'custom',
      })
    } catch (emailError) {
      logger.warn('Failed to send order confirmation email:', emailError)
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        checkoutToken: checkoutToken,
        email: guestEmail,
        grandTotal: grandTotal,
      },
    })
  } catch (error) {
    if (!committed) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // ignore -- original error is what matters
      }
    }
    if (error instanceof OrderValidationError) {
      return res.status(error.status).json({ success: false, error: error.message })
    }
    logger.error('Create guest order error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create guest order',
    })
  } finally {
    client.release()
  }
}

/**
 * Get guest order by token (no authentication required)
 */
export const getGuestOrder = async (req: any, res: Response) => {
  try {
    const { email, token } = req.query

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        error: 'Email and token are required',
      })
    }

    // Get order by email and token
    const orderResult = await query(
      `SELECT o.* FROM orders o
       JOIN guest_checkouts gc ON o.id = gc.order_id
       WHERE gc.email = $1 AND gc.checkout_token = $2 AND gc.expires_at > NOW()`,
      [email, token],
    )

    if (!orderResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or token expired',
      })
    }

    const order = orderResult.rows[0]

    // Get order items
    const itemsResult = await query(
      `SELECT oi.*, p.name, p.image_url, p.sku FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id],
    )

    res.json({
      success: true,
      data: {
        orderNumber: order.order_number,
        status: order.order_status,
        paymentStatus: order.payment_status,
        grandTotal: order.grand_total,
        items: itemsResult.rows,
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        createdAt: order.created_at,
        estimatedDelivery: order.estimated_delivery_date,
      },
    })
  } catch (error) {
    logger.error('Get guest order error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve order',
    })
  }
}

/**
 * Public order tracking by order number + email -- no authentication and no
 * guest checkout token required (that token isn't something a customer would
 * have on hand when typing an order number into a "track my order" form; the
 * order number + the email it was placed under is the standard low-friction
 * pattern for this). Matches either a guest order (orders.guest_email) or an
 * authenticated order (via the owning user's email).
 */
export const trackOrderByNumber = async (req: any, res: Response) => {
  try {
    const { orderNumber, email } = req.query

    if (!orderNumber || !email) {
      return res.status(400).json({
        success: false,
        error: 'Order number and email are required',
      })
    }

    const orderResult = await query(
      `SELECT o.id, o.order_number, o.order_status, o.payment_status,
              o.created_at, o.estimated_delivery_date
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.order_number = $1 AND (o.guest_email = $2 OR u.email = $2)`,
      [orderNumber, email],
    )

    if (!orderResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'No order found for that order number and email',
      })
    }

    const order = orderResult.rows[0]

    const itemsResult = await query(
      `SELECT product_name, quantity, item_status, tracking_number, carrier,
              shipped_at, delivered_at
       FROM order_items WHERE order_id = $1`,
      [order.id],
    )

    res.json({
      success: true,
      data: {
        orderNumber: order.order_number,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        createdAt: order.created_at,
        estimatedDelivery: order.estimated_delivery_date,
        items: itemsResult.rows.map((item: any) => ({
          productName: item.product_name,
          quantity: item.quantity,
          itemStatus: item.item_status,
          trackingNumber: item.tracking_number,
          carrier: item.carrier,
          shippedAt: item.shipped_at,
          deliveredAt: item.delivered_at,
        })),
      },
    })
  } catch (error) {
    logger.error('Track order error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to look up order',
    })
  }
}
