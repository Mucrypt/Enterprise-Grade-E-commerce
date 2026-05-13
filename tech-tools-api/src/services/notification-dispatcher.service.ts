/**
 * NOTIFICATION DISPATCHER SERVICE
 * Orchestrates multi-channel alert notifications (email, Slack, SMS)
 */

import logger from '../utils/logger'
import { emailNotificationService } from './email-notification.service'
import { slackNotificationService } from './slack-notification.service'
import { smsNotificationService } from './sms-notification.service'
import { query } from '../database/connection'

interface AdminNotificationPreference {
  adminId: string
  emailEnabled: boolean
  emailAddress?: string
  slackEnabled: boolean
  slackChannel?: string
  smsEnabled: boolean
  phoneNumber?: string
  severityThreshold: 'critical' | 'high' | 'medium' | 'low'
}

interface AlertNotification {
  alertId: string
  alertType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  currentValue: number
  thresholdValue: number
  triggeredAt: Date
}

const SEVERITY_PRIORITY = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

class NotificationDispatcher {
  /**
   * Initialize all notification services
   */
  initializeAll(): void {
    logger.info('Initializing notification services...')
    emailNotificationService.initialize()
    slackNotificationService.initialize()
    smsNotificationService.initialize()
    logger.info('✅ All notification services initialized')
  }

  /**
   * Dispatch alert to all configured channels for an admin
   */
  async dispatchAlert(alert: AlertNotification, adminId: string): Promise<void> {
    try {
      // Get admin notification preferences
      const preferences = await this.getAdminPreferences(adminId)

      if (!preferences) {
        logger.warn(`No notification preferences found for admin ${adminId}`)
        return
      }

      // Check if alert meets severity threshold for this admin
      if (
        SEVERITY_PRIORITY[alert.severity] > SEVERITY_PRIORITY[preferences.severityThreshold]
      ) {
        logger.debug(
          `Alert ${alert.alertId} below severity threshold for admin ${adminId}, skipping dispatch`
        )
        return
      }

      // Dispatch to configured channels
      const dispatchPromises: Promise<void>[] = []

      if (preferences.emailEnabled && preferences.emailAddress) {
        dispatchPromises.push(
          this.sendEmail(alert, preferences.emailAddress).catch((error) => {
            logger.error(`Failed to send email for alert ${alert.alertId}:`, error)
          })
        )
      }

      if (preferences.slackEnabled && preferences.slackChannel) {
        dispatchPromises.push(
          this.sendSlack(alert, preferences.slackChannel).catch((error) => {
            logger.error(`Failed to send Slack notification for alert ${alert.alertId}:`, error)
          })
        )
      }

      if (preferences.smsEnabled && preferences.phoneNumber) {
        dispatchPromises.push(
          this.sendSMS(alert, preferences.phoneNumber).catch((error) => {
            logger.error(`Failed to send SMS for alert ${alert.alertId}:`, error)
          })
        )
      }

      if (dispatchPromises.length === 0) {
        logger.warn(`No notification channels enabled for admin ${adminId}`)
        return
      }

      // Execute all dispatch operations
      await Promise.all(dispatchPromises)

      logger.info(`Alert ${alert.alertId} dispatched to ${dispatchPromises.length} channel(s)`)
    } catch (error) {
      logger.error(`Failed to dispatch alert ${alert.alertId}:`, error)
    }
  }

  /**
   * Dispatch alert to all admins
   */
  async dispatchAlertToAllAdmins(alert: AlertNotification): Promise<void> {
    try {
      // Get all active admins with notification enabled
      const queryText = `
        SELECT DISTINCT u.id, u.email
        FROM users u
        WHERE u.role IN ('admin', 'super_admin')
          AND u.status = 'active'
        LIMIT 100;
      `

      const result = await query(queryText)
      const adminIds = result.rows.map((row) => row.id)

      if (adminIds.length === 0) {
        logger.warn('No active admins found to dispatch alert')
        return
      }

      const dispatchPromises = adminIds.map((adminId) => this.dispatchAlert(alert, adminId))

      const results = await Promise.allSettled(dispatchPromises)
      const failed = results.filter((r) => r.status === 'rejected').length

      if (failed > 0) {
        logger.warn(`Failed to dispatch alert to ${failed} of ${adminIds.length} admins`)
      }
    } catch (error) {
      logger.error('Failed to dispatch alert to all admins:', error)
    }
  }

  /**
   * Get admin notification preferences
   */
  private async getAdminPreferences(adminId: string): Promise<AdminNotificationPreference | null> {
    try {
      const queryText = `
        SELECT
          admin_id,
          email_enabled,
          email_address,
          slack_enabled,
          slack_channel,
          sms_enabled,
          phone_number,
          severity_threshold
        FROM admin_notification_preferences
        WHERE admin_id = $1;
      `

      const result = await query(queryText, [adminId])

      if (result.rows.length === 0) {
        // Return default preferences if not found
        return {
          adminId,
          emailEnabled: true,
          slackEnabled: false,
          smsEnabled: false,
          severityThreshold: 'high',
        }
      }

      const row = result.rows[0]
      return {
        adminId: row.admin_id,
        emailEnabled: row.email_enabled,
        emailAddress: row.email_address,
        slackEnabled: row.slack_enabled,
        slackChannel: row.slack_channel,
        smsEnabled: row.sms_enabled,
        phoneNumber: row.phone_number,
        severityThreshold: row.severity_threshold,
      }
    } catch (error) {
      logger.error(`Failed to fetch preferences for admin ${adminId}:`, error)
      return null
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(alert: AlertNotification, emailAddress: string): Promise<void> {
    await emailNotificationService.sendAlertNotification({
      alertId: alert.alertId,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      currentValue: alert.currentValue,
      thresholdValue: alert.thresholdValue,
      recipientEmail: emailAddress,
      triggeredAt: alert.triggeredAt,
      dashboardLink: `${process.env.ADMIN_DASHBOARD_URL}/dashboard/alerts`,
    })
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(alert: AlertNotification, channel: string): Promise<void> {
    await slackNotificationService.sendAlertNotification({
      alertId: alert.alertId,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      currentValue: alert.currentValue,
      thresholdValue: alert.thresholdValue,
      channel,
      triggeredAt: alert.triggeredAt,
      dashboardLink: `${process.env.ADMIN_DASHBOARD_URL}/dashboard/alerts`,
    })
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(alert: AlertNotification, phoneNumber: string): Promise<void> {
    await smsNotificationService.sendAlertNotification({
      alertId: alert.alertId,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      currentValue: alert.currentValue,
      thresholdValue: alert.thresholdValue,
      recipientPhoneNumber: phoneNumber,
      triggeredAt: alert.triggeredAt,
      dashboardLink: `${process.env.ADMIN_DASHBOARD_URL}/dashboard/alerts`,
    })
  }
}

// Export singleton instance
export const notificationDispatcher = new NotificationDispatcher()
