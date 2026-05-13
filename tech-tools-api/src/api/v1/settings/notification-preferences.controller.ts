/**
 * NOTIFICATION PREFERENCES CONTROLLER
 * Manages admin notification settings
 */

import { query } from '../../../database/connection'
import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import logger from '../../../utils/logger'

interface NotificationPreference {
  emailEnabled: boolean
  emailAddress?: string
  slackEnabled: boolean
  slackChannel?: string
  smsEnabled: boolean
  phoneNumber?: string
  severityThreshold: 'critical' | 'high' | 'medium' | 'low'
}

/**
 * Get notification preferences for current admin
 */
export const getNotificationPreferences = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.user?.id

    if (!adminId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

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
      res.json({
        adminId,
        emailEnabled: true,
        slackEnabled: false,
        smsEnabled: false,
        severityThreshold: 'high',
      })
      return
    }

    const row = result.rows[0]

    res.json({
      adminId: row.admin_id,
      emailEnabled: row.email_enabled,
      emailAddress: row.email_address,
      slackEnabled: row.slack_enabled,
      slackChannel: row.slack_channel,
      smsEnabled: row.sms_enabled,
      phoneNumber: row.phone_number,
      severityThreshold: row.severity_threshold,
    })
  } catch (error) {
    logger.error('Error fetching notification preferences:', error)
    res.status(500).json({ error: 'Failed to fetch notification preferences' })
  }
}

/**
 * Update notification preferences for current admin
 */
export const updateNotificationPreferences = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.user?.id

    if (!adminId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const {
      emailEnabled,
      emailAddress,
      slackEnabled,
      slackChannel,
      smsEnabled,
      phoneNumber,
      severityThreshold,
    } = req.body as Partial<NotificationPreference>

    // Validation
    if (emailEnabled && !emailAddress) {
      res.status(400).json({ error: 'Email address required when email notifications are enabled' })
      return
    }

    if (slackEnabled && !slackChannel) {
      res.status(400).json({ error: 'Slack channel required when Slack notifications are enabled' })
      return
    }

    if (smsEnabled && !phoneNumber) {
      res.status(400).json({ error: 'Phone number required when SMS notifications are enabled' })
      return
    }

    // Check if record exists
    const checkQuery = `
      SELECT id FROM admin_notification_preferences WHERE admin_id = $1;
    `

    const checkResult = await query(checkQuery, [adminId])

    if (checkResult.rows.length === 0) {
      // Insert new record
      const insertQuery = `
        INSERT INTO admin_notification_preferences (
          admin_id, email_enabled, email_address,
          slack_enabled, slack_channel,
          sms_enabled, phone_number, severity_threshold
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          admin_id, email_enabled, email_address,
          slack_enabled, slack_channel,
          sms_enabled, phone_number, severity_threshold;
      `

      const result = await query(insertQuery, [
        adminId,
        emailEnabled ?? true,
        emailAddress,
        slackEnabled ?? false,
        slackChannel,
        smsEnabled ?? false,
        phoneNumber,
        severityThreshold ?? 'high',
      ])

      const row = result.rows[0]

      logger.info(`Notification preferences created for admin ${adminId}`)

      res.json({
        adminId: row.admin_id,
        emailEnabled: row.email_enabled,
        emailAddress: row.email_address,
        slackEnabled: row.slack_enabled,
        slackChannel: row.slack_channel,
        smsEnabled: row.sms_enabled,
        phoneNumber: row.phone_number,
        severityThreshold: row.severity_threshold,
      })
    } else {
      // Update existing record
      const updateQuery = `
        UPDATE admin_notification_preferences
        SET
          email_enabled = $2,
          email_address = $3,
          slack_enabled = $4,
          slack_channel = $5,
          sms_enabled = $6,
          phone_number = $7,
          severity_threshold = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE admin_id = $1
        RETURNING
          admin_id, email_enabled, email_address,
          slack_enabled, slack_channel,
          sms_enabled, phone_number, severity_threshold;
      `

      const result = await query(updateQuery, [
        adminId,
        emailEnabled ?? true,
        emailAddress,
        slackEnabled ?? false,
        slackChannel,
        smsEnabled ?? false,
        phoneNumber,
        severityThreshold ?? 'high',
      ])

      const row = result.rows[0]

      logger.info(`Notification preferences updated for admin ${adminId}`)

      res.json({
        adminId: row.admin_id,
        emailEnabled: row.email_enabled,
        emailAddress: row.email_address,
        slackEnabled: row.slack_enabled,
        slackChannel: row.slack_channel,
        smsEnabled: row.sms_enabled,
        phoneNumber: row.phone_number,
        severityThreshold: row.severity_threshold,
      })
    }
  } catch (error) {
    logger.error('Error updating notification preferences:', error)
    res.status(500).json({ error: 'Failed to update notification preferences' })
  }
}
