import { Router } from 'express';
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderItems,
} from './order.controller'
import { authenticate, authorize } from '../../../middleware/auth';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// Customer routes
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.put('/:id/cancel', cancelOrder);

// Admin routes
router.put('/:id/status', authorize('admin', 'super_admin'), updateOrderStatus);
router.get('/:id/items', getOrderItems);

export default router;