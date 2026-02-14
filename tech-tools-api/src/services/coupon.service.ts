/**
 * Coupon Service
 * Business logic for coupon and promotion management
 */

import { query } from '../database/connection'
import logger from '../utils/logger'

// Types
export interface Coupon {
  id: string
  code: string
  name: string
  description?: string
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y'
  discount_value: number
  max_discount_amount?: number
  usage_limit?: number
  usage_count: number
  usage_limit_per_user: number
  starts_at?: string
  expires_at?: string
  min_purchase_amount?: number
  min_items_count?: number
  is_first_order_only: boolean
  is_single_use: boolean
  is_stackable: boolean
  applies_to:
    | 'all'
    | 'categories'
    | 'products'
    | 'brands'
    | 'collections'
    | 'user_segments'
  target_ids?: string[]
  excluded_product_ids?: string[]
  excluded_category_ids?: string[]
  buy_quantity?: number
  get_quantity?: number
  get_discount_percent?: number
  status: 'active' | 'inactive' | 'expired' | 'scheduled'
  is_active: boolean
  total_discount_given: number
  total_orders_used: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CouponCreateInput {
  code: string
  name: string
  description?: string
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y'
  discountValue: number
  maxDiscountAmount?: number
  usageLimit?: number
  usageLimitPerUser?: number
  startsAt?: string
  expiresAt?: string
  minPurchaseAmount?: number
  minItemsCount?: number
  isFirstOrderOnly?: boolean
  isSingleUse?: boolean
  isStackable?: boolean
  appliesTo?: string
  targetIds?: string[]
  excludedProductIds?: string[]
  excludedCategoryIds?: string[]
  buyQuantity?: number
  getQuantity?: number
  getDiscountPercent?: number
  isActive?: boolean
  createdBy?: string
}

export interface CouponUpdateInput {
  name?: string
  description?: string
  discountValue?: number
  maxDiscountAmount?: number
  usageLimit?: number
  usageLimitPerUser?: number
  startsAt?: string
  expiresAt?: string
  minPurchaseAmount?: number
  minItemsCount?: number
  isFirstOrderOnly?: boolean
  isSingleUse?: boolean
  isStackable?: boolean
  appliesTo?: string
  targetIds?: string[]
  excludedProductIds?: string[]
  excludedCategoryIds?: string[]
  buyQuantity?: number
  getQuantity?: number
  getDiscountPercent?: number
  isActive?: boolean
  status?: string
}

export interface CouponValidationResult {
  valid: boolean
  coupon?: Coupon
  error?: string
  discount?: number
  discountType?: string
}

export interface CouponUsage {
  id: string
  coupon_id: string
  user_id?: string
  order_id?: string
  discount_applied: number
  order_total?: number
  used_at: string
  ip_address?: string
  coupon_code?: string
  coupon_name?: string
  user_email?: string
  order_number?: string
}

export interface CouponFilters {
  search?: string
  status?: string
  discountType?: string
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CouponStats {
  totalCoupons: number
  activeCoupons: number
  expiredCoupons: number
  totalDiscountGiven: number
  mostUsedCoupon?: { code: string; usage_count: number }
  averageDiscountPerOrder: number
}

class CouponService {
  /**
   * Get all coupons with filters
   */
  async getCoupons(
    filters: CouponFilters = {},
  ): Promise<{ coupons: Coupon[]; total: number }> {
    const {
      search,
      status,
      discountType,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filters

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (search) {
      conditions.push(
        `(code ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`,
      )
      params.push(`%${search}%`)
      paramIndex++
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (discountType) {
      conditions.push(`discount_type = $${paramIndex}`)
      params.push(discountType)
      paramIndex++
    }

    if (typeof isActive === 'boolean') {
      conditions.push(`is_active = $${paramIndex}`)
      params.push(isActive)
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const allowedSortColumns = [
      'created_at',
      'code',
      'name',
      'usage_count',
      'discount_value',
      'expires_at',
    ]
    const sortColumn = allowedSortColumns.includes(sortBy)
      ? sortBy
      : 'created_at'
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

    const offset = (page - 1) * limit

    const countResult = await query(
      `SELECT COUNT(*) FROM coupons ${whereClause}`,
      params,
    )

    const result = await query(
      `SELECT * FROM coupons 
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    )

    return {
      coupons: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    }
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(id: string): Promise<Coupon | null> {
    const result = await query('SELECT * FROM coupons WHERE id = $1', [id])
    return result.rows[0] || null
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    const result = await query(
      'SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)',
      [code],
    )
    return result.rows[0] || null
  }

  /**
   * Create a new coupon
   */
  async createCoupon(input: CouponCreateInput): Promise<Coupon> {
    const result = await query(
      `INSERT INTO coupons (
        code, name, description, discount_type, discount_value,
        max_discount_amount, usage_limit, usage_limit_per_user,
        starts_at, expires_at, min_purchase_amount, min_items_count,
        is_first_order_only, is_single_use, is_stackable,
        applies_to, target_ids, excluded_product_ids, excluded_category_ids,
        buy_quantity, get_quantity, get_discount_percent,
        is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        input.code.toUpperCase(),
        input.name,
        input.description,
        input.discountType,
        input.discountValue,
        input.maxDiscountAmount,
        input.usageLimit,
        input.usageLimitPerUser ?? 1,
        input.startsAt,
        input.expiresAt,
        input.minPurchaseAmount,
        input.minItemsCount,
        input.isFirstOrderOnly ?? false,
        input.isSingleUse ?? false,
        input.isStackable ?? false,
        input.appliesTo ?? 'all',
        input.targetIds,
        input.excludedProductIds,
        input.excludedCategoryIds,
        input.buyQuantity,
        input.getQuantity,
        input.getDiscountPercent,
        input.isActive ?? true,
        input.createdBy,
      ],
    )

    logger.info(`Coupon created: ${input.code}`)
    return result.rows[0]
  }

  /**
   * Update a coupon
   */
  async updateCoupon(
    id: string,
    input: CouponUpdateInput,
  ): Promise<Coupon | null> {
    const updates: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      discountValue: 'discount_value',
      maxDiscountAmount: 'max_discount_amount',
      usageLimit: 'usage_limit',
      usageLimitPerUser: 'usage_limit_per_user',
      startsAt: 'starts_at',
      expiresAt: 'expires_at',
      minPurchaseAmount: 'min_purchase_amount',
      minItemsCount: 'min_items_count',
      isFirstOrderOnly: 'is_first_order_only',
      isSingleUse: 'is_single_use',
      isStackable: 'is_stackable',
      appliesTo: 'applies_to',
      targetIds: 'target_ids',
      excludedProductIds: 'excluded_product_ids',
      excludedCategoryIds: 'excluded_category_ids',
      buyQuantity: 'buy_quantity',
      getQuantity: 'get_quantity',
      getDiscountPercent: 'get_discount_percent',
      isActive: 'is_active',
      status: 'status',
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      if (input[key as keyof CouponUpdateInput] !== undefined) {
        updates.push(`${column} = $${paramIndex}`)
        params.push(input[key as keyof CouponUpdateInput])
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return this.getCouponById(id)
    }

    updates.push('updated_at = NOW()')
    params.push(id)

    const result = await query(
      `UPDATE coupons SET ${updates.join(
        ', ',
      )} WHERE id = $${paramIndex} RETURNING *`,
      params,
    )

    return result.rows[0] || null
  }

  /**
   * Delete a coupon
   */
  async deleteCoupon(id: string): Promise<boolean> {
    const result = await query('DELETE FROM coupons WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Validate a coupon code
   */
  async validateCoupon(
    code: string,
    userId?: string,
    cartTotal?: number,
    itemCount?: number,
    productIds?: string[],
    categoryIds?: string[],
  ): Promise<CouponValidationResult> {
    const coupon = await this.getCouponByCode(code)

    if (!coupon) {
      return { valid: false, error: 'Invalid coupon code' }
    }

    // Check if active
    if (!coupon.is_active || coupon.status !== 'active') {
      return { valid: false, error: 'This coupon is not active' }
    }

    // Check dates
    const now = new Date()
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return { valid: false, error: 'This coupon is not yet valid' }
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return { valid: false, error: 'This coupon has expired' }
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return { valid: false, error: 'This coupon has reached its usage limit' }
    }

    // Check minimum purchase
    if (
      coupon.min_purchase_amount &&
      cartTotal &&
      cartTotal < coupon.min_purchase_amount
    ) {
      return {
        valid: false,
        error: `Minimum purchase amount is $${coupon.min_purchase_amount}`,
      }
    }

    // Check minimum items
    if (
      coupon.min_items_count &&
      itemCount &&
      itemCount < coupon.min_items_count
    ) {
      return {
        valid: false,
        error: `Minimum ${coupon.min_items_count} items required`,
      }
    }

    // Check per-user limit
    if (userId && coupon.usage_limit_per_user) {
      const userUsage = await query(
        'SELECT COUNT(*) FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2',
        [coupon.id, userId],
      )
      if (
        parseInt(userUsage.rows[0].count, 10) >= coupon.usage_limit_per_user
      ) {
        return { valid: false, error: 'You have already used this coupon' }
      }
    }

    // Check first order only
    if (coupon.is_first_order_only && userId) {
      const orderCount = await query(
        'SELECT COUNT(*) FROM orders WHERE user_id = $1',
        [userId],
      )
      if (parseInt(orderCount.rows[0].count, 10) > 0) {
        return {
          valid: false,
          error: 'This coupon is for first-time orders only',
        }
      }
    }

    // Check product/category restrictions
    if (coupon.applies_to !== 'all' && coupon.target_ids?.length) {
      if (coupon.applies_to === 'products' && productIds) {
        const hasValidProduct = productIds.some((id) =>
          coupon.target_ids?.includes(id),
        )
        if (!hasValidProduct) {
          return {
            valid: false,
            error: 'This coupon does not apply to items in your cart',
          }
        }
      }
      if (coupon.applies_to === 'categories' && categoryIds) {
        const hasValidCategory = categoryIds.some((id) =>
          coupon.target_ids?.includes(id),
        )
        if (!hasValidCategory) {
          return {
            valid: false,
            error: 'This coupon does not apply to items in your cart',
          }
        }
      }
    }

    // Check excluded products/categories
    if (coupon.excluded_product_ids?.length && productIds) {
      const allExcluded = productIds.every((id) =>
        coupon.excluded_product_ids?.includes(id),
      )
      if (allExcluded) {
        return {
          valid: false,
          error: 'This coupon does not apply to items in your cart',
        }
      }
    }

    // Calculate discount
    let discount = 0
    if (cartTotal) {
      if (coupon.discount_type === 'percentage') {
        discount = (cartTotal * coupon.discount_value) / 100
        if (coupon.max_discount_amount) {
          discount = Math.min(discount, coupon.max_discount_amount)
        }
      } else if (coupon.discount_type === 'fixed_amount') {
        discount = coupon.discount_value
      } else if (coupon.discount_type === 'free_shipping') {
        // Handled at checkout
        discount = 0
      }
      discount = Math.round(discount * 100) / 100
    }

    return {
      valid: true,
      coupon,
      discount,
      discountType: coupon.discount_type,
    }
  }

  /**
   * Apply a coupon to an order
   */
  async applyCoupon(
    couponId: string,
    userId: string,
    orderId: string,
    discountApplied: number,
    orderTotal: number,
    ipAddress?: string,
  ): Promise<void> {
    await query(
      `INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_applied, order_total, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [couponId, userId, orderId, discountApplied, orderTotal, ipAddress],
    )
  }

  /**
   * Get coupon usage history
   */
  async getCouponUsage(
    couponId?: string,
    page = 1,
    limit = 20,
  ): Promise<{ usage: CouponUsage[]; total: number }> {
    const offset = (page - 1) * limit
    const params: unknown[] = []
    let paramIndex = 1

    let whereClause = ''
    if (couponId) {
      whereClause = `WHERE cu.coupon_id = $${paramIndex}`
      params.push(couponId)
      paramIndex++
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM coupon_usage cu ${whereClause}`,
      params,
    )

    const result = await query(
      `SELECT cu.*, c.code as coupon_code, c.name as coupon_name,
              u.email as user_email, o.order_number
       FROM coupon_usage cu
       LEFT JOIN coupons c ON cu.coupon_id = c.id
       LEFT JOIN users u ON cu.user_id = u.id
       LEFT JOIN orders o ON cu.order_id = o.id
       ${whereClause}
       ORDER BY cu.used_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    )

    return {
      usage: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    }
  }

  /**
   * Get coupon statistics
   */
  async getCouponStats(): Promise<CouponStats> {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_coupons,
        COUNT(*) FILTER (WHERE is_active = true AND status = 'active') as active_coupons,
        COUNT(*) FILTER (WHERE status = 'expired' OR expires_at < NOW()) as expired_coupons,
        COALESCE(SUM(total_discount_given), 0) as total_discount_given
      FROM coupons
    `)

    const mostUsed = await query(`
      SELECT code, usage_count 
      FROM coupons 
      ORDER BY usage_count DESC 
      LIMIT 1
    `)

    const avgDiscount = await query(`
      SELECT COALESCE(AVG(discount_applied), 0) as avg_discount
      FROM coupon_usage
    `)

    return {
      totalCoupons: parseInt(stats.rows[0].total_coupons, 10),
      activeCoupons: parseInt(stats.rows[0].active_coupons, 10),
      expiredCoupons: parseInt(stats.rows[0].expired_coupons, 10),
      totalDiscountGiven: parseFloat(stats.rows[0].total_discount_given),
      mostUsedCoupon: mostUsed.rows[0] || undefined,
      averageDiscountPerOrder: parseFloat(avgDiscount.rows[0].avg_discount),
    }
  }

  /**
   * Generate unique coupon codes
   */
  async generateCoupons(
    prefix: string,
    count: number,
    template: CouponCreateInput,
  ): Promise<Coupon[]> {
    const coupons: Coupon[] = []

    for (let i = 0; i < count; i++) {
      const randomPart = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()
      const code = `${prefix}${randomPart}`

      try {
        const coupon = await this.createCoupon({
          ...template,
          code,
        })
        coupons.push(coupon)
      } catch (error) {
        logger.warn(`Failed to create coupon ${code}:`, error)
      }
    }

    return coupons
  }

  /**
   * Expire outdated coupons
   */
  async expireOutdatedCoupons(): Promise<number> {
    const result = await query(`
      UPDATE coupons 
      SET status = 'expired', is_active = false, updated_at = NOW()
      WHERE expires_at < NOW() AND status != 'expired'
      RETURNING id
    `)
    return result.rowCount ?? 0
  }
}

export default new CouponService()
