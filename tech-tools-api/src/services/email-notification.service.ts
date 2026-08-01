/**
 * EMAIL NOTIFICATION SERVICE
 * Sends alert notifications via email using nodemailer
 */

import nodemailer, { Transporter } from 'nodemailer'
import logger from '../utils/logger'

interface EmailNotification {
  alertId: string
  alertType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  currentValue: number
  thresholdValue: number
  recipientEmail: string
  triggeredAt: Date
  dashboardLink?: string
}

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#eab308',
  low: '#0284c7',
}

const SEVERITY_SUBJECT_PREFIX = {
  critical: '🚨 CRITICAL',
  high: '⚠️ HIGH',
  medium: '⚠ MEDIUM',
  low: 'ℹ️ LOW',
}

class EmailNotificationService {
  private transporter: Transporter | null = null
  private isConfigured = false

  /**
   * Initialize email service
   */
  initialize(): void {
    // Matches the env var names actually documented/used everywhere else
    // (email.service.ts, .env.example) -- this previously read
    // SMTP_PASSWORD/SMTP_FROM_EMAIL, which no deployment ever sets (only
    // SMTP_PASS/SMTP_FROM), so isConfigured was always false and alert
    // emails were silently disabled in every environment.
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPassword = process.env.SMTP_PASS
    const smtpFromEmail = process.env.SMTP_FROM || smtpUser

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      logger.warn('Email service not configured - email notifications disabled')
      this.isConfigured = false
      return
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

    this.isConfigured = true
    logger.info('✅ Email notification service initialized')
  }

  /**
   * Send alert notification email
   */
  async sendAlertNotification(notification: EmailNotification): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured, skipping email notification')
      return
    }

    try {
      const htmlContent = this.generateAlertHTML(notification)
      const subject = `${SEVERITY_SUBJECT_PREFIX[notification.severity]} Alert: ${notification.title}`

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: notification.recipientEmail,
        subject,
        html: htmlContent,
      })

      logger.info(`Alert email sent to ${notification.recipientEmail} for alert ${notification.alertId}`)
    } catch (error) {
      logger.error('Failed to send alert email:', error)
      throw error
    }
  }

  /**
   * Send batch alert notifications
   */
  async sendBatchAlertNotifications(notifications: EmailNotification[]): Promise<void> {
    const results = await Promise.allSettled(
      notifications.map((notification) => this.sendAlertNotification(notification))
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      logger.warn(`Failed to send ${failed} of ${notifications.length} alert emails`)
    }
  }

  /**
   * Generate HTML email template for alert
   */
  private generateAlertHTML(notification: EmailNotification): string {
    const color = SEVERITY_COLORS[notification.severity]
    const dashboardLink = notification.dashboardLink || `${process.env.ADMIN_DASHBOARD_URL}/dashboard/alerts`

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background-color: ${color}; padding: 24px; color: white; }
            .header h2 { margin: 0; font-size: 24px; }
            .header p { margin: 8px 0 0 0; opacity: 0.9; }
            .content { padding: 24px; }
            .metric { background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 12px 0; }
            .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
            .metric-value { font-size: 28px; font-weight: bold; color: ${color}; margin-top: 8px; }
            .info { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0; }
            .footer { background-color: #f9fafb; padding: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; }
            .button { display: inline-block; background-color: ${color}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${notification.title}</h2>
              <p>${notification.severity.toUpperCase()} SEVERITY</p>
            </div>
            
            <div class="content">
              <p>${notification.message}</p>
              
              <div class="metric">
                <div class="metric-label">Current Value</div>
                <div class="metric-value">${notification.currentValue}</div>
              </div>
              
              <div class="metric">
                <div class="metric-label">Threshold</div>
                <div class="metric-value">${notification.thresholdValue}</div>
              </div>
              
              <div class="info">
                <strong>Alert Type:</strong> ${notification.alertType.replace(/_/g, ' ').toUpperCase()}<br>
                <strong>Triggered:</strong> ${new Date(notification.triggeredAt).toLocaleString()}
              </div>
              
              <a href="${dashboardLink}" class="button">View in Dashboard</a>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated alert notification. Please do not reply to this email.
              </p>
            </div>
            
            <div class="footer">
              <p>TechTools E-Commerce Platform | Alert Notification</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false

    try {
      await this.transporter.verify()
      logger.info('✅ SMTP connection verified')
      return true
    } catch (error) {
      logger.error('SMTP connection failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService()
