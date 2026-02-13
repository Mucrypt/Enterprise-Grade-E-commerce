import { Router } from 'express'
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderItems,
  getAdminOrders,
  getAdminOrderById,
  getOrderStats,
  adminUpdateOrderStatus,
  bulkUpdateOrderStatus,
  updateOrderShipping,
  exportOrders,
} from './order.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// All order routes require authentication
router.use(authenticate)

// Admin routes (must be before :id routes)
router.get('/admin/list', authorize('admin', 'super_admin'), getAdminOrders)
router.get('/admin/stats', authorize('admin', 'super_admin'), getOrderStats)
router.get('/admin/export', authorize('admin', 'super_admin'), exportOrders)
router.put(
  '/admin/bulk-status',
  authorize('admin', 'super_admin'),
  bulkUpdateOrderStatus,
)
router.get('/admin/:id', authorize('admin', 'super_admin'), getAdminOrderById)
router.put(
  '/admin/:id/status',
  authorize('admin', 'super_admin'),
  adminUpdateOrderStatus,
)
router.put(
  '/admin/:id/shipping',
  authorize('admin', 'super_admin'),
  updateOrderShipping,
)

// Customer routes
router.get('/', getOrders)
router.get('/:id', getOrderById)
router.post('/', createOrder)
router.put('/:id/cancel', cancelOrder)

// Legacy admin route for backward compatibility
router.put('/:id/status', authorize('admin', 'super_admin'), updateOrderStatus)
router.get('/:id/items', getOrderItems)

export default router
