import { Router } from 'express'
import {
  getUserNotifications,
  getAdminNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
  markAdminNotificationAsRead,
  deleteAdminNotification,
} from './notification.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// =====================================================
// USER NOTIFICATION ROUTES
// =====================================================

// Get user notifications
router.get('/', authenticate, getUserNotifications)

// Get unread count
router.get('/unread/count', authenticate, getUnreadCount)

// Mark notification as read
router.put('/:id/read', authenticate, markAsRead)

// Mark all notifications as read
router.put('/read/all', authenticate, markAllAsRead)

// Archive notification
router.put('/:id/archive', authenticate, archiveNotification)

// Delete notification
router.delete('/:id', authenticate, deleteNotification)

// =====================================================
// ADMIN NOTIFICATION ROUTES
// =====================================================

// Get admin notifications
router.get(
  '/admin/list',
  authenticate,
  authorize('admin', 'super_admin'),
  getAdminNotifications,
)

// Mark admin notification as read
router.put(
  '/admin/:id/read',
  authenticate,
  authorize('admin', 'super_admin'),
  markAdminNotificationAsRead,
)

// Delete admin notification
router.delete(
  '/admin/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  deleteAdminNotification,
)

export default router
