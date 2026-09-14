import { Response } from 'express'
import { query as dbQuery } from '../../../database/connection'
import { AuthRequest } from '../../../middleware/auth'
import logger from '../../../utils/logger'

// Same shape/formulas as product-collections.controller.ts's
// PRODUCT_SELECT_FIELDS -- WishlistPage.tsx (web) and the wishlist tab
// (mobile) both render straight from this response with no secondary
// per-product fetch, so real images/total_stock/category/brand must be
// joined in here, not left for the frontend to fetch separately.
const PRODUCT_SELECT_FIELDS = `
  p.*,
  c.name as category_name,
  c.slug as category_slug,
  b.name as brand_name,
  b.slug as brand_slug,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', pm.id,
          'url', pm.url,
          'image_url', pm.url,
          'alt_text', pm.alt_text,
          'is_primary', pm.is_primary,
          'display_order', pm.position,
          'cdn_urls', pm.cdn_urls
        ) ORDER BY pm.is_primary DESC, pm.position
      ),
      '[]'::json
    )
    FROM (
      SELECT id, url, alt_text, is_primary, position, cdn_urls
      FROM product_media
      WHERE product_id = p.id AND type = 'image'
      ORDER BY is_primary DESC, position
      LIMIT 5
    ) pm
  ) as images,
  (
    SELECT COALESCE(SUM(i.available_stock), 0)
    FROM inventory i
    WHERE i.product_id = p.id
  ) as total_stock
`

const WISHLIST_JOIN = `
  FROM wishlist w
  JOIN products p ON p.id = w.product_id
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN brands b ON p.brand_id = b.id
  WHERE w.user_id = $1 AND p.deleted_at IS NULL
`

/**
 * GET /users/wishlist
 * A logged-out guest never calls this (the wishlist store stays purely
 * local for them) -- this is the real, server-backed list for a signed-in
 * user, and the source of truth once one exists.
 */
export const getWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    const result = await dbQuery(
      `SELECT ${PRODUCT_SELECT_FIELDS}, w.added_at
       ${WISHLIST_JOIN}
       ORDER BY w.added_at DESC`,
      [userId],
    )

    res.json({ success: true, data: { items: result.rows } })
  } catch (error: any) {
    logger.error('Error fetching wishlist:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist', error: error.message })
  }
}

/**
 * POST /users/wishlist
 * Body: { productId }. The caller already has the full product object
 * client-side (that's how it got added to the local store in the first
 * place), so this only needs to confirm success, not echo the product
 * back.
 */
export const addToWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { productId } = req.body

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' })
    }

    await dbQuery(
      `INSERT INTO wishlist (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, productId],
    )

    res.json({ success: true, message: 'Added to wishlist' })
  } catch (error: any) {
    logger.error('Error adding to wishlist:', error)
    res.status(500).json({ success: false, message: 'Failed to add to wishlist', error: error.message })
  }
}

/**
 * DELETE /users/wishlist/:productId
 */
export const removeFromWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { productId } = req.params

    await dbQuery('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2', [userId, productId])

    res.json({ success: true, message: 'Removed from wishlist' })
  } catch (error: any) {
    logger.error('Error removing from wishlist:', error)
    res.status(500).json({ success: false, message: 'Failed to remove from wishlist', error: error.message })
  }
}

/**
 * DELETE /users/wishlist
 * Backs the store's clearWishlist() for a signed-in user.
 */
export const clearWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    await dbQuery('DELETE FROM wishlist WHERE user_id = $1', [userId])
    res.json({ success: true, message: 'Wishlist cleared' })
  } catch (error: any) {
    logger.error('Error clearing wishlist:', error)
    res.status(500).json({ success: false, message: 'Failed to clear wishlist', error: error.message })
  }
}

/**
 * POST /users/wishlist/sync
 * Body: { productIds: string[] }. The guest->account merge endpoint --
 * called once right after a successful login/register with whatever was
 * in the local (guest) wishlist store, so a real account never loses
 * what was favorited before it existed. One round trip, not N individual
 * POSTs. Returns the full merged, joined wishlist so the frontend can
 * replace its local store wholesale with the authoritative result.
 */
export const syncWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { productIds } = req.body

    if (Array.isArray(productIds) && productIds.length > 0) {
      const values = productIds.map((_, index) => `($1, $${index + 2})`).join(', ')
      await dbQuery(
        `INSERT INTO wishlist (user_id, product_id)
         VALUES ${values}
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, ...productIds],
      )
    }

    const result = await dbQuery(
      `SELECT ${PRODUCT_SELECT_FIELDS}, w.added_at
       ${WISHLIST_JOIN}
       ORDER BY w.added_at DESC`,
      [userId],
    )

    res.json({ success: true, data: { items: result.rows } })
  } catch (error: any) {
    logger.error('Error syncing wishlist:', error)
    res.status(500).json({ success: false, message: 'Failed to sync wishlist', error: error.message })
  }
}
