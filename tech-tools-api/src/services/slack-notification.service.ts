/**
 * SLACK NOTIFICATION SERVICE
 * Sends alert notifications to Slack channels
 */

import axios, { AxiosInstance } from 'axios'
import logger from '../utils/logger'

interface SlackNotification {
  alertId: string
  alertType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  currentValue: number
  thresholdValue: number
  channel?: string
  triggeredAt: Date
  dashboardLink?: string
}

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#eab308',
  low: '#0284c7',
}

const SEVERITY_EMOJIS = {
  critical: '🚨',
  high: '⚠️',
  medium: '⚠',
  low: 'ℹ️',
}

class SlackNotificationService {
  private webhookUrl: string | null = null
  private httpClient: AxiosInstance | null = null
  private isConfigured = false

  /**
   * Initialize Slack service
   */
  initialize(): void {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL
    const botToken = process.env.SLACK_BOT_TOKEN
    const apiUrl = process.env.SLACK_API_URL || 'https://slack.com/api'

    if (!this.webhookUrl && !botToken) {
      logger.warn('Slack service not configured - Slack notifications disabled')
      this.isConfigured = false
      return
    }

    if (botToken) {
      this.httpClient = axios.create({
        baseURL: apiUrl,
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
      })
    }

    this.isConfigured = true
    logger.info('✅ Slack notification service initialized')
  }

  /**
   * Send alert notification to Slack
   */
  async sendAlertNotification(notification: SlackNotification): Promise<void> {
    if (!this.isConfigured) {
      logger.warn('Slack service not configured, skipping Slack notification')
      return
    }

    try {
      const payload = this.generateSlackPayload(notification)

      if (this.webhookUrl) {
        // Send via webhook
        await axios.post(this.webhookUrl, payload)
      } else if (this.httpClient && notification.channel) {
        // Send via bot token (requires channel parameter)
        await this.httpClient.post('/chat.postMessage', {
          channel: notification.channel,
          ...payload,
        })
      }

      logger.info(
        `Alert notification sent to Slack for alert ${notification.alertId}`,
      )
    } catch (error) {
      logger.error('Failed to send Slack notification:', error)
      throw error
    }
  }

  /**
   * Send batch notifications to Slack
   */
  async sendBatchAlertNotifications(
    notifications: SlackNotification[],
  ): Promise<void> {
    const results = await Promise.allSettled(
      notifications.map((notification) =>
        this.sendAlertNotification(notification),
      ),
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      logger.warn(
        `Failed to send ${failed} of ${notifications.length} Slack notifications`,
      )
    }
  }

  /**
   * Generate Slack message payload
   */
  private generateSlackPayload(notification: SlackNotification): any {
    const color = SEVERITY_COLORS[notification.severity]
    const emoji = SEVERITY_EMOJIS[notification.severity]
    const dashboardLink =
      notification.dashboardLink ||
      `${process.env.ADMIN_DASHBOARD_URL}/dashboard/alerts`

    return {
      text: `${emoji} ${notification.severity.toUpperCase()} Alert: ${
        notification.title
      }`,
      attachments: [
        {
          color,
          title: notification.title,
          text: notification.message,
          fields: [
            {
              title: 'Alert Type',
              value: notification.alertType.replace(/_/g, ' ').toUpperCase(),
              short: true,
            },
            {
              title: 'Severity',
              value: `${emoji} ${notification.severity.toUpperCase()}`,
              short: true,
            },
            {
              title: 'Current Value',
              value: notification.currentValue.toString(),
              short: true,
            },
            {
              title: 'Threshold',
              value: notification.thresholdValue.toString(),
              short: true,
            },
            {
              title: 'Triggered At',
              value: new Date(notification.triggeredAt).toLocaleString(),
              short: false,
            },
          ],
          actions: [
            {
              type: 'button',
              text: 'View in Dashboard',
              url: dashboardLink,
              style: 'danger',
            },
          ],
          footer: 'TechTools E-Commerce Platform',
          ts: Math.floor(notification.triggeredAt.getTime() / 1000),
        },
      ],
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Slack service not configured')
    }

    try {
      const testNotification: SlackNotification = {
        alertId: 'test-' + Date.now(),
        alertType: 'test_alert',
        severity: 'medium',
        title: 'Test Slack Notification',
        message:
          'This is a test notification to verify Slack integration is working correctly.',
        currentValue: 5.5,
        thresholdValue: 5,
        triggeredAt: new Date(),
      }

      await this.sendAlertNotification(testNotification)
      logger.info('Test Slack notification sent successfully')
    } catch (error) {
      logger.error('Failed to send test Slack notification:', error)
      throw error
    }
  }
}

// Export singleton instance
export const slackNotificationService = new SlackNotificationService()
