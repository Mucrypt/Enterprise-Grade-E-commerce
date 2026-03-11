import axios from 'axios'
import logger from '../utils/logger'
import { query } from '../database/connection'

// ============================================
// WhatsApp Configuration Types
// ============================================

export interface WhatsAppConfig {
  provider: 'twilio' | 'meta' | 'messagebird'
  accountSid?: string // Twilio
  authToken?: string // Twilio
  fromNumber: string // WhatsApp sender number
  metaToken?: string // Meta Business API token
  metaPhoneId?: string // Meta Phone Number ID
}

export interface OrderDetails {
  orderNumber: string
  customerName: string
  customerPhone: string
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  subtotal: number
  taxAmount: number
  shippingAmount: number
  grandTotal: number
  estimatedDelivery?: string
  trackingUrl?: string
}

export interface WhatsAppMessage {
  id?: string
  orderId?: string
  recipientPhone: string
  messageType:
    | 'order_confirmation'
    | 'order_status'
    | 'shipping_update'
    | 'delivery_confirmation'
    | 'custom'
  messageContent: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  providerId?: string
  errorMessage?: string
}

// ============================================
// WhatsApp Service Class
// ============================================

class WhatsAppService {
  private config: WhatsAppConfig | null = null

  constructor() {
    this.loadConfig()
  }

  private loadConfig() {
    const provider = (process.env.WHATSAPP_PROVIDER ||
      'twilio') as WhatsAppConfig['provider']

    this.config = {
      provider,
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.WHATSAPP_FROM_NUMBER || '',
      metaToken: process.env.META_WHATSAPP_TOKEN,
      metaPhoneId: process.env.META_PHONE_NUMBER_ID,
    }
  }

  /**
   * Check if WhatsApp is properly configured
   */
  isConfigured(): boolean {
    if (!this.config?.fromNumber) return false

    if (this.config.provider === 'twilio') {
      return !!(this.config.accountSid && this.config.authToken)
    } else if (this.config.provider === 'meta') {
      return !!(this.config.metaToken && this.config.metaPhoneId)
    }

    return false
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '')

    // Add '+' prefix if not present
    if (!cleaned.startsWith('+')) {
      // Assume it needs country code - default to +1 for US if 10 digits
      if (cleaned.length === 10) {
        cleaned = '1' + cleaned
      }
      cleaned = '+' + cleaned
    }

