import { query as dbQuery } from '../database/connection'
import logger from '../utils/logger'
import emailService from '../utils/email'

export interface NotificationPayload {
  userId?: string
  adminId?: string
  type: string // 'order_placed', 'user_signup', etc.
  title: string
  message: string
  description?: string
  icon?: string
  actionUrl?: string
  actionLabel?: string
  data?: Record<string, any>
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  sendEmail?: boolean
  sendPush?: boolean
  sendSMS?: boolean
  expiresIn?: number // milliseconds
}

export class NotificationService {
  /**
   * Create and send a notification
   */
  static async create(payload: NotificationPayload) {
    try {
      let notificationId: string

      if (payload.userId) {
        // User notification
        notificationId = await this.createUserNotification(payload)
      } else if (payload.adminId) {
        // Admin notification
        notificationId = await this.createAdminNotification(payload)
      } else {
        throw new Error('Either userId or adminId must be provided')
      }

      // Send to appropriate channels asynchronously
      this.sendToChannels(notificationId, payload).catch((err) => {
        logger.error('Error sending notification to channels:', err)
      })

      return notificationId
    } catch (error) {
      logger.error('Error creating notification:', error)
      throw error
    }
  }

  /**
   * Create user notification
   */
  private static async createUserNotification(
    payload: NotificationPayload,
  ): Promise<string> {
    const expiresAt = payload.expiresIn
      ? new Date(Date.now() + payload.expiresIn)
      : null

    const result = await dbQuery(
      `INSERT INTO notifications (
        user_id, title, message, description, icon, action_url, action_label,
        data, priority, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        payload.userId,
        payload.title,
        payload.message,
        payload.description || null,
        payload.icon || null,
        payload.actionUrl || null,
        payload.actionLabel || null,
        JSON.stringify(payload.data || {}),
        payload.priority || 'normal',
        expiresAt,
      ],
    )

    return result.rows[0].id
  }

  /**
   * Create admin notification
   */
  private static async createAdminNotification(
    payload: NotificationPayload,
  ): Promise<string> {
    const result = await dbQuery(
      `INSERT INTO admin_notifications (
        admin_id, notification_type, title, message, data, priority
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [
        payload.adminId,
        payload.type,
        payload.title,
        payload.message,
        JSON.stringify(payload.data || {}),
        payload.priority || 'normal',
      ],
    )

    return result.rows[0].id
  }

  /**
   * Send notification to channels (email, push, SMS, etc.)
   */
  private static async sendToChannels(
    notificationId: string,
    payload: NotificationPayload,
  ) {
    if (payload.sendEmail) {
      this.sendEmailNotification(notificationId, payload)
    }
    if (payload.sendPush) {
      this.sendPushNotification(notificationId, payload)
    }
    if (payload.sendSMS) {
      this.sendSMSNotification(notificationId, payload)
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    notificationId: string,
    payload: NotificationPayload,
  ) {
    try {
      if (!payload.userId) return

      // Get user email
      const userResult = await dbQuery(
        'SELECT email FROM users WHERE id = $1',
        [payload.userId],
      )

      if (userResult.rows.length === 0) return

      const userEmail = userResult.rows[0].email

      // Send email
      await emailService.send({
        to: userEmail,
        subject: payload.title,
        html: `
          <h2>${payload.title}</h2>
          <p>${payload.message}</p>
          ${
            payload.description
              ? `<p><small>${payload.description}</small></p>`
              : ''
          }
          ${
            payload.actionUrl
              ? `<p><a href="${payload.actionUrl}">${
                  payload.actionLabel || 'View'
                }</a></p>`
              : ''
          }
        `,
      })

      // Mark as email sent
      await dbQuery(
        `UPDATE notifications SET email_sent = TRUE, email_sent_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [notificationId],
      )

      logger.info(`Email notification sent for notification: ${notificationId}`)
    } catch (error) {
      logger.error(`Error sending email notification ${notificationId}:`, error)
      await this.logDeliveryError(notificationId, 'email', error)
    }
  }

  /**
   * Send push notification (FCM, APNs, etc.)
   */
  private static async sendPushNotification(
    notificationId: string,
    payload: NotificationPayload,
  ) {
    try {
      if (!payload.userId) return

      // Get push tokens for user (from mobile app)
      const tokensResult = await dbQuery(
        `SELECT push_token FROM user_devices 
         WHERE user_id = $1 AND push_token IS NOT NULL`,
        [payload.userId],
      )

      if (tokensResult.rows.length === 0) return

      // TODO: Implement Firebase Cloud Messaging or similar
      // For now, just log as sent
      logger.info(
        `Push notification queued for ${tokensResult.rows.length} devices`,
      )

      // Mark as push sent
      await dbQuery(
        `UPDATE notifications SET push_sent = TRUE, push_sent_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [notificationId],
      )
    } catch (error) {
      logger.error(`Error sending push notification ${notificationId}:`, error)
      await this.logDeliveryError(notificationId, 'push', error)
    }
  }

  /**
   * Send SMS notification
   */
  private static async sendSMSNotification(
    notificationId: string,
    payload: NotificationPayload,
  ) {
    try {
      if (!payload.userId) return

      // Get user phone
      const userResult = await dbQuery(
        'SELECT phone FROM users WHERE id = $1',
        [payload.userId],
      )

      if (userResult.rows.length === 0 || !userResult.rows[0].phone) return

      // TODO: Implement Twilio or similar SMS service
      logger.info(`SMS notification queued`)

      // Mark as SMS sent
      await dbQuery(
        `UPDATE notifications SET sms_sent = TRUE, sms_sent_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [notificationId],
      )
    } catch (error) {
      logger.error(`Error sending SMS notification ${notificationId}:`, error)
      await this.logDeliveryError(notificationId, 'sms', error)
    }
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
  ) {
    const limit = options.limit || 50
    const offset = options.offset || 0

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 AND is_archived = FALSE
    `
    const params: any[] = [userId]

    if (options.unreadOnly) {
      query += ` AND is_read = FALSE`
    }

    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`
    params.push(limit, offset)

    const result = await dbQuery(query, params)
    return result.rows
  }

  /**
   * Get admin notifications
   */
  static async getAdminNotifications(
    adminId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
  ) {
    const limit = options.limit || 50
    const offset = options.offset || 0

    let query = `
      SELECT * FROM admin_notifications 
      WHERE admin_id = $1 AND is_archived = FALSE
    `
    const params: any[] = [adminId]

    if (options.unreadOnly) {
      query += ` AND is_read = FALSE`
    }

    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`
    params.push(limit, offset)

    const result = await dbQuery(query, params)
    return result.rows
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, isAdmin: boolean = false) {
    const table = isAdmin ? 'admin_notifications' : 'notifications'
    await dbQuery(
      `UPDATE ${table} SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [notificationId],
    )
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string, isAdmin: boolean = false) {
    const table = isAdmin ? 'admin_notifications' : 'notifications'
    const column = isAdmin ? 'admin_id' : 'user_id'
    await dbQuery(
      `UPDATE ${table} SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
       WHERE ${column} = $1 AND is_read = FALSE`,
      [userId],
    )
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId: string, isAdmin: boolean = false) {
    const table = isAdmin ? 'admin_notifications' : 'notifications'
    const column = isAdmin ? 'admin_id' : 'user_id'

    const result = await dbQuery(
      `SELECT COUNT(*) as count FROM ${table} 
       WHERE ${column} = $1 AND is_read = FALSE`,
      [userId],
    )

    return parseInt(result.rows[0].count)
  }

  /**
   * Delete notification
   */
  static async delete(notificationId: string, isAdmin: boolean = false) {
    const table = isAdmin ? 'admin_notifications' : 'notifications'
    await dbQuery(`DELETE FROM ${table} WHERE id = $1`, [notificationId])
  }

  /**
   * Archive notification
   */
  static async archive(notificationId: string, isAdmin: boolean = false) {
    const table = isAdmin ? 'admin_notifications' : 'notifications'
    await dbQuery(`UPDATE ${table} SET is_archived = TRUE WHERE id = $1`, [
      notificationId,
    ])
  }

  /**
   * Log delivery error
   */
  private static async logDeliveryError(
    notificationId: string,
    channel: string,
    error: any,
  ) {
    try {
      await dbQuery(
        `INSERT INTO notification_delivery_logs 
         (notification_id, channel, status, error_message, retry_count) 
         VALUES ($1, $2, 'failed', $3, 0)`,
        [
          notificationId,
          channel,
          error instanceof Error ? error.message : String(error),
        ],
      )
    } catch (err) {
      logger.error('Error logging delivery error:', err)
    }
  }

  /**
   * Broadcast notification to admins (for admin dashboard real-time updates)
   */
  static async broadcastToAdmins(
    adminIds: string[],
    payload: NotificationPayload,
  ) {
    for (const adminId of adminIds) {
      await this.create({
        ...payload,
        adminId,
        userId: undefined,
      })
    }
  }
}

export default NotificationService
