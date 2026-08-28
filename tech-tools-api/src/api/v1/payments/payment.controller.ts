// ============================================
// TechTools API - Payment Controller
// Stripe Payment Integration
// ============================================

import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import stripeService from '../../../services/stripe.service'
import logger from '../../../utils/logger'
import { recordAdminActivity } from '../../../services/admin-activity.service'

// ============================================
// Configuration
// ============================================

/**
 * Get Stripe publishable key for client initialization
 */
export const getStripeConfig = async (_req: Request, res: Response) => {
  try {
    if (!stripeService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Payment service is not configured',
      })
    }

    res.json({
      success: true,
      data: {
        publishableKey: stripeService.getPublishableKey(),
      },
    })
  } catch (error) {
    logger.error('Get Stripe config error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get payment configuration',
    })
  }
}

// ============================================
// Payment Intent Management
// ============================================

/**
 * Create a payment intent for checkout
 */
export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const {
      items,
      shippingAddress,
      currency = 'usd',
      savePaymentMethod = false,
    } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items are required',
      })
    }

    // Get user info for customer creation
    let userEmail = ''
    let userName = ''
    let customerId: string | undefined

    if (userId) {
      const userResult = await query(
        'SELECT email, first_name, last_name, stripe_customer_id FROM users WHERE id = $1',
        [userId],
      )

      if (userResult.rows[0]) {
        const user = userResult.rows[0]
        userEmail = user.email
        userName = `${user.first_name || ''} ${user.last_name || ''}`.trim()

        // Get or create Stripe customer
        if (savePaymentMethod || user.stripe_customer_id) {
          const customer = await stripeService.getOrCreateCustomer({
            email: user.email,
            name: userName,
            userId,
          })
          customerId = customer.id
        }
      }
    }

    // Calculate total amount
    const amount = stripeService.calculateOrderAmount(items)

    if (amount < 50) {
      // Stripe minimum is $0.50
      return res.status(400).json({
        success: false,
        error: 'Order total must be at least $0.50',
      })
    }

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount,
      currency,
      customerId,
      receiptEmail: userEmail || undefined,
      description: `TechTools Order - ${items.length} item(s)`,
      shippingAddress: shippingAddress
        ? {
            name: shippingAddress.name || userName,
            address: {
              line1: shippingAddress.address,
              line2: shippingAddress.apartment || undefined,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postal_code: shippingAddress.postalCode,
              country: shippingAddress.country || 'US',
            },
          }
        : undefined,
      metadata: {
        userId: userId || 'guest',
        itemCount: String(items.length),
      },
    })

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
    })
  } catch (error) {
    logger.error('Create payment intent error:', error)
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create payment intent',
    })
  }
}

/**
 * Update an existing payment intent (e.g., when cart changes)
 */
export const updatePaymentIntent = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIntentId, items, shippingAddress } = req.body

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID is required',
      })
    }

    const updateParams: any = {}

    if (items && Array.isArray(items)) {
      updateParams.amount = stripeService.calculateOrderAmount(items)
      updateParams.metadata = {
        itemCount: String(items.length),
      }
    }

    if (shippingAddress) {
      updateParams.shipping = {
        name: shippingAddress.name,
        address: {
          line1: shippingAddress.address,
          line2: shippingAddress.apartment || undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country: shippingAddress.country || 'US',
        },
      }
    }

    const paymentIntent = await stripeService.updatePaymentIntent(
      paymentIntentId,
      updateParams,
    )

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
      },
    })
  } catch (error) {
    logger.error('Update payment intent error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update payment intent',
    })
  }
}

/**
 * Get payment intent status
 */
export const getPaymentIntentStatus = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { paymentIntentId } = req.params

    const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId)

    res.json({
      success: true,
      data: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
    })
  } catch (error) {
    logger.error('Get payment intent status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status',
    })
  }
}

/**
 * Confirm a payment (server-side confirmation if needed)
 */
export const confirmPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID is required',
      })
    }

    const paymentIntent = await stripeService.confirmPaymentIntent(
      paymentIntentId,
      paymentMethodId,
    )

    res.json({
      success: true,
      data: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
      },
    })
  } catch (error) {
    logger.error('Confirm payment error:', error)
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to confirm payment',
    })
  }
}

/**
 * Cancel a payment intent
 */