    return cleaned
  }

  /**
   * Send WhatsApp message via Twilio
   */
  private async sendViaTwilio(
    to: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config!.accountSid}/Messages.json`

      const formData = new URLSearchParams()
      formData.append('From', `whatsapp:${this.config!.fromNumber}`)
      formData.append('To', `whatsapp:${this.formatPhoneNumber(to)}`)
      formData.append('Body', message)

      const response = await axios.post(url, formData, {
        auth: {
          username: this.config!.accountSid!,
          password: this.config!.authToken!,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      return {
        success: true,
        messageId: response.data.sid,
      }
    } catch (error: any) {
      logger.error(
        'Twilio WhatsApp error:',
        error.response?.data || error.message,
      )
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      }
    }
  }

  /**
   * Send WhatsApp message via Meta Cloud API
   */
  private async sendViaMeta(
    to: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const url = `https://graph.facebook.com/v18.0/${this.config!.metaPhoneId}/messages`

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to).replace('+', ''),
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config!.metaToken}`,
            'Content-Type': 'application/json',
          },
        },
      )

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      }
    } catch (error: any) {
      logger.error(
        'Meta WhatsApp error:',
        error.response?.data || error.message,
      )
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  /**
   * Send a WhatsApp message
   */
  async sendMessage(
    to: string,
    message: string,
    options?: {
      orderId?: string
      messageType?: WhatsAppMessage['messageType']
    },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp not configured. Message not sent:', { to })
      return { success: false, error: 'WhatsApp not configured' }
    }

    let result: { success: boolean; messageId?: string; error?: string }

    if (this.config!.provider === 'twilio') {
      result = await this.sendViaTwilio(to, message)
    } else if (this.config!.provider === 'meta') {
      result = await this.sendViaMeta(to, message)
    } else {
      return { success: false, error: 'Unknown provider' }
    }

    // Save message to database
    try {
      await query(
        `INSERT INTO whatsapp_messages (
          order_id, recipient_phone, message_type, message_content,
          status, provider_message_id, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          options?.orderId || null,
          this.formatPhoneNumber(to),
          options?.messageType || 'custom',
          message,
          result.success ? 'sent' : 'failed',
          result.messageId || null,
          result.error || null,
        ],
      )
    } catch (dbError) {
      logger.error('Failed to save WhatsApp message to database:', dbError)
    }

    if (result.success) {
      logger.info('WhatsApp message sent:', { to, messageId: result.messageId })
    }

    return result
  }

  /**
   * Send order confirmation WhatsApp message
   */
  async sendOrderConfirmation(
    details: OrderDetails,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const itemsList = details.items
      .map(
        (item) =>
          `• ${item.productName} x${item.quantity} - $${item.totalPrice.toFixed(2)}`,
      )
      .join('\n')

    const message = `🎉 *Order Confirmed!*

Hi ${details.customerName}! 👋

Your order *#${details.orderNumber}* has been confirmed! ✅

📦 *Order Summary:*
${itemsList}

💰 *Payment Details:*
Subtotal: $${details.subtotal.toFixed(2)}
Tax: $${details.taxAmount.toFixed(2)}
Shipping: $${details.shippingAmount.toFixed(2)}
━━━━━━━━━━━━━━
*Total: $${details.grandTotal.toFixed(2)}*

${details.estimatedDelivery ? `📅 *Estimated Delivery:* ${details.estimatedDelivery}` : ''}

We'll send you updates as your order progresses! 

Thank you for shopping with *TechTools Store* ⚡

Questions? Reply to this message or contact support@techtoolstore.com`

    return this.sendMessage(details.customerPhone, message, {
      orderId: details.orderNumber,
      messageType: 'order_confirmation',
    })
  }

  /**
   * Send order status update WhatsApp message
   */
  async sendOrderStatusUpdate(
    orderId: string,
    orderNumber: string,
    customerName: string,
    customerPhone: string,
    status: string,
    additionalInfo?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const statusEmojis: Record<string, string> = {
      confirmed: '✅',
      processing: '⚙️',
      ready_to_ship: '📦',
      shipped: '🚚',
      delivered: '🎉',
      cancelled: '❌',
      refunded: '💰',
    }

    const statusMessages: Record<string, string> = {
      confirmed: 'Your order has been confirmed and is being prepared!',
      processing: 'Your order is being processed by our team.',
      ready_to_ship: 'Your order is packed and ready to ship!',
      shipped: 'Your order is on its way! 🚚',
      delivered: 'Your order has been delivered! We hope you love it!',
      cancelled: 'Your order has been cancelled.',
      refunded: 'Your refund has been processed.',
    }

    const emoji = statusEmojis[status] || '📋'
    const statusMessage =
      statusMessages[status] ||
      `Your order status has been updated to: ${status}`

    const message = `${emoji} *Order Update*

Hi ${customerName}!

Order *#${orderNumber}*
${statusMessage}

${additionalInfo ? `ℹ️ ${additionalInfo}` : ''}

Track your order anytime at techtoolstore.com/orders

*TechTools Store* ⚡`

    return this.sendMessage(customerPhone, message, {
      orderId,
      messageType: 'order_status',
    })
  }

  /**
   * Send shipping update with tracking info
   */
  async sendShippingUpdate(
    orderId: string,
    orderNumber: string,
    customerName: string,
    customerPhone: string,
    carrier: string,
    trackingNumber: string,
    trackingUrl?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚚 *Shipping Update*

Hi ${customerName}!

Great news! Your order *#${orderNumber}* has shipped! 📦

*Carrier:* ${carrier}
*Tracking Number:* ${trackingNumber}
${trackingUrl ? `*Track Here:* ${trackingUrl}` : ''}

Your package is on its way to you! 🎉

*TechTools Store* ⚡`

    return this.sendMessage(customerPhone, message, {
      orderId,
      messageType: 'shipping_update',
    })
  }

  /**
   * Send delivery confirmation
   */
  async sendDeliveryConfirmation(
    orderId: string,
    orderNumber: string,
    customerName: string,
    customerPhone: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🎉 *Order Delivered!*

Hi ${customerName}!

Your order *#${orderNumber}* has been delivered! 📦✅

We hope everything arrived in perfect condition!

💬 *Leave a Review:*
We'd love to hear your feedback! Rate your purchase at techtoolstore.com/reviews

Need help? Contact support@techtoolstore.com

Thank you for shopping with *TechTools Store* ⚡`

    return this.sendMessage(customerPhone, message, {
      orderId,
      messageType: 'delivery_confirmation',
    })
  }

  /**
   * Send a custom message
   */
  async sendCustomMessage(
    phone: string,
    message: string,
    orderId?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendMessage(phone, message, {
      orderId,
      messageType: 'custom',
    })
  }

  /**
   * Get all WhatsApp messages with pagination
   */
  async getMessages(options: {
    page?: number
    limit?: number
    status?: string
    messageType?: string
    search?: string
    startDate?: string
    endDate?: string
  }): Promise<{
    messages: any[]
    total: number
    page: number
    totalPages: number
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      messageType,
      search,
      startDate,
      endDate,
    } = options
    const offset = (page - 1) * limit

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`wm.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (messageType) {
      conditions.push(`wm.message_type = $${paramIndex}`)
      params.push(messageType)
      paramIndex++
    }

    if (search) {
      conditions.push(
        `(wm.recipient_phone ILIKE $${paramIndex} OR wm.message_content ILIKE $${paramIndex})`,
      )
      params.push(`%${search}%`)
      paramIndex++
    }

    if (startDate) {
      conditions.push(`wm.created_at >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      conditions.push(`wm.created_at <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get messages with order info
    const messagesQuery = `
      SELECT 
        wm.*,
        o.order_number,
        o.shipping_address->>'first_name' as customer_first_name,
        o.shipping_address->>'last_name' as customer_last_name
      FROM whatsapp_messages wm
      LEFT JOIN orders o ON wm.order_id::text = o.id::text OR wm.order_id = o.order_number
      ${whereClause}
      ORDER BY wm.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    params.push(limit, offset)

    const result = await query(messagesQuery, params)

    // Get total count
    const countParams = params.slice(0, -2)
    const countQuery = `
      SELECT COUNT(*) 
      FROM whatsapp_messages wm
      ${whereClause}
    `
    const countResult = await query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].count)

    return {
      messages: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get message statistics
   */
  async getMessageStats(): Promise<{
    total: number
    sent: number
    delivered: number
    read: number
    failed: number
    todayCount: number
    weekCount: number
  }> {
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'read') as read,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as week_count
      FROM whatsapp_messages
    `)

    const stats = statsResult.rows[0]
    return {
      total: parseInt(stats.total),
      sent: parseInt(stats.sent),
      delivered: parseInt(stats.delivered),
      read: parseInt(stats.read),
      failed: parseInt(stats.failed),
      todayCount: parseInt(stats.today_count),
      weekCount: parseInt(stats.week_count),
    }
  }

  /**
   * Resend a failed message
   */
  async resendMessage(
    messageId: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const result = await query(
      'SELECT * FROM whatsapp_messages WHERE id = $1',
      [messageId],
    )

    if (result.rows.length === 0) {
      return { success: false, error: 'Message not found' }
    }

    const message = result.rows[0]
    return this.sendMessage(message.recipient_phone, message.message_content, {
      orderId: message.order_id,
      messageType: message.message_type,
    })
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService()
export default whatsappService

// Export individual functions for convenience
export const sendOrderConfirmationWhatsApp = (details: OrderDetails) =>
  whatsappService.sendOrderConfirmation(details)

export const sendOrderStatusUpdateWhatsApp = (
  orderId: string,
  orderNumber: string,
  customerName: string,
  customerPhone: string,
  status: string,
  additionalInfo?: string,
) =>
  whatsappService.sendOrderStatusUpdate(
    orderId,
    orderNumber,
    customerName,
    customerPhone,
    status,
    additionalInfo,
  )

export const sendShippingUpdateWhatsApp = (
  orderId: string,
  orderNumber: string,
  customerName: string,
  customerPhone: string,
  carrier: string,
  trackingNumber: string,
  trackingUrl?: string,
) =>
  whatsappService.sendShippingUpdate(
    orderId,
    orderNumber,
    customerName,
    customerPhone,
    carrier,
    trackingNumber,
    trackingUrl,
  )

export const sendDeliveryConfirmationWhatsApp = (
  orderId: string,
  orderNumber: string,
  customerName: string,
  customerPhone: string,
) =>
  whatsappService.sendDeliveryConfirmation(
    orderId,
    orderNumber,
    customerName,
    customerPhone,
  )
