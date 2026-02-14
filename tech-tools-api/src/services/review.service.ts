/**
 * Review Service
 * Business logic for product reviews and ratings
 */

import { query } from '../database/connection'
import logger from '../utils/logger'

// Types
export interface Review {
  id: string
  product_id: string
  user_id: string
  order_item_id?: string
  rating: number
  title?: string
  comment?: string
  is_verified_purchase: boolean
  is_approved: boolean
  helpful_count: number
  images_count: number
  admin_response?: string
  response_at?: string
  is_featured: boolean
  status: 'pending' | 'approved' | 'rejected' | 'flagged'
  reported_count: number
  created_at: string
  updated_at: string
  // Joined fields
  product_name?: string
  product_slug?: string
  product_image?: string
  user_name?: string
  user_email?: string
  images?: ReviewImage[]
}

export interface ReviewImage {
  id: string
  review_id: string
  image_url: string
  thumbnail_url?: string
  alt_text?: string
  sort_order: number
  created_at: string
}

export interface ReviewSummary {
  product_id: string
  total_reviews: number
  average_rating: number
  rating_1_count: number
  rating_2_count: number
  rating_3_count: number
  rating_4_count: number
  rating_5_count: number
  verified_purchase_count: number
  with_images_count: number
  updated_at: string
}

export interface ReviewCreateInput {
  productId: string
  userId: string
  orderItemId?: string
  rating: number
  title?: string
  comment?: string
  isVerifiedPurchase?: boolean
  images?: { url: string; thumbnailUrl?: string; altText?: string }[]
}

export interface ReviewUpdateInput {
  rating?: number
  title?: string
  comment?: string
  isApproved?: boolean
  isFeatured?: boolean
  status?: string
  adminResponse?: string
}

export interface ReviewFilters {
  productId?: string
  userId?: string
  rating?: number
  status?: string
  isVerifiedPurchase?: boolean
  isFeatured?: boolean
  hasImages?: boolean
  search?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ReviewStats {
  totalReviews: number
  pendingReviews: number
  approvedReviews: number
  rejectedReviews: number
  flaggedReviews: number
  averageRating: number
  reviewsWithImages: number
  verifiedPurchaseReviews: number
  ratingDistribution: {
    rating: number
    count: number
    percentage: number
  }[]
}

class ReviewService {
  /**
   * Get all reviews with filters
   */
  async getReviews(
    filters: ReviewFilters = {},
  ): Promise<{ reviews: Review[]; total: number }> {
    const {
      productId,
      userId,
      rating,
      status,
      isVerifiedPurchase,
      isFeatured,
      hasImages,
      search,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filters

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (productId) {
      conditions.push(`r.product_id = $${paramIndex}`)
      params.push(productId)
      paramIndex++
    }

    if (userId) {
      conditions.push(`r.user_id = $${paramIndex}`)
      params.push(userId)
      paramIndex++
    }

    if (rating) {
      conditions.push(`r.rating = $${paramIndex}`)
      params.push(rating)
      paramIndex++
    }

    if (status) {
      conditions.push(`r.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (typeof isVerifiedPurchase === 'boolean') {
      conditions.push(`r.is_verified_purchase = $${paramIndex}`)
      params.push(isVerifiedPurchase)
      paramIndex++
    }

    if (typeof isFeatured === 'boolean') {
      conditions.push(`r.is_featured = $${paramIndex}`)
      params.push(isFeatured)
      paramIndex++
    }

    if (hasImages) {
      conditions.push('r.images_count > 0')
    }

    if (search) {
      conditions.push(
        `(r.title ILIKE $${paramIndex} OR r.comment ILIKE $${paramIndex})`,
      )
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const allowedSortColumns = [
      'created_at',
      'rating',
      'helpful_count',
      'updated_at',
    ]
    const sortColumn = allowedSortColumns.includes(sortBy)
      ? `r.${sortBy}`
      : 'r.created_at'
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

    const offset = (page - 1) * limit

    const countResult = await query(
      `SELECT COUNT(*) FROM reviews r ${whereClause}`,
      params,
    )

    const result = await query(
      `SELECT r.*, 
              p.name as product_name, p.slug as product_slug,
              (SELECT url FROM media WHERE entity_type = 'product' AND entity_id = p.id AND media_type = 'thumbnail' LIMIT 1) as product_image,
              u.first_name || ' ' || u.last_name as user_name,
              u.email as user_email
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN users u ON r.user_id = u.id
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    )

    return {
      reviews: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    }
  }

  /**
   * Get review by ID
   */
  async getReviewById(id: string): Promise<Review | null> {
    const result = await query(
      `SELECT r.*, 
              p.name as product_name, p.slug as product_slug,
              u.first_name || ' ' || u.last_name as user_name,
              u.email as user_email
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [id],
    )

    if (!result.rows[0]) return null

    // Get images
    const images = await query(
      'SELECT * FROM review_images WHERE review_id = $1 ORDER BY sort_order',
      [id],
    )

    return {
      ...result.rows[0],
      images: images.rows,
    }
  }

  /**
   * Get reviews for a product
   */
  async getProductReviews(
    productId: string,
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    onlyApproved = true,
  ): Promise<{
    reviews: Review[]
    total: number
    summary: ReviewSummary | null
  }> {
    const offset = (page - 1) * limit
    const allowedSortColumns = ['created_at', 'rating', 'helpful_count']
    const sortColumn = allowedSortColumns.includes(sortBy)
      ? sortBy
      : 'created_at'

    const statusCondition = onlyApproved ? "AND status = 'approved'" : ''

    const countResult = await query(
      `SELECT COUNT(*) FROM reviews WHERE product_id = $1 ${statusCondition}`,
      [productId],
    )

    const result = await query(
      `SELECT r.*, 
              u.first_name || ' ' || u.last_name as user_name
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1 ${statusCondition}
       ORDER BY r.${sortColumn} DESC
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset],
    )

    // Get summary
    const summaryResult = await query(
      'SELECT * FROM product_review_summary WHERE product_id = $1',
      [productId],
    )

    // Get images for reviews
    const reviewIds = result.rows.map((r: Review) => r.id)
    let imageMap: Map<string, ReviewImage[]> = new Map()

    if (reviewIds.length > 0) {
      const imagesResult = await query(
        'SELECT * FROM review_images WHERE review_id = ANY($1) ORDER BY sort_order',
        [reviewIds],
      )
      imageMap = imagesResult.rows.reduce(
        (acc: Map<string, ReviewImage[]>, img: ReviewImage) => {
          if (!acc.has(img.review_id)) {
            acc.set(img.review_id, [])
          }
          acc.get(img.review_id)!.push(img)
          return acc
        },
        new Map(),
      )
    }

    const reviewsWithImages = result.rows.map((r: Review) => ({
      ...r,
      images: imageMap.get(r.id) || [],
    }))

    return {
      reviews: reviewsWithImages,
      total: parseInt(countResult.rows[0].count, 10),
      summary: summaryResult.rows[0] || null,
    }
  }

  /**
   * Create a new review
   */
  async createReview(input: ReviewCreateInput): Promise<Review> {
    // Check if user already reviewed this product
    const existingReview = await query(
      'SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2',
      [input.productId, input.userId],
    )

    if (existingReview.rows.length > 0) {
      throw new Error('You have already reviewed this product')
    }

    // Check if verified purchase
    let isVerified = input.isVerifiedPurchase ?? false
    if (!isVerified && input.orderItemId) {
      const orderCheck = await query(
        `SELECT oi.id FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.id = $1 AND o.user_id = $2 AND o.order_status = 'delivered'`,
        [input.orderItemId, input.userId],
      )
      isVerified = orderCheck.rows.length > 0
    }

    const result = await query(
      `INSERT INTO reviews (
        product_id, user_id, order_item_id, rating, title, comment,
        is_verified_purchase, images_count, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.productId,
        input.userId,
        input.orderItemId,
        input.rating,
        input.title,
        input.comment,
        isVerified,
        input.images?.length || 0,
        'pending', // Reviews start as pending for moderation
      ],
    )

    const review = result.rows[0]

    // Add images if provided
    if (input.images?.length) {
      for (let i = 0; i < input.images.length; i++) {
        await query(
          `INSERT INTO review_images (review_id, image_url, thumbnail_url, alt_text, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            review.id,
            input.images[i].url,
            input.images[i].thumbnailUrl,
            input.images[i].altText,
            i,
          ],
        )
      }
    }