export const cancelPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIntentId } = req.params

    const paymentIntent = await stripeService.cancelPaymentIntent(
      paymentIntentId,
    )

    res.json({
      success: true,
      data: {
        id: paymentIntent.id,
        status: paymentIntent.status,
      },
    })
  } catch (error) {
    logger.error('Cancel payment error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to cancel payment',
    })
  }
}

// ============================================
// Payment Methods Management
// ============================================

/**
 * Get customer's saved payment methods
 */
export const getPaymentMethods = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    // Get user's Stripe customer ID
    const userResult = await query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId],
    )

    if (!userResult.rows[0]?.stripe_customer_id) {
      return res.json({
        success: true,
        data: {
          paymentMethods: [],
        },
      })
    }

    const paymentMethods = await stripeService.getPaymentMethods(
      userResult.rows[0].stripe_customer_id,
    )

    res.json({
      success: true,
      data: {
        paymentMethods,
      },
    })
  } catch (error) {
    logger.error('Get payment methods error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get payment methods',
    })
  }
}

/**
 * Create a setup intent for saving payment methods
 */
export const createSetupIntent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    // Get user info
    const userResult = await query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [userId],
    )

    if (!userResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = userResult.rows[0]

    // Get or create Stripe customer
    const customer = await stripeService.getOrCreateCustomer({
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      userId,
    })

    // Create setup intent
    const setupIntent = await stripeService.createSetupIntent(customer.id)

    res.json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
        customerId: customer.id,
      },
    })
  } catch (error) {
    logger.error('Create setup intent error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create setup intent',
    })
  }
}

/**
 * Add (attach) a payment method to customer
 */
export const addPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { paymentMethodId, setAsDefault = false } = req.body

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Payment method ID is required',
      })
    }

    // Get user's Stripe customer ID
    const userResult = await query(
      'SELECT email, first_name, last_name, stripe_customer_id FROM users WHERE id = $1',
      [userId],
    )

    let customerId = userResult.rows[0]?.stripe_customer_id

    // Create customer if doesn't exist
    if (!customerId) {
      const user = userResult.rows[0]
      const customer = await stripeService.getOrCreateCustomer({
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        userId,
      })
      customerId = customer.id
    }

    // Attach payment method
    await stripeService.attachPaymentMethod(paymentMethodId, customerId)

    // Set as default if requested
    if (setAsDefault) {
      await stripeService.setDefaultPaymentMethod(customerId, paymentMethodId)
    }

    res.json({
      success: true,
      message: 'Payment method added successfully',
    })
  } catch (error) {
    logger.error('Add payment method error:', error)
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to add payment method',
    })
  }
}

/**
 * Remove a payment method
 */
export const removePaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { methodId } = req.params

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    // Verify the payment method belongs to this user's customer
    const userResult = await query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId],
    )

    if (!userResult.rows[0]?.stripe_customer_id) {
      return res.status(404).json({
        success: false,
        error: 'No payment methods found',
      })
    }

    await stripeService.detachPaymentMethod(methodId)

    res.json({
      success: true,
      message: 'Payment method removed successfully',
    })
  } catch (error) {
    logger.error('Remove payment method error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to remove payment method',
    })
  }
}

/**
 * Set default payment method
 */
export const setDefaultPaymentMethod = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.userId
    const { paymentMethodId } = req.body

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const userResult = await query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId],
    )

    if (!userResult.rows[0]?.stripe_customer_id) {
      return res.status(404).json({
        success: false,
        error: 'No customer found',
      })
    }

    await stripeService.setDefaultPaymentMethod(
      userResult.rows[0].stripe_customer_id,
      paymentMethodId,
    )

    res.json({
      success: true,
      message: 'Default payment method updated',
    })
  } catch (error) {
    logger.error('Set default payment method error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to set default payment method',
    })
  }
}

// ============================================
// Payment History
// ============================================

/**
 * Get payment history for user
 */
export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { page = 1, limit = 10 } = req.query

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const offset = (Number(page) - 1) * Number(limit)

    // Get payments for user's orders
    const paymentsResult = await query(
      `SELECT 
        p.*,
        o.order_number,
        o.grand_total as order_total
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE o.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    )

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE o.user_id = $1`,
      [userId],
    )

    const total = parseInt(countResult.rows[0].count)

    res.json({
      success: true,
      data: {
        payments: paymentsResult.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get payment history error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get payment history',
    })
  }
}

