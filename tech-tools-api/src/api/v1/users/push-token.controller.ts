import { Response } from 'express'
import { query as dbQuery } from '../../../database/connection'
import { AuthRequest } from '../../../middleware/auth'
import logger from '../../../utils/logger'

/**
 * POST /users/push-token
 * Real Expo push-token registration -- the mobile app has always called
 * this exact path (tech-tools-mobile-app's MobileNotificationService),
 * it just never existed on the backend, so every device silently failed
 * to register. Upsert on (user_id, device_id): re-registering the same
 * device (e.g. after a token refresh) updates the token in place rather
 * than accumulating duplicate rows.
 */
export const registerPushToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { pushToken, deviceId, platform } = req.body

    if (!pushToken || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'pushToken and deviceId are required',
      })
    }

    await dbQuery(
      `INSERT INTO user_devices (user_id, device_id, push_token, platform, last_active_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET push_token = $3, platform = COALESCE($4, user_devices.platform), last_active_at = CURRENT_TIMESTAMP`,
      [userId, deviceId, pushToken, platform || null],
    )

    res.json({ success: true, message: 'Push token registered' })
  } catch (error: any) {
    logger.error('Error registering push token:', error)
    res.status(500).json({ success: false, message: 'Failed to register push token', error: error.message })
  }
}

/**
 * DELETE /users/push-token
 * Called on sign-out so a logged-out device stops receiving pushes meant
 * for the account that just signed out of it.
 */
export const unregisterPushToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { deviceId } = req.body

    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'deviceId is required' })
    }

    await dbQuery('DELETE FROM user_devices WHERE user_id = $1 AND device_id = $2', [userId, deviceId])

    res.json({ success: true, message: 'Push token unregistered' })
  } catch (error: any) {
    logger.error('Error unregistering push token:', error)
    res.status(500).json({ success: false, message: 'Failed to unregister push token', error: error.message })
  }
}


//
