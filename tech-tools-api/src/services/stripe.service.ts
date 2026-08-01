// ============================================
// TechTools API - Stripe Payment Service
// Enterprise-grade Stripe integration
// ============================================

import Stripe from 'stripe'
import { query } from '../database/connection'
import logger from '../utils/logger'
import digitalEntitlementsService from './digital-entitlements.service'
import emailService from './email.service'
import { sendOrderConfirmationEmail, OrderDetails } from '../utils/email'
import {
  sendOrderConfirmationWhatsApp,
  OrderDetails as WhatsAppOrderDetails,
} from './whatsapp.service'
import { buildOrderAdminAlertHtml } from '../utils/order-notifications'

// Initialize Stripe with latest API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

// ============================================
// Types
// ============================================

export interface CreatePaymentIntentParams {
  amount: number // Amount in cents
  currency?: string
  customerId?: string
  customerEmail?: string
  orderId?: string
  metadata?: Record<string, string>
  description?: string
  receiptEmail?: string
  shippingAddress?: {
    name: string
    address: {
      line1: string
      line2?: string
      city: string
      state: string
      postal_code: string
      country: string
    }
  }
}

export interface CreateCustomerParams {
  email: string
  name?: string
  phone?: string
  userId: string
  metadata?: Record<string, string>
}

export interface SavedPaymentMethod {
  id: string
  type: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  isDefault: boolean
}

// ============================================
// Stripe Service Class
// ============================================

class StripeService {
  // ============================================
  // Customer Management
  // ============================================

  /**
   * Create or retrieve a Stripe customer for a user
   */
  async getOrCreateCustomer(
    params: CreateCustomerParams,
  ): Promise<Stripe.Customer> {
    try {
      // Check if user already has a Stripe customer ID in database
      const userResult = await query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [params.userId],
      )

      if (userResult.rows[0]?.stripe_customer_id) {
        // Retrieve existing customer
        const customer = await stripe.customers.retrieve(
          userResult.rows[0].stripe_customer_id,
        )

        if (!customer.deleted) {
          return customer as Stripe.Customer
        }
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: params.email,
        name: params.name,
        phone: params.phone,
        metadata: {
          userId: params.userId,
          ...params.metadata,
        },
      })

      // Save Stripe customer ID to database
      await query(
        'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
        [customer.id, params.userId],
      )