// ============================================
// Refunds (Admin)
// ============================================

/**
 * Create a refund for an order
 */
export const createRefund = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, amount, reason } = req.body

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required',
      })
    }

    // Get payment for this order
    const paymentResult = await query(
      `SELECT transaction_id, amount, currency FROM payments 
       WHERE order_id = $1 AND status = 'completed'
       ORDER BY created_at DESC LIMIT 1`,
      [orderId],
    )

    if (!paymentResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'No completed payment found for this order',
      })
    }

    const payment = paymentResult.rows[0]

    // Create refund in Stripe (amount in cents)
    const refundAmount = amount ? Math.round(amount * 100) : undefined
    const refund = await stripeService.createRefund(
      payment.transaction_id,
      refundAmount,
      reason as any,
    )

    // Update payment record
    const paymentUpdateResult = await query(
      `UPDATE payments SET
        refund_amount = COALESCE(refund_amount, 0) + $1,
        refund_reason = $2,
        status = CASE
          WHEN COALESCE(refund_amount, 0) + $1 >= amount THEN 'refunded'
          ELSE 'partially_refunded'
        END,
        updated_at = NOW()
      WHERE order_id = $3
      RETURNING status`,
      [refund.amount / 100, reason, orderId],
    )

    // Mirror the refund onto the order itself -- previously this endpoint
    // only updated the `payments` row, leaving orders.payment_status stuck
    // at 'paid' even after a full refund.
    const isFullyRefunded = paymentUpdateResult.rows[0]?.status === 'refunded'
    await query(
      `UPDATE orders SET
        payment_status = $1,
        order_status = CASE WHEN $2 THEN 'refunded' ELSE order_status END,
        updated_at = NOW()
       WHERE id = $3`,
      [
        isFullyRefunded ? 'refunded' : 'partially_refunded',
        isFullyRefunded,
        orderId,
      ],
    )

    const actorUserId = req.user?.userId
    if (actorUserId) {
      recordAdminActivity({
        actorUserId,
        action: 'order_refunded',
        resourceType: 'orders',
        resourceId: orderId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          amount: refund.amount / 100,
          currency: payment.currency,
          fullyRefunded: isFullyRefunded,
        },
      })
    }

    res.json({
      success: true,
      data: {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
      },
    })
  } catch (error) {
    logger.error('Create refund error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create refund',
    })
  }
}

// ============================================
// Stripe Webhook Handler
// ============================================

/**
 * Handle Stripe webhook events
 */
export const handleWebhook = async (
  req: Request & { rawBody?: Buffer },
  res: Response,
) => {
  const sig = req.headers['stripe-signature'] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.error('Stripe webhook secret not configured')
    return res.status(500).json({ error: 'Webhook not configured' })
  }

  if (!req.rawBody) {
    logger.error(
      'Stripe webhook received without a captured raw body -- signature verification cannot proceed',
    )
    return res.status(400).json({ error: 'Missing raw request body' })
  }

  try {
    const event = stripeService.constructWebhookEvent(
      req.rawBody,
      sig,
      webhookSecret,
    )

    logger.info(`Received Stripe webhook: ${event.type}`)

    // Idempotency gate: Stripe retries webhook deliveries (e.g. if our
    // response is slow or briefly unavailable), so guard against
    // reprocessing the same event twice -- duplicate confirmation emails,
    // double-counted refund amounts, etc. stripe_webhook_events.event_id
    // is UNIQUE (013_stripe_integration.sql), so this insert is the gate.
    const eventRecord = await query(
      `INSERT INTO stripe_webhook_events (event_id, event_type, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [event.id, event.type, JSON.stringify(event)],
    )
    if (eventRecord.rowCount === 0) {
      logger.info(`Duplicate Stripe webhook ignored: ${event.id}`)
      return res.json({ received: true, duplicate: true })
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await stripeService.handlePaymentSucceeded(event.data.object as any)
        break

      case 'payment_intent.payment_failed':
        await stripeService.handlePaymentFailed(event.data.object as any)
        break

      case 'charge.refunded':
        // Handled via refund.created for more detail
        break

      case 'refund.created':
        await stripeService.handleRefundCreated(event.data.object as any)
        break

      default:
        logger.info(`Unhandled event type: ${event.type}`)
    }

    res.json({ received: true })
  } catch (error) {
    logger.error('Webhook error:', error)
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Webhook error',
    })
  }
}
