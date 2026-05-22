import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

const isBooksFeatureEnabled = () =>
  String(process.env.ENABLE_BOOKS_WEB3 || 'false').toLowerCase() === 'true'

const requireFeatureEnabled = (res: Response) => {
  if (!isBooksFeatureEnabled()) {
    res.status(404).json({
      success: false,
      error: 'Books moderation is not enabled',
    })
    return false
  }

  return true
}

export const getBooksReviewQueue = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res)) {
      return
    }

    const { page = 1, limit = 20, status = 'pending_review' } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await query(
      `SELECT COUNT(*)
       FROM products p
       WHERE p.deleted_at IS NULL
         AND p.product_kind = 'book'
         AND p.publication_status = $1`,
      [status],
    )

    const total = Number(countResult.rows[0]?.count || 0)

    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.slug,
         p.base_price,
         p.created_at,
         p.submitted_for_review_at,
         p.publication_status,
         p.rights_declared,
         p.creator_terms_accepted,
         p.moderation_notes,
         cp.handle AS creator_handle,
         cp.display_name AS creator_name,
         bm.cover_image_url,
         bm.preview_url,
         bm.format
       FROM products p
       LEFT JOIN creator_profiles cp ON cp.id = p.creator_profile_id
       LEFT JOIN book_metadata bm ON bm.product_id = p.id
       WHERE p.deleted_at IS NULL
         AND p.product_kind = 'book'
         AND p.publication_status = $1
       ORDER BY p.submitted_for_review_at DESC NULLS LAST, p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, Number(limit), offset],
    )

    res.json({
      success: true,
      data: {
        books: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get books review queue error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch books review queue',
    })
  }
}

export const approveBook = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res)) {
      return
    }

    const { bookId } = req.params
    const { moderationNotes, publishNow = true } = req.body
    const adminId = req.user?.userId

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const result = await query(
      `UPDATE products
       SET publication_status = $1,
           reviewed_by = $2,
           reviewed_at = CURRENT_TIMESTAMP,
           moderation_notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
         AND deleted_at IS NULL
         AND product_kind = 'book'
       RETURNING id, name, slug, publication_status, reviewed_at, moderation_notes`,
      [
        publishNow ? 'published' : 'approved',
        adminId,
        moderationNotes || null,
        bookId,
      ],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
      })
    }

    res.json({
      success: true,
      data: {
        book: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Approve book error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to approve book',
    })
  }
}

export const rejectBook = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res)) {
      return
    }

    const { bookId } = req.params
    const { moderationNotes } = req.body
    const adminId = req.user?.userId

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    if (!moderationNotes) {
      return res.status(400).json({
        success: false,
        error: 'moderationNotes is required for rejections',
      })
    }

    const result = await query(
      `UPDATE products
       SET publication_status = 'rejected',
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           moderation_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
         AND deleted_at IS NULL
         AND product_kind = 'book'
       RETURNING id, name, slug, publication_status, reviewed_at, moderation_notes`,
      [adminId, moderationNotes, bookId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
      })
    }

    res.json({
      success: true,
      data: {
        book: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Reject book error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to reject book',
    })
  }
}
