/**
 * Review Controller
 * API endpoints for product reviews and ratings
 */

import { Response, Request } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import reviewService from '../../../services/review.service'
import logger from '../../../utils/logger'

/**
 * Get all reviews with filters (Admin)
 */
export const getReviews = async (req: AuthRequest, res: Response) => {
  try {
    const {
      productId,
      userId,
      rating,
      status,
      isVerifiedPurchase,
      isFeatured,
      hasImages,
      search,
      page = '1',
      limit = '20',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query

    const filters = {
      productId: productId as string,
      userId: userId as string,
      rating: rating ? parseInt(rating as string, 10) : undefined,
      status: status as string,
      isVerifiedPurchase:
        isVerifiedPurchase === 'true'
          ? true
          : isVerifiedPurchase === 'false'
          ? false
          : undefined,
      isFeatured:
        isFeatured === 'true'
          ? true
          : isFeatured === 'false'
          ? false
          : undefined,
      hasImages: hasImages === 'true',
      search: search as string,
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    }

    const result = await reviewService.getReviews(filters)

    res.json({
      success: true,
      data: result.reviews,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / filters.limit),
      },
    })
  } catch (error) {
    logger.error('Get reviews error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews',
    })
  }
}

/**
 * Get review by ID
 */
export const getReviewById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const review = await reviewService.getReviewById(id)

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      })
    }

    res.json({
      success: true,
      data: review,
    })
  } catch (error) {
    logger.error('Get review error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get review',
    })
  }
}

/**
 * Get reviews for a product (Public)
 */
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params
    const { page = '1', limit = '10', sortBy = 'created_at' } = req.query

    const result = await reviewService.getProductReviews(
      productId,
      parseInt(page as string, 10),
      Math.min(parseInt(limit as string, 10), 50),
      sortBy as string,
      true, // Only approved reviews
    )

    res.json({
      success: true,
      data: {
        reviews: result.reviews,
        summary: result.summary,
      },
      pagination: {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit as string, 10)),
      },
    })
  } catch (error) {
    logger.error('Get product reviews error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get product reviews',
    })
  }
}

/**
 * Create a new review
 */
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { productId, orderItemId, rating, title, comment, images } = req.body

    if (!productId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and rating are required',
      })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5',
      })
    }

    const review = await reviewService.createReview({
      productId,
      userId,
      orderItemId,
      rating,
      title,
      comment,
      images,
    })

    res.status(201).json({
      success: true,
      data: review,
      message:
        'Review submitted successfully. It will be visible after approval.',
    })
  } catch (error) {
    logger.error('Create review error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to create review'
    res.status(400).json({
      success: false,
      error: message,
    })
  }
}

/**
 * Update a review
 */
export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const review = await reviewService.updateReview(id, req.body)

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      })
    }

    res.json({
      success: true,
      data: review,
      message: 'Review updated successfully',
    })
  } catch (error) {
    logger.error('Update review error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update review',
    })
  }
}

/**
 * Delete a review
 */
export const deleteReview = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const deleted = await reviewService.deleteReview(id)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      })
    }

    res.json({
      success: true,
      message: 'Review deleted successfully',
    })
  } catch (error) {
    logger.error('Delete review error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete review',
    })
  }
}

/**
 * Approve a review
 */
export const approveReview = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const review = await reviewService.approveReview(id)

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      })
    }

    res.json({
      success: true,
      data: review,
      message: 'Review approved',
    })
  } catch (error) {
    logger.error('Approve review error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to approve review',
    })
  }
}

/**
 * Reject a review
 */
export const rejectReview = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const review = await reviewService.rejectReview(id)

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      })
    }

    res.json({
      success: true,
      data: review,
      message: 'Review rejected',
    })
  } catch (error) {
    logger.error('Reject review error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to reject review',
    })
  }
}

/**
 * Add admin response to a review
 */
export const addResponse = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { response } = req.body

    if (!response) {
      return res.status(400).json({
        success: false,
        error: 'Response text is required',
      })
    }

    const review = await reviewService.addResponse(id, response)

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      })
    }

    res.json({
      success: true,
      data: review,
      message: 'Response added successfully',
    })
  } catch (error) {
    logger.error('Add response error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to add response',
    })
  }
}

/**
 * Mark review as helpful
 */
export const markHelpful = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const { voteType = 'helpful' } = req.body

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const success = await reviewService.markHelpful(id, userId, voteType)

    res.json({
      success,
      message: success ? 'Vote recorded' : 'Failed to record vote',
    })
  } catch (error) {
    logger.error('Mark helpful error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to mark as helpful',
    })
  }
}

/**
 * Report a review
 */
export const reportReview = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const success = await reviewService.reportReview(id, userId)

    res.json({
      success,
      message: success ? 'Review reported' : 'Failed to report review',
    })
  } catch (error) {
    logger.error('Report review error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to report review',
    })
  }
}

/**
 * Get review statistics
 */
export const getReviewStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await reviewService.getReviewStats()

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error('Get review stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get review statistics',
    })
  }
}

/**
 * Bulk approve reviews
 */
export const bulkApprove = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewIds } = req.body

    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Review IDs array is required',
      })
    }

    const count = await reviewService.bulkApprove(reviewIds)

    res.json({
      success: true,
      message: `${count} reviews approved`,
    })
  } catch (error) {
    logger.error('Bulk approve error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to bulk approve reviews',
    })
  }
}

/**
 * Bulk reject reviews
 */
export const bulkReject = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewIds } = req.body

    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Review IDs array is required',
      })
    }

    const count = await reviewService.bulkReject(reviewIds)

    res.json({
      success: true,
      message: `${count} reviews rejected`,
    })
  } catch (error) {
    logger.error('Bulk reject error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to bulk reject reviews',
    })
  }
}

/**
 * Toggle featured status
 */
export const toggleFeatured = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const review = await reviewService.getReviewById(id)

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      })
    }

    const updated = await reviewService.updateReview(id, {
      isFeatured: !review.is_featured,
    })

    res.json({
      success: true,
      data: updated,
      message: `Review ${updated?.is_featured ? 'featured' : 'unfeatured'}`,
    })
  } catch (error) {
    logger.error('Toggle featured error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to toggle featured status',
    })
  }
}
