/**
 * SMS NOTIFICATION SERVICE
 * Sends alert notifications via SMS using Twilio
 */

import twilio from 'twilio'
import logger from '../utils/logger'

interface SMSNotification {
  alertId: string
  alertType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  currentValue: number
  thresholdValue: number
  recipientPhoneNumber: string
  triggeredAt: Date
  dashboardLink?: string
}

const SEVERITY_PREFIX = {
  critical: '🚨 CRITICAL:',
  high: '⚠️ HIGH:',
  medium: '⚠ MEDIUM:',
  low: 'ℹ️ LOW:',
}

class SMSNotificationService {
  private twilioClient: ReturnType<typeof twilio> | null = null
  private twilioFromNumber: string | null = null
  private isConfigured = false
  private criticalAlertsOnly = true

  /**
   * Initialize SMS service
   */
  initialize(): void {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_FROM_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      logger.warn('SMS service not configured - SMS notifications disabled')
      this.isConfigured = false
      return
    }

    try {
      this.twilioClient = twilio(accountSid, authToken)
      this.twilioFromNumber = fromNumber
      this.criticalAlertsOnly = process.env.SMS_CRITICAL_ONLY !== 'false'

      logger.info('✅ SMS notification service initialized')
      this.isConfigured = true
    } catch (error) {
      logger.error('Failed to initialize Twilio client:', error)
      this.isConfigured = false
    }
  }

  /**
   * Send alert notification via SMS
   */
  async sendAlertNotification(notification: SMSNotification): Promise<void> {
    if (!this.isConfigured || !this.twilioClient || !this.twilioFromNumber) {
      logger.warn('SMS service not configured, skipping SMS notification')
      return
    }

    // Only send critical/high severity alerts via SMS to avoid spam
    if (this.criticalAlertsOnly && !['critical', 'high'].includes(notification.severity)) {
      logger.debug(`Skipping SMS for ${notification.severity} severity alert (SMS critical-only mode enabled)`)
      return
    }

    try {
      const messageBody = this.generateSMSMessage(notification)

      await this.twilioClient.messages.create({
        from: this.twilioFromNumber,
        to: notification.recipientPhoneNumber,
        body: messageBody,
      })

      logger.info(`Alert SMS sent to ${notification.recipientPhoneNumber} for alert ${notification.alertId}`)
    } catch (error) {
      logger.error('Failed to send SMS notification:', error)
      throw error
    }
  }

  /**
   * Send batch SMS notifications
   */
  async sendBatchAlertNotifications(notifications: SMSNotification[]): Promise<void> {
    const results = await Promise.allSettled(
      notifications.map((notification) => this.sendAlertNotification(notification))
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      logger.warn(`Failed to send ${failed} of ${notifications.length} SMS notifications`)
    }
  }

  /**
   * Generate SMS message text (max 160 characters)
   */
  private generateSMSMessage(notification: SMSNotification): string {
    const prefix = SEVERITY_PREFIX[notification.severity]
    const baseMessage = `${prefix} ${notification.title} (${notification.currentValue} vs threshold ${notification.thresholdValue})`

    // SMS messages are typically limited to 160 characters
    // If too long, truncate and add ellipsis
    if (baseMessage.length > 160) {
      return baseMessage.substring(0, 157) + '...'
    }

    return baseMessage
  }

  /**
   * Send test SMS notification
   */
  async sendTestNotification(phoneNumber: string): Promise<void> {
    if (!this.isConfigured || !this.twilioClient) {
      throw new Error('SMS service not configured')
    }

    try {
      const testNotification: SMSNotification = {
        alertId: 'test-' + Date.now(),
        alertType: 'test_alert',
        severity: 'high',
        title: 'Test Alert',
        message: 'This is a test notification to verify SMS integration.',
        currentValue: 25.5,
        thresholdValue: 20,
        recipientPhoneNumber: phoneNumber,
        triggeredAt: new Date(),
      }

      await this.sendAlertNotification(testNotification)
      logger.info('Test SMS notification sent successfully')
    } catch (error) {
      logger.error('Failed to send test SMS notification:', error)
      throw error
    }
  }

  /**
   * Check if SMS is configured
   */
  isReady(): boolean {
    return this.isConfigured
  }
}

// Export singleton instance
export const smsNotificationService = new SMSNotificationService()
