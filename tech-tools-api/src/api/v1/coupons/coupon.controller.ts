/**
 * Coupon Controller
 * API endpoints for coupon and promotion management
 */

import { Response, Request } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import couponService from '../../../services/coupon.service'
import logger from '../../../utils/logger'

/**
 * Get all coupons with filters
 */
export const getCoupons = async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      status,
      discountType,
      isActive,
      page = '1',
      limit = '20',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query

    const filters = {
      search: search as string,
      status: status as string,
      discountType: discountType as string,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    }

    const result = await couponService.getCoupons(filters)

    res.json({
      success: true,
      data: result.coupons,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / filters.limit),
      },
    })
  } catch (error) {
    logger.error('Get coupons error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get coupons',
    })
  }
}

/**
 * Get coupon by ID
 */
export const getCouponById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const coupon = await couponService.getCouponById(id)

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      })
    }

    res.json({
      success: true,
      data: coupon,
    })
  } catch (error) {
    logger.error('Get coupon error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get coupon',
    })
  }
}

/**
 * Create a new coupon
 */
export const createCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const coupon = await couponService.createCoupon({
      ...req.body,
      createdBy: req.user?.id,
    })

    res.status(201).json({
      success: true,
      data: coupon,
      message: 'Coupon created successfully',
    })
  } catch (error) {
    logger.error('Create coupon error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to create coupon'
    res.status(400).json({
      success: false,
      error: message,
    })
  }
}

/**
 * Update a coupon
 */
export const updateCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const coupon = await couponService.updateCoupon(id, req.body)

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      })
    }

    res.json({
      success: true,
      data: coupon,
      message: 'Coupon updated successfully',
    })
  } catch (error) {
    logger.error('Update coupon error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update coupon',
    })
  }
}

/**
 * Delete a coupon
 */
export const deleteCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const deleted = await couponService.deleteCoupon(id)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      })
    }

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    })
  } catch (error) {
    logger.error('Delete coupon error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete coupon',
    })
  }
}

/**
 * Validate a coupon code (public endpoint)
 */
export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, cartTotal, itemCount, productIds, categoryIds } = req.body
    const userId = (req as AuthRequest).user?.id

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code is required',
      })
    }

    const result = await couponService.validateCoupon(
      code,
      userId,
      cartTotal,
      itemCount,
      productIds,
      categoryIds,
    )

    res.json({
      success: result.valid,
      data: result.valid
        ? {
            discount: result.discount,
            discountType: result.discountType,
            coupon: {
              code: result.coupon?.code,
              name: result.coupon?.name,
              description: result.coupon?.description,
            },
          }
        : null,
      error: result.error,
    })
  } catch (error) {
    logger.error('Validate coupon error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to validate coupon',
    })
  }
}

/**
 * Apply a coupon to an order
 */
export const applyCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const { couponId, orderId, discountApplied, orderTotal } = req.body
    const userId = req.user?.id

    if (!userId || !couponId || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      })
    }

    await couponService.applyCoupon(
      couponId,
      userId,
      orderId,
      discountApplied,
      orderTotal,
      req.ip,
    )

    res.json({
      success: true,
      message: 'Coupon applied successfully',
    })
  } catch (error) {
    logger.error('Apply coupon error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to apply coupon',
    })
  }
}

/**
 * Get coupon usage history
 */
export const getCouponUsage = async (req: AuthRequest, res: Response) => {
  try {
    const { couponId } = req.params
    const { page = '1', limit = '20' } = req.query

    const result = await couponService.getCouponUsage(
      couponId,
      parseInt(page as string, 10),
      parseInt(limit as string, 10),
    )

    res.json({
      success: true,
      data: result.usage,
      pagination: {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit as string, 10)),
      },
    })
  } catch (error) {
    logger.error('Get coupon usage error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get coupon usage',
    })
  }
}

/**
 * Get coupon statistics
 */
export const getCouponStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await couponService.getCouponStats()

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error('Get coupon stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get coupon statistics',
    })
  }
}

/**
 * Generate bulk coupons
 */
export const generateCoupons = async (req: AuthRequest, res: Response) => {
  try {
    const { prefix, count, template } = req.body

    if (!prefix || !count || !template) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: prefix, count, template',
      })
    }

    if (count > 100) {
      return res.status(400).json({
        success: false,
        error: 'Cannot generate more than 100 coupons at once',
      })
    }

    const coupons = await couponService.generateCoupons(prefix, count, {
      ...template,
      createdBy: req.user?.id,
    })

    res.status(201).json({
      success: true,
      data: coupons,
      message: `Generated ${coupons.length} coupons`,
    })
  } catch (error) {
    logger.error('Generate coupons error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate coupons',
    })
  }
}

/**
 * Toggle coupon active status
 */
export const toggleCouponStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const coupon = await couponService.getCouponById(id)

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      })
    }

    const updated = await couponService.updateCoupon(id, {
      isActive: !coupon.is_active,
    })

    res.json({
      success: true,
      data: updated,
      message: `Coupon ${updated?.is_active ? 'activated' : 'deactivated'}`,
    })
  } catch (error) {
    logger.error('Toggle coupon status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to toggle coupon status',
    })
  }
}
