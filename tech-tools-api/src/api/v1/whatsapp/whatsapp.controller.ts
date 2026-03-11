import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import whatsappService from '../../../services/whatsapp.service'
import logger from '../../../utils/logger'

// =====================================================
// WhatsApp Message Management
// =====================================================

/**
 * Get all WhatsApp messages with pagination and filters
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, messageType, search, startDate, endDate } = req.query

    const result = await whatsappService.getMessages({
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      messageType: messageType as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
    })

    res.json({
      success: true,
      data: {
        messages: result.messages,
        pagination: {
          page: result.page,
          limit: Number(limit),
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    })
  } catch (error) {
    logger.error('Get WhatsApp messages error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get WhatsApp messages',
    })
  }
}

/**
 * Get WhatsApp message statistics
 */
export const getMessageStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await whatsappService.getMessageStats()

    res.json({
      success: true,
      data: { stats },
    })
  } catch (error) {
    logger.error('Get WhatsApp stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get WhatsApp statistics',
    })
  }
}

/**
 * Get a single message by ID
 */
export const getMessageById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      `SELECT 
        wm.*,
        o.order_number,
        o.shipping_address->>'first_name' as customer_first_name,
        o.shipping_address->>'last_name' as customer_last_name
      FROM whatsapp_messages wm
      LEFT JOIN orders o ON wm.order_id::text = o.id::text OR wm.order_id = o.order_number
      WHERE wm.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      })
    }

    res.json({
      success: true,
      data: { message: result.rows[0] },
    })
  } catch (error) {
    logger.error('Get WhatsApp message error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get message',
    })
  }
}

/**
 * Send a custom WhatsApp message
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { recipientPhone, message, orderId } = req.body

    if (!recipientPhone || !message) {
      return res.status(400).json({
        success: false,
        error: 'recipientPhone and message are required',
      })
    }

    const result = await whatsappService.sendCustomMessage(recipientPhone, message, orderId)

    if (result.success) {
      res.json({
        success: true,
        message: 'WhatsApp message sent successfully',
        data: { messageId: result.messageId },
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send message',
      })
    }
  } catch (error) {
    logger.error('Send WhatsApp message error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp message',
    })
  }
}

/**
 * Resend a failed message
 */
export const resendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await whatsappService.resendMessage(id)

    if (result.success) {
      res.json({
        success: true,
        message: 'Message resent successfully',
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to resend message',
      })
    }
  } catch (error) {
    logger.error('Resend WhatsApp message error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to resend message',
    })
  }
}

/**
 * Send WhatsApp to an order
 */
export const sendToOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params
    const { messageType } = req.body

    // Get order details
    const orderResult = await query(
      `SELECT 
        o.*,
        u.phone as user_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = $1 OR o.order_number = $1`,
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      })
    }

    const order = orderResult.rows[0]
    const shippingAddress = order.shipping_address
    const customerPhone = shippingAddress?.phone || order.user_phone

    if (!customerPhone) {
      return res.status(400).json({
        success: false,
        error: 'No phone number found for this order',
      })
    }

    const customerName = `${shippingAddress?.first_name || ''} ${shippingAddress?.last_name || ''}`.trim() || 'Customer'

    let result

    switch (messageType) {
      case 'order_confirmation':
        // Get order items
        const itemsResult = await query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [order.id]
        )

        result = await whatsappService.sendOrderConfirmation({
          orderNumber: order.order_number,
          customerName,
          customerPhone,
          items: itemsResult.rows.map((item: any) => ({
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unit_price),
            totalPrice: parseFloat(item.total_price),
          })),
          subtotal: parseFloat(order.total_amount),
          taxAmount: parseFloat(order.tax_amount),
          shippingAmount: parseFloat(order.shipping_amount),
          grandTotal: parseFloat(order.grand_total),
          estimatedDelivery: order.estimated_delivery_date,
        })
        break

      case 'order_status':
        result = await whatsappService.sendOrderStatusUpdate(
          order.id,
          order.order_number,
          customerName,
          customerPhone,
          order.order_status
        )
        break

      case 'shipping_update':
        // Get tracking info from order items
        const trackingItem = await query(
          'SELECT carrier, tracking_number FROM order_items WHERE order_id = $1 AND tracking_number IS NOT NULL LIMIT 1',
          [order.id]
        )

        if (trackingItem.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No tracking information available for this order',
          })
        }

        result = await whatsappService.sendShippingUpdate(
          order.id,
          order.order_number,
          customerName,
          customerPhone,
          trackingItem.rows[0].carrier,
          trackingItem.rows[0].tracking_number
        )
        break

      case 'delivery_confirmation':
        result = await whatsappService.sendDeliveryConfirmation(
          order.id,
          order.order_number,
          customerName,
          customerPhone
        )
        break

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid message type. Use: order_confirmation, order_status, shipping_update, or delivery_confirmation',
        })
    }

    if (result.success) {
      res.json({
        success: true,
        message: `${messageType} WhatsApp sent successfully`,
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send message',
      })
    }
  } catch (error) {
    logger.error('Send WhatsApp to order error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp message',
    })
  }
}

// =====================================================
// WhatsApp Settings Management
// =====================================================

/**
 * Get WhatsApp settings
 */
export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM whatsapp_settings ORDER BY setting_key')

    const settings: Record<string, any> = {}
    result.rows.forEach((row: any) => {
      settings[row.setting_key] = {
        value: row.is_encrypted ? '********' : row.setting_value,
        description: row.description,
        isEncrypted: row.is_encrypted,
      }
    })

    // Add configuration status
    const isConfigured = whatsappService.isConfigured()

    res.json({
      success: true,
      data: {
        settings,
        isConfigured,
        provider: process.env.WHATSAPP_PROVIDER || 'twilio',
      },
    })
  } catch (error) {
    logger.error('Get WhatsApp settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
    })
  }
}

/**
 * Update WhatsApp settings
 */
export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Settings object is required',
      })
    }

    for (const [key, value] of Object.entries(settings)) {
      await query(
        `UPDATE whatsapp_settings 
         SET setting_value = $1, updated_at = NOW() 
         WHERE setting_key = $2`,
        [value, key]
      )
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    logger.error('Update WhatsApp settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    })
  }
}

// =====================================================
// WhatsApp Templates Management
// =====================================================

/**
 * Get all templates
 */
export const getTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM whatsapp_templates ORDER BY name')

    res.json({
      success: true,
      data: { templates: result.rows },
    })
  } catch (error) {
    logger.error('Get WhatsApp templates error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get templates',
    })
  }
}

/**
 * Get a template by ID
 */
export const getTemplateById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const result = await query('SELECT * FROM whatsapp_templates WHERE id = $1', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    res.json({
      success: true,
      data: { template: result.rows[0] },
    })
  } catch (error) {
    logger.error('Get WhatsApp template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get template',
    })
  }
}

/**
 * Create a new template
 */
export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { name, templateKey, messageContent, variables } = req.body

    if (!name || !templateKey || !messageContent) {
      return res.status(400).json({
        success: false,
        error: 'name, templateKey, and messageContent are required',
      })
    }

    const result = await query(
      `INSERT INTO whatsapp_templates (name, template_key, message_content, variables)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, templateKey, messageContent, JSON.stringify(variables || [])]
    )

    res.status(201).json({
      success: true,
      data: { template: result.rows[0] },
    })
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Template key already exists',
      })
    }
    logger.error('Create WhatsApp template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
    })
  }
}

/**
 * Update a template
 */
export const updateTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, messageContent, variables, isActive } = req.body

    const result = await query(
      `UPDATE whatsapp_templates 
       SET name = COALESCE($1, name),
           message_content = COALESCE($2, message_content),
           variables = COALESCE($3, variables),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, messageContent, variables ? JSON.stringify(variables) : null, isActive, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    res.json({
      success: true,
      data: { template: result.rows[0] },
    })
  } catch (error) {
    logger.error('Update WhatsApp template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
    })
  }
}

/**
 * Delete a template
 */
export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query('DELETE FROM whatsapp_templates WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error) {
    logger.error('Delete WhatsApp template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
    })
  }
}

/**
 * Get WhatsApp configuration status (public endpoint for checking if WhatsApp is configured)
 */
export const getConfigStatus = async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        isConfigured: whatsappService.isConfigured(),
        provider: process.env.WHATSAPP_PROVIDER || 'twilio',
      },
    })
  } catch (error) {
    logger.error('Get WhatsApp config status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration status',
    })
  }
}