      logger.info(
        `Created Stripe customer ${customer.id} for user ${params.userId}`,
      )
      return customer
    } catch (error) {
      logger.error('Error creating/retrieving Stripe customer:', error)
      throw error
    }
  }

  /**
   * Update customer information
   */
  async updateCustomer(
    customerId: string,
    params: Partial<Stripe.CustomerUpdateParams>,
  ): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.update(customerId, params)
      return customer
    } catch (error) {
      logger.error('Error updating Stripe customer:', error)
      throw error
    }
  }

  // ============================================
  // Payment Intent Management
  // ============================================

  /**
   * Create a payment intent for checkout
   */
  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: params.amount,
        currency: params.currency || 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          orderId: params.orderId || '',
          ...params.metadata,
        },
      }

      // Add customer if provided
      if (params.customerId) {
        paymentIntentParams.customer = params.customerId
      }

      // Add receipt email
      if (params.receiptEmail) {
        paymentIntentParams.receipt_email = params.receiptEmail
      }

      // Add description
      if (params.description) {
        paymentIntentParams.description = params.description
      }

      // Add shipping address
      if (params.shippingAddress) {
        paymentIntentParams.shipping = params.shippingAddress
      }

      const paymentIntent = await stripe.paymentIntents.create(
        paymentIntentParams,
      )

      logger.info(
        `Created payment intent ${paymentIntent.id} for amount ${params.amount}`,
      )
      return paymentIntent
    } catch (error) {
      logger.error('Error creating payment intent:', error)
      throw error
    }
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId)
    } catch (error) {
      logger.error('Error retrieving payment intent:', error)
      throw error
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const params: Stripe.PaymentIntentConfirmParams = {}

      if (paymentMethodId) {
        params.payment_method = paymentMethodId
      }

      return await stripe.paymentIntents.confirm(paymentIntentId, params)
    } catch (error) {
      logger.error('Error confirming payment intent:', error)
      throw error
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await stripe.paymentIntents.cancel(paymentIntentId)
    } catch (error) {
      logger.error('Error cancelling payment intent:', error)
      throw error
    }
  }

  /**
   * Update a payment intent (e.g., when cart changes)
   */
  async updatePaymentIntent(
    paymentIntentId: string,
    params: Stripe.PaymentIntentUpdateParams,
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await stripe.paymentIntents.update(paymentIntentId, params)
    } catch (error) {
      logger.error('Error updating payment intent:', error)
      throw error
    }
  }

  // ============================================
  // Payment Method Management
  // ============================================

  /**
   * Create a setup intent for saving payment methods
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      return await stripe.setupIntents.create({
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
      })
    } catch (error) {
      logger.error('Error creating setup intent:', error)
      throw error
    }
  }

  /**
   * Get saved payment methods for a customer
   */
  async getPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      })

      // Get default payment method
      const customer = (await stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer
      const defaultPaymentMethodId =
        customer.invoice_settings?.default_payment_method

      return paymentMethods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        isDefault: pm.id === defaultPaymentMethodId,
      }))
    } catch (error) {
      logger.error('Error getting payment methods:', error)
      throw error
    }
  }

  /**
   * Attach a payment method to a customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      return await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      })
    } catch (error) {
      logger.error('Error attaching payment method:', error)
      throw error
    }
  }

  /**
   * Detach (remove) a payment method
   */
  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      return await stripe.paymentMethods.detach(paymentMethodId)
    } catch (error) {
      logger.error('Error detaching payment method:', error)
      throw error
    }
  }

  /**
   * Set default payment method for a customer
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    try {
      return await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      })
    } catch (error) {
      logger.error('Error setting default payment method:', error)
      throw error
    }
  }

  // ============================================
  // Refund Management
  // ============================================

  /**
   * Create a refund for a payment
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer',
  ): Promise<Stripe.Refund> {
    try {
      const params: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      }

      if (amount) {
        params.amount = amount
      }

      if (reason) {
        params.reason = reason
      }

      const refund = await stripe.refunds.create(params)
      logger.info(
        `Created refund ${refund.id} for payment intent ${paymentIntentId}`,
      )
      return refund
    } catch (error) {
      logger.error('Error creating refund:', error)
      throw error
    }
  }

  /**
   * Get refund details
   */
  async getRefund(refundId: string): Promise<Stripe.Refund> {
    try {
      return await stripe.refunds.retrieve(refundId)
    } catch (error) {
      logger.error('Error retrieving refund:', error)
      throw error
    }
  }

  // ============================================
  // Webhook Handling
  // ============================================

  /**
   * Verify and construct webhook event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (error) {
      logger.error('Webhook signature verification failed:', error)
      throw error
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      const orderId = paymentIntent.metadata?.orderId

      if (!orderId) {
        logger.warn('Payment succeeded but no orderId in metadata')
        return
      }

      // Update order payment status
      await query(
        `UPDATE orders SET 
          payment_status = 'paid',
          order_status = 'confirmed',
          transaction_id = $1,
          updated_at = NOW()
        WHERE id = $2`,
        [paymentIntent.id, orderId],
      )

      // Create payment record (idempotent on Stripe transaction_id)
      await query(
        `INSERT INTO payments (
          order_id, payment_method, payment_gateway, transaction_id,
          amount, currency, status, gateway_response, paid_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (transaction_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          gateway_response = EXCLUDED.gateway_response,
          paid_at = COALESCE(payments.paid_at, EXCLUDED.paid_at),
          updated_at = NOW()`,
        [
          orderId,
          paymentIntent.payment_method_types?.[0] || 'card',
          'stripe',
          paymentIntent.id,
          paymentIntent.amount / 100, // Convert from cents
          paymentIntent.currency,
          'completed',
          JSON.stringify({
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            receiptEmail: paymentIntent.receipt_email,
          }),
        ],
      )

      // Grant digital entitlements for paid orders (idempotent).
      await digitalEntitlementsService.grantEntitlementsForPaidOrder(orderId)

      // Send the order confirmation email/WhatsApp now that payment is
      // actually confirmed -- not a fatal error for the webhook if this
      // fails, same "don't fail the order over a notification" rule the
      // legacy order-creation flow already follows.
      try {
        await this.sendOrderConfirmationIfNeeded(orderId)
      } catch (notifyError) {
        logger.error(
          'Failed to send order confirmation after payment succeeded:',
          notifyError,
        )
      }

      logger.info(`Payment succeeded for order ${orderId}`)
    } catch (error) {
      logger.error('Error handling payment succeeded:', error)
      throw error
    }
  }

  /**
   * Send the order-confirmation email/admin notification/WhatsApp exactly
   * once per order. Orders created by the legacy createOrder/createGuestOrder
   * path (order.controller.ts, still used by mobile) already send this
   * inline at order-creation time -- which for that flow only ever runs
   * after payment already succeeded -- and mark `confirmation_sent_at`
   * there too, so this is a no-op for those orders when the webhook fires.
   */
  private async sendOrderConfirmationIfNeeded(orderId: string): Promise<void> {
    const orderResult = await query(
      `SELECT o.*, u.email as user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1 AND o.confirmation_sent_at IS NULL`,
      [orderId],
    )
    const order = orderResult.rows[0]
    if (!order) return // already sent, or order not found

    const itemsResult = await query(
      `SELECT product_name, quantity, unit_price, total_price
       FROM order_items WHERE order_id = $1`,
      [orderId],
    )
    const items = itemsResult.rows.map((item: any) => ({
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      totalPrice: Number(item.total_price),
    }))

    const shippingAddress = order.shipping_address || {}
    const recipientEmail: string | undefined =
      order.guest_email || order.user_email || shippingAddress.email
    if (!recipientEmail) {
      logger.warn(
        `Cannot send order confirmation for ${order.order_number}: no recipient email on file`,
      )
      return
    }

    const customerName =
      `${order.guest_first_name || shippingAddress.firstName || ''} ${
        order.guest_last_name || shippingAddress.lastName || ''
      }`.trim() || 'Valued Customer'

    const orderDetails: OrderDetails = {
      orderNumber: order.order_number,
      customerName,
      customerEmail: recipientEmail,
      items,
      subtotal: Number(order.total_amount),
      taxAmount: Number(order.tax_amount),
      shippingAmount: Number(order.shipping_amount),
      grandTotal: Number(order.grand_total),
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
        ? new Date(order.estimated_delivery_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : undefined,
    }

    await sendOrderConfirmationEmail(recipientEmail, orderDetails)

    await emailService.sendAdminNotification({
      subject: `New order received: ${order.order_number}`,
      html: buildOrderAdminAlertHtml({
        orderNumber: order.order_number,
        customerName,
        customerEmail: recipientEmail,
        grandTotal: Number(order.grand_total),
        itemCount: items.length,
      }),
      emailType: 'custom',
    })

    const phone: string | undefined = order.guest_phone || shippingAddress.phone
    if (phone) {
      const whatsappDetails: WhatsAppOrderDetails = {
        orderNumber: order.order_number,
        customerName,
        customerPhone: phone,
        items,
        subtotal: orderDetails.subtotal,
        taxAmount: orderDetails.taxAmount,
        shippingAmount: orderDetails.shippingAmount,
        grandTotal: orderDetails.grandTotal,
        estimatedDelivery: orderDetails.estimatedDelivery,
      }
      await sendOrderConfirmationWhatsApp(whatsappDetails)
    }

    await query(`UPDATE orders SET confirmation_sent_at = NOW() WHERE id = $1`, [
      orderId,
    ])
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      const orderId = paymentIntent.metadata?.orderId

      if (!orderId) {
        logger.warn('Payment failed but no orderId in metadata')
        return
      }

      // Update order payment status
      await query(
        `UPDATE orders SET 
          payment_status = 'failed',
          updated_at = NOW()
        WHERE id = $1`,
        [orderId],
      )

      // Create failed payment record (idempotent on Stripe transaction_id --
      // without ON CONFLICT here, a Stripe retry of this same event would
      // throw a unique-violation on payments.transaction_id, which the
      // webhook handler surfaces as a 400, causing Stripe to retry again
      // indefinitely).
      await query(
        `INSERT INTO payments (
          order_id, payment_method, payment_gateway, transaction_id,
          amount, currency, status, gateway_response
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (transaction_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          gateway_response = EXCLUDED.gateway_response,
          updated_at = NOW()`,
        [
          orderId,
          paymentIntent.payment_method_types?.[0] || 'card',
          'stripe',
          paymentIntent.id,
          paymentIntent.amount / 100,
          paymentIntent.currency,
          'failed',
          JSON.stringify({
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            lastPaymentError: paymentIntent.last_payment_error?.message,
          }),
        ],
      )

      logger.info(`Payment failed for order ${orderId}`)
    } catch (error) {
      logger.error('Error handling payment failed:', error)
      throw error
    }
  }

  /**
   * Handle refund
   */
  async handleRefundCreated(refund: Stripe.Refund): Promise<void> {
    try {
      // Get payment intent to find order
      const paymentIntent = await this.getPaymentIntent(
        refund.payment_intent as string,
      )
      const orderId = paymentIntent.metadata?.orderId

      if (!orderId) {
        logger.warn('Refund created but no orderId in metadata')
        return
      }

      // Update payment record
      await query(
        `UPDATE payments SET 
          refund_amount = COALESCE(refund_amount, 0) + $1,
          status = CASE 
            WHEN $1 >= amount THEN 'refunded'
            ELSE 'partially_refunded'
          END,
          updated_at = NOW()
        WHERE transaction_id = $2`,
        [refund.amount / 100, paymentIntent.id],
      )

      // Update order status if fully refunded
      if (refund.status === 'succeeded') {
        const paymentResult = await query(
          'SELECT amount, refund_amount FROM payments WHERE transaction_id = $1',
          [paymentIntent.id],
        )

        if (paymentResult.rows[0]) {
          const { amount, refund_amount } = paymentResult.rows[0]
          if (refund_amount >= amount) {
            await query(
              `UPDATE orders SET 
                payment_status = 'refunded',
                order_status = 'refunded',
                updated_at = NOW()
              WHERE id = $1`,
              [orderId],
            )
          }
        }
      }

      logger.info(`Refund processed for order ${orderId}`)
    } catch (error) {
      logger.error('Error handling refund:', error)
      throw error
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Calculate order amount from cart items (in cents)
   */
  calculateOrderAmount(
    items: Array<{ price: number; quantity: number }>,
  ): number {
    return Math.round(
      items.reduce((total, item) => total + item.price * item.quantity, 0) *
        100,
    )
  }

  /**
   * Get Stripe publishable key (for client)
   */
  getPublishableKey(): string {
    return process.env.STRIPE_PUBLISHABLE_KEY || ''
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY
    )
  }
}

// Export singleton instance
export const stripeService = new StripeService()
export default stripeService