    logger.info(
      `Review created for product ${input.productId} by user ${input.userId}`,
    )
    return review
  }

  /**
   * Update a review
   */
  async updateReview(
    id: string,
    input: ReviewUpdateInput,
  ): Promise<Review | null> {
    const updates: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (input.rating !== undefined) {
      updates.push(`rating = $${paramIndex}`)
      params.push(input.rating)
      paramIndex++
    }

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex}`)
      params.push(input.title)
      paramIndex++
    }

    if (input.comment !== undefined) {
      updates.push(`comment = $${paramIndex}`)
      params.push(input.comment)
      paramIndex++
    }

    if (input.isApproved !== undefined) {
      updates.push(`is_approved = $${paramIndex}`)
      params.push(input.isApproved)
      paramIndex++
    }

    if (input.isFeatured !== undefined) {
      updates.push(`is_featured = $${paramIndex}`)
      params.push(input.isFeatured)
      paramIndex++
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex}`)
      params.push(input.status)
      paramIndex++
    }

    if (input.adminResponse !== undefined) {
      updates.push(`admin_response = $${paramIndex}`)
      params.push(input.adminResponse)
      updates.push('response_at = NOW()')
      paramIndex++
    }

    if (updates.length === 0) {
      return this.getReviewById(id)
    }

    updates.push('updated_at = NOW()')
    params.push(id)

    const result = await query(
      `UPDATE reviews SET ${updates.join(
        ', ',
      )} WHERE id = $${paramIndex} RETURNING *`,
      params,
    )

    return result.rows[0] || null
  }

  /**
   * Delete a review
   */
  async deleteReview(id: string): Promise<boolean> {
    const result = await query('DELETE FROM reviews WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Approve a review
   */
  async approveReview(id: string): Promise<Review | null> {
    return this.updateReview(id, { status: 'approved', isApproved: true })
  }

  /**
   * Reject a review
   */
  async rejectReview(id: string): Promise<Review | null> {
    return this.updateReview(id, { status: 'rejected', isApproved: false })
  }

  /**
   * Flag a review
   */
  async flagReview(id: string): Promise<Review | null> {
    return this.updateReview(id, { status: 'flagged' })
  }

  /**
   * Add admin response to a review
   */
  async addResponse(id: string, response: string): Promise<Review | null> {
    return this.updateReview(id, { adminResponse: response })
  }

  /**
   * Mark review as helpful
   */
  async markHelpful(
    reviewId: string,
    userId: string,
    voteType: 'helpful' | 'not_helpful',
  ): Promise<boolean> {
    try {
      await query(
        `INSERT INTO review_votes (review_id, user_id, vote_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (review_id, user_id, vote_type) DO NOTHING`,
        [reviewId, userId, voteType],
      )

      if (voteType === 'helpful') {
        await query(
          'UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = $1',
          [reviewId],
        )
      }

      return true
    } catch (error) {
      logger.error('Mark helpful error:', error)
      return false
    }
  }

  /**
   * Report a review
   */
  async reportReview(reviewId: string, userId: string): Promise<boolean> {
    try {
      await query(
        `INSERT INTO review_votes (review_id, user_id, vote_type)
         VALUES ($1, $2, 'reported')
         ON CONFLICT (review_id, user_id, vote_type) DO NOTHING`,
        [reviewId, userId],
      )

      await query(
        'UPDATE reviews SET reported_count = reported_count + 1 WHERE id = $1',
        [reviewId],
      )

      // Auto-flag if too many reports
      await query(
        `UPDATE reviews SET status = 'flagged' WHERE id = $1 AND reported_count >= 3`,
        [reviewId],
      )

      return true
    } catch (error) {
      logger.error('Report review error:', error)
      return false
    }
  }

  /**
   * Get review statistics
   */
  async getReviewStats(): Promise<ReviewStats> {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_reviews,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_reviews,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_reviews,
        COUNT(*) FILTER (WHERE status = 'flagged') as flagged_reviews,
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) FILTER (WHERE images_count > 0) as reviews_with_images,
        COUNT(*) FILTER (WHERE is_verified_purchase = true) as verified_purchase_reviews
      FROM reviews
    `)

    const distribution = await query(`
      SELECT rating, COUNT(*) as count
      FROM reviews
      GROUP BY rating
      ORDER BY rating
    `)

    const total = parseInt(stats.rows[0].total_reviews, 10) || 1
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => {
      const found = distribution.rows.find(
        (r: { rating: number }) => r.rating === rating,
      )
      const count = found ? parseInt(found.count, 10) : 0
      return {
        rating,
        count,
        percentage: Math.round((count / total) * 100),
      }
    })

    return {
      totalReviews: parseInt(stats.rows[0].total_reviews, 10),
      pendingReviews: parseInt(stats.rows[0].pending_reviews, 10),
      approvedReviews: parseInt(stats.rows[0].approved_reviews, 10),
      rejectedReviews: parseInt(stats.rows[0].rejected_reviews, 10),
      flaggedReviews: parseInt(stats.rows[0].flagged_reviews, 10),
      averageRating: parseFloat(stats.rows[0].average_rating),
      reviewsWithImages: parseInt(stats.rows[0].reviews_with_images, 10),
      verifiedPurchaseReviews: parseInt(
        stats.rows[0].verified_purchase_reviews,
        10,
      ),
      ratingDistribution,
    }
  }

  /**
   * Get product review summary
   */
  async getProductReviewSummary(
    productId: string,
  ): Promise<ReviewSummary | null> {
    const result = await query(
      'SELECT * FROM product_review_summary WHERE product_id = $1',
      [productId],
    )
    return result.rows[0] || null
  }

  /**
   * Bulk approve reviews
   */
  async bulkApprove(reviewIds: string[]): Promise<number> {
    const result = await query(
      `UPDATE reviews 
       SET status = 'approved', is_approved = true, updated_at = NOW()
       WHERE id = ANY($1)`,
      [reviewIds],
    )
    return result.rowCount ?? 0
  }

  /**
   * Bulk reject reviews
   */
  async bulkReject(reviewIds: string[]): Promise<number> {
    const result = await query(
      `UPDATE reviews 
       SET status = 'rejected', is_approved = false, updated_at = NOW()
       WHERE id = ANY($1)`,
      [reviewIds],
    )
    return result.rowCount ?? 0
  }

  /**
   * Auto-approve low-risk reviews
   */
  async autoApproveReviews(): Promise<number> {
    // Auto-approve verified purchases with rating >= 4 and no flagged words
    const result = await query(`
      UPDATE reviews 
      SET status = 'approved', is_approved = true, updated_at = NOW()
      WHERE status = 'pending' 
        AND is_verified_purchase = true 
        AND rating >= 4
        AND reported_count = 0
      RETURNING id
    `)
    return result.rowCount ?? 0
  }
}

export default new ReviewService()
