/**
 * ANALYTICS ROUTES
 * Real analytics endpoints registration
 */

import { Router } from 'express';
import {
  getRevenueTrend,
  getConversionFunnel,
  getTopProducts,
  getSearchMetrics,
  getRefundRate,
  getReturnRate,
  getCheckoutAbandonment,
  batchInsertEvents,
  getLiveVisitors,
  getVisitorsByCountry,
  getChannelBreakdown,
} from './analytics.controller';
import { authenticate, authorize } from '../../../middleware/auth';

const router = Router();

/**
 * Public analytics endpoints (for mobile/web clients)
 */
router.post('/events/batch', batchInsertEvents);

/**
 * Protected admin analytics endpoints
 */
router.get(
  '/revenue-trend',
  authenticate,
  authorize('admin', 'super_admin'),
  getRevenueTrend
);

router.get(
  '/conversion-funnel',
  authenticate,
  authorize('admin', 'super_admin'),
  getConversionFunnel
);

router.get(
  '/top-products',
  authenticate,
  authorize('admin', 'super_admin'),
  getTopProducts
);

router.get(
  '/search-metrics',
  authenticate,
  authorize('admin', 'super_admin'),
  getSearchMetrics
);

router.get(
  '/refund-rate',
  authenticate,
  authorize('admin', 'super_admin'),
  getRefundRate
);

router.get(
  '/return-rate',
  authenticate,
  authorize('admin', 'super_admin'),
  getReturnRate
);

router.get(
  '/checkout-abandonment',
  authenticate,
  authorize('admin', 'super_admin'),
  getCheckoutAbandonment
);

router.get(
  '/visitors/live',
  authenticate,
  authorize('admin', 'super_admin'),
  getLiveVisitors
);

router.get(
  '/visitors/by-country',
  authenticate,
  authorize('admin', 'super_admin'),
  getVisitorsByCountry
);

router.get(
  '/channels',
  authenticate,
  authorize('admin', 'super_admin'),
  getChannelBreakdown
);

export default router;
