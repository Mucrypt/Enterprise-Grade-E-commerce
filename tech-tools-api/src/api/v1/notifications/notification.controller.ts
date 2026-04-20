import { Request, Response } from 'express'
import { query as dbQuery } from '../../../database/connection'
import NotificationService from '../../../services/notification.service'
import logger from '../../../utils/logger'

export interface AuthRequest extends Request {
  user?: { id: string; userType?: string }
}

// =====================================================
// GET USER NOTIFICATIONS
// =====================================================
export const getUserNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { limit = 50, offset = 0, unreadOnly = false } = req.query

    const notifications = await NotificationService.getUserNotifications(
      userId,
      {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        unreadOnly: unreadOnly === 'true',
      },
    )

    const unreadCount = await NotificationService.getUnreadCount(userId, false)

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    })
  } catch (error) {
    logger.error('Get user notifications error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    })
  }
}

// =====================================================
// GET ADMIN NOTIFICATIONS
// =====================================================
export const getAdminNotifications = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const adminId = req.user?.id
    if (
      !adminId ||
      !['admin', 'super_admin'].includes(req.user?.userType || '')
    ) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { limit = 50, offset = 0, unreadOnly = false, type } = req.query

    let query = `
      SELECT * FROM admin_notifications 
      WHERE admin_id = $1 AND is_archived = FALSE
    `
    const params: any[] = [adminId]

    if (unreadOnly === 'true') {
      query += ` AND is_read = FALSE`
    }

    if (type && type !== 'all') {
      query += ` AND notification_type = $${params.length + 1}`
      params.push(type)
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`
    params.push(parseInt(limit as string), parseInt(offset as string))

    const result = await dbQuery(query, params)

    const unreadCount = await NotificationService.getUnreadCount(adminId, true)

    const notifications = result.rows.map((row) => {
      const data =
        typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {}

      return {
        ...row,
        data,
        actionUrl: data.actionUrl,
        actionLabel: data.actionLabel,
      }
    })

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    })
  } catch (error) {
    logger.error('Get admin notifications error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    })
  }
}

// =====================================================
// GET UNREAD COUNT
// =====================================================
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const isAdmin = ['admin', 'super_admin'].includes(req.user?.userType || '')
    const count = await NotificationService.getUnreadCount(userId, isAdmin)

    res.json({
      success: true,
      data: { unreadCount: count },
    })
  } catch (error) {
    logger.error('Get unread count error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count',
    })
  }
}

// =====================================================
// MARK NOTIFICATION AS READ
// =====================================================
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await NotificationService.markAsRead(id, false)

    res.json({
      success: true,
      message: 'Notification marked as read',
    })
  } catch (error) {
    logger.error('Mark as read error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    })
  }
}

// =====================================================
// MARK ALL NOTIFICATIONS AS READ
// =====================================================
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const isAdmin = ['admin', 'super_admin'].includes(req.user?.userType || '')
    await NotificationService.markAllAsRead(userId, isAdmin)

    res.json({
      success: true,
      message: 'All notifications marked as read',
    })
  } catch (error) {
    logger.error('Mark all as read error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    })
  }
}

// =====================================================
// ARCHIVE NOTIFICATION
// =====================================================
export const archiveNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await NotificationService.archive(id, false)

    res.json({
      success: true,
      message: 'Notification archived',
    })
  } catch (error) {
    logger.error('Archive notification error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to archive notification',
    })
  }
}

// =====================================================
// DELETE NOTIFICATION
// =====================================================
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await NotificationService.delete(id, false)

    res.json({
      success: true,
      message: 'Notification deleted',
    })
  } catch (error) {
    logger.error('Delete notification error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    })
  }
}

// =====================================================
// ADMIN: MARK ADMIN NOTIFICATION AS READ
// =====================================================
export const markAdminNotificationAsRead = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params

    await NotificationService.markAsRead(id, true)

    res.json({
      success: true,
      message: 'Notification marked as read',
    })
  } catch (error) {
    logger.error('Mark admin notification as read error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    })
  }
}

// =====================================================
// ADMIN: DELETE ADMIN NOTIFICATION
// =====================================================
export const deleteAdminNotification = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params

    await NotificationService.delete(id, true)

    res.json({
      success: true,
      message: 'Notification deleted',
    })
  } catch (error) {
    logger.error('Delete admin notification error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    })
  }
}
