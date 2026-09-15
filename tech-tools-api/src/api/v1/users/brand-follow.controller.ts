import { Response } from 'express'
import { query as dbQuery } from '../../../database/connection'
import { AuthRequest } from '../../../middleware/auth'
import logger from '../../../utils/logger'

/**
 * GET /users/followed-brands
 * Just the ids -- the caller (Trending page) already has full brand
 * objects from brandsApi.getAll/getBrandsWithProducts, so this only needs
 * to answer "which of these am I following."
 */
export const getFollowedBrands = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const result = await dbQuery('SELECT brand_id FROM brand_follows WHERE user_id = $1', [userId])
    res.json({ success: true, data: { brandIds: result.rows.map((r) => r.brand_id) } })
  } catch (error: any) {
    logger.error('Error fetching followed brands:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch followed brands', error: error.message })
  }
}

/**
 * POST /users/followed-brands
 * Body: { brandId }
 */
export const followBrand = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { brandId } = req.body

    if (!brandId) {
      return res.status(400).json({ success: false, message: 'brandId is required' })
    }

    await dbQuery(
      `INSERT INTO brand_follows (user_id, brand_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, brand_id) DO NOTHING`,
      [userId, brandId],
    )

    res.json({ success: true, message: 'Following brand' })
  } catch (error: any) {
    logger.error('Error following brand:', error)
    res.status(500).json({ success: false, message: 'Failed to follow brand', error: error.message })
  }
}

/**
 * DELETE /users/followed-brands/:brandId
 */
export const unfollowBrand = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { brandId } = req.params

    await dbQuery('DELETE FROM brand_follows WHERE user_id = $1 AND brand_id = $2', [userId, brandId])

    res.json({ success: true, message: 'Unfollowed brand' })
  } catch (error: any) {
    logger.error('Error unfollowing brand:', error)
    res.status(500).json({ success: false, message: 'Failed to unfollow brand', error: error.message })
  }
}
