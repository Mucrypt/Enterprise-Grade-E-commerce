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
  createGuestOrder,
  getGuestOrder,
  createOrderCheckoutSession,
  createGuestOrderCheckoutSession,
  trackOrderByNumber,
} from './order.controller'
import { authenticate, authorize } from '../../../middleware/auth'
import { requirePermissionOrLegacyRole } from '../../../middleware/staff'

const router = Router()

// Guest checkout routes (NO authentication required)
router.post('/guest/checkout-session', createGuestOrderCheckoutSession)
router.post('/guest/create', createGuestOrder)
router.get('/guest/retrieve', getGuestOrder)

// Public order tracking by order number + email (NO authentication required)
router.get('/track', trackOrderByNumber)

// All other order routes require authentication
router.use(authenticate)

// Admin routes (must be before :id routes). Each now accepts EITHER a
// legacy admin/super_admin OR a staff member holding the matching
// permission (e.g. MARKET_MANAGER + orders.view/orders.manage) --
// requirePermissionOrLegacyRole leaves legacy behavior completely
// unchanged (see its doc comment in middleware/staff.ts) and is the same
// pattern staff.routes.ts already uses. Market-scope filtering and the
// :id-route IDOR guard happen inside the controllers themselves (see
// assertOrderInScope/applyMarketScope in order.controller.ts), not here.
router.get(
  '/admin/list',
  requirePermissionOrLegacyRole('orders.view', 'admin', 'super_admin'),
  getAdminOrders,
)
router.get(
  '/admin/stats',
  requirePermissionOrLegacyRole('orders.view', 'admin', 'super_admin'),
  getOrderStats,
)
router.get(
  '/admin/export',
  requirePermissionOrLegacyRole('orders.view', 'admin', 'super_admin'),
  exportOrders,
)
router.put(
  '/admin/bulk-status',
  requirePermissionOrLegacyRole('orders.manage', 'admin', 'super_admin'),
  bulkUpdateOrderStatus,
)
router.get(
  '/admin/:id',
  requirePermissionOrLegacyRole('orders.view', 'admin', 'super_admin'),
  getAdminOrderById,
)
router.put(
  '/admin/:id/status',
  requirePermissionOrLegacyRole('orders.manage', 'admin', 'super_admin'),
  adminUpdateOrderStatus,
)
router.put(
  '/admin/:id/shipping',
  requirePermissionOrLegacyRole('orders.manage', 'admin', 'super_admin'),
  updateOrderShipping,
)

// Customer routes
router.get('/', getOrders)
router.get('/:id', getOrderById)
router.post('/checkout-session', createOrderCheckoutSession)
router.post('/', createOrder)
router.put('/:id/cancel', cancelOrder)

// Legacy admin route for backward compatibility
router.put('/:id/status', authorize('admin', 'super_admin'), updateOrderStatus)
router.get('/:id/items', getOrderItems)

export default router
