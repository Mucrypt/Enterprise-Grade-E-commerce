import { NextFunction, Request, Response } from 'express'
import { query as dbQuery, getClient } from '../../../database/connection'
import { AuthRequest } from '../../../middleware/auth'
import {
  processDiscoverAudio,
  processDiscoverImage,
  processDiscoverVideo,
  validateAudioFile,
  validateImageFile,
  validateVideoFile,
} from '../../../utils/media'
import { getCloudinaryStreamingUrl } from '../../../services/media-storage.service'
import logger from '../../../utils/logger'

// Same shape/formulas used throughout the app (wishlist.controller.ts,
// product-collections.controller.ts, hero-slides.controller.ts) -- real
// images/total_stock/category/brand joined in, never left for the
// frontend to fetch separately.
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

const MAX_PUBLIC_POSTS_PER_PAGE = 20
const MAX_TAGGED_PRODUCTS = 8

async function resolvePostMedia(
  req: Request,
): Promise<{
  videoUrl?: string
  videoPosterUrl?: string
  imageUrls?: string[]
  audioUrl?: string
}> {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined

  const result: { videoUrl?: string; videoPosterUrl?: string; imageUrls?: string[]; audioUrl?: string } = {}

  const videoFile = files?.video?.[0]
  if (videoFile) {
    const validation = validateVideoFile(videoFile)
    if (!validation.valid) throw new Error(`Video: ${validation.error}`)
    const processed = await processDiscoverVideo(videoFile)
    result.videoUrl = processed.url
  }

  const posterFile = files?.poster?.[0]
  if (posterFile) {
    const validation = validateImageFile(posterFile)
    if (!validation.valid) throw new Error(`Poster: ${validation.error}`)
    const processed = await processDiscoverImage(posterFile)
    result.videoPosterUrl = processed.optimized.large?.url || processed.original.url
  }

  const imageFiles = files?.images || []
  if (imageFiles.length > 0) {
    const urls: string[] = []
    for (const file of imageFiles) {
      const validation = validateImageFile(file)
      if (!validation.valid) throw new Error(`Image: ${validation.error}`)
      const processed = await processDiscoverImage(file)
      urls.push(processed.optimized.large?.url || processed.original.url)
    }
    result.imageUrls = urls
  }

  const audioFile = files?.audio?.[0]
  if (audioFile) {
    const validation = validateAudioFile(audioFile)
    if (!validation.valid) throw new Error(`Audio: ${validation.error}`)
    const processed = await processDiscoverAudio(audioFile)
    result.audioUrl = processed.url
  }

  return result
}

// Mirrors the DB's discover_post_video_requires_url CHECK constraint so a
// video post missing its video is rejected with a clear message instead of
// reaching Postgres and surfacing as an opaque 500 -- same pattern as
// hero-slides.controller.ts's REQUIRED_REFERENCE_FIELD/respondHeroSlideError.
function respondDiscoverError(res: Response, error: any, fallbackMessage: string): void {
  if (/^(Video|Poster|Image|Audio):/.test(error.message)) {
    res.status(400).json({ success: false, message: 'Failed to save discover post', error: error.message })
    return
  }
  if (error.code === '23514') {
    res.status(400).json({
      success: false,
      message: 'A video post requires a video file; an image post requires at least one image.',
    })
    return
  }
  if (error.code === '23503') {
    res.status(400).json({ success: false, message: 'The selected category or product no longer exists.' })
    return
  }
  logger.error(fallbackMessage, error)
  res.status(500).json({ success: false, message: fallbackMessage, error: error.message })
}

// =====================================================
// AUTHORIZATION -- lets an approved, active, non-suspended seller manage
// their OWN Discover posts alongside admin/staff, without a blanket
// `authorize('seller')` role check (verification_status can change, so
// this is a real DB read every request, not a cached JWT claim).
// `sellerProfileId` is attached to the request when the caller reached
// this via seller approval rather than an admin/staff role, and is what
// every handler below uses to scope ownership and force the
// pending-review gate on create.
// =====================================================

export interface DiscoverAuthRequest extends AuthRequest {
  sellerProfileId?: string
}

export async function requireAdminOrApprovedSeller(req: Request, res: Response, next: NextFunction) {
  const authReq = req as DiscoverAuthRequest
  if (!authReq.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' })
  }

  if (authReq.user.userType === 'admin' || authReq.user.userType === 'super_admin') {
    return next()
  }

  try {
    const sellerResult = await dbQuery(
      `SELECT id FROM seller_profiles
       WHERE user_id = $1 AND verification_status = 'approved' AND is_active = TRUE AND is_suspended = FALSE
       LIMIT 1`,
      [authReq.user.id],
    )
    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or approved sellers can manage Discover posts',
      })
    }
    authReq.sellerProfileId = sellerResult.rows[0].id
    next()
  } catch (error: any) {
    logger.error('Error checking seller approval for Discover post:', error)
    res.status(500).json({ success: false, message: 'Failed to verify seller status', error: error.message })
  }
}

// Sellers may only touch posts they authored; admins are unrestricted.
// Returns null on success, or the {status, message} to respond with on
// failure -- a plain nullable return rather than a discriminated union,
// since this codebase runs with strictNullChecks off (tsconfig.json),
// which makes `if (!result.ok)`-style narrowing unreliable.
async function assertOwnsPostOrIsAdmin(
  req: DiscoverAuthRequest,
  postId: string,
): Promise<{ status: number; message: string } | null> {
  const result = await dbQuery('SELECT created_by FROM discover_posts WHERE id = $1', [postId])
  if (result.rows.length === 0) {
    return { status: 404, message: 'Discover post not found' }
  }
  const createdBy = result.rows[0].created_by as string | null
  if (req.sellerProfileId && createdBy !== req.user?.id) {
    return { status: 403, message: 'You can only manage your own Discover posts' }
  }
  return null
}

// =====================================================
// ADMIN: LIST / GET ONE
// =====================================================

// A seller only ever sees their own posts here (used for their "My
// Discover Posts" dashboard); admin/staff see everything, optionally
// filtered to the pending-review queue via ?status=pending.
export const getAdminDiscoverPosts = async (req: Request, res: Response) => {
  try {
    const authReq = req as DiscoverAuthRequest
    const conditions: string[] = []
    const params: any[] = []

    if (authReq.sellerProfileId) {
      params.push(authReq.user?.id)
      conditions.push(`dp.created_by = $${params.length}`)
    } else if (req.query.status === 'pending') {
      conditions.push(`dp.is_active = FALSE AND dp.seller_profile_id IS NOT NULL`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await dbQuery(
      `SELECT dp.*,
              cat.name as category_name,
              cat.slug as category_slug,
              sp.display_name as seller_display_name,
              sp.handle as seller_handle,
              (SELECT COUNT(*) FROM discover_post_products WHERE discover_post_id = dp.id) as product_count
       FROM discover_posts dp
       LEFT JOIN categories cat ON dp.category_id = cat.id
       LEFT JOIN seller_profiles sp ON dp.seller_profile_id = sp.id
       ${whereClause}
       ORDER BY dp.position DESC, dp.created_at DESC`,
      params,
    )
    res.json({ success: true, data: result.rows })
  } catch (error: any) {
    logger.error('Error fetching discover posts:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch discover posts', error: error.message })
  }
}

export const getAdminDiscoverPostById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const authReq = req as DiscoverAuthRequest
    const ownershipError = await assertOwnsPostOrIsAdmin(authReq, id)
    if (ownershipError) {
      return res.status(ownershipError.status).json({ success: false, message: ownershipError.message })
    }

    const postResult = await dbQuery('SELECT * FROM discover_posts WHERE id = $1', [id])
    if (postResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Discover post not found' })
    }
    const post = postResult.rows[0]
    post.video_streaming_url = getCloudinaryStreamingUrl(post.video_url)

    const productsResult = await dbQuery(
      `SELECT ${PRODUCT_SELECT_FIELDS}, dpp.position as item_position
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       JOIN discover_post_products dpp ON p.id = dpp.product_id
       WHERE dpp.discover_post_id = $1
       ORDER BY dpp.position ASC`,
      [id],
    )
    post.products = productsResult.rows

    if (post.media_type === 'image') {
      const imagesResult = await dbQuery(
        'SELECT * FROM discover_post_images WHERE discover_post_id = $1 ORDER BY position ASC',
        [id],
      )
      post.images = imagesResult.rows
    }

    res.json({ success: true, data: post })
  } catch (error: any) {
    logger.error('Error fetching discover post:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch discover post', error: error.message })
  }
}

// =====================================================
// CREATE / UPDATE / DELETE / REORDER
// =====================================================

export const createDiscoverPost = async (req: Request, res: Response) => {
  try {
    const { mediaType, caption, categoryId, position = 0, audioLabel } = req.body
    const authReq = req as DiscoverAuthRequest

    if (mediaType !== 'video' && mediaType !== 'image') {
      return res.status(400).json({ success: false, message: 'mediaType must be "video" or "image"' })
    }

    const media = await resolvePostMedia(req)

    if (mediaType === 'video' && !media.videoUrl && !req.body.videoUrl) {
      return res.status(400).json({ success: false, message: 'A video file (or videoUrl) is required for a video post' })
    }
    if (mediaType === 'image' && (!media.imageUrls || media.imageUrls.length === 0)) {
      return res.status(400).json({ success: false, message: 'At least one image is required for an image post' })
    }

    const userId = authReq.user?.id
    // A seller can never publish directly, regardless of what isActive
    // they send -- every seller-authored post starts pending review (see
    // reviewDiscoverPost). Admin/staff keep full control, unchanged.
    const isActive = authReq.sellerProfileId ? false : (req.body.isActive ?? true)
    // Sellers can't pin/reorder the global feed via position either.
    const resolvedPosition = authReq.sellerProfileId ? 0 : position

    const result = await dbQuery(
      `INSERT INTO discover_posts
       (media_type, video_url, video_poster_url, caption, category_id, is_active, position, created_by, audio_url, audio_label, seller_profile_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        mediaType,
        media.videoUrl || req.body.videoUrl || null,
        media.videoPosterUrl || req.body.videoPosterUrl || null,
        caption || null,
        categoryId || null,
        isActive,
        resolvedPosition,
        userId || null,
        media.audioUrl || null,
        audioLabel || null,
        authReq.sellerProfileId || null,
      ],
    )
    const post = result.rows[0]

    if (mediaType === 'image' && media.imageUrls) {
      let pos = 0
      for (const url of media.imageUrls) {
        await dbQuery(
          'INSERT INTO discover_post_images (discover_post_id, image_url, position) VALUES ($1, $2, $3)',
          [post.id, url, pos++],
        )
      }
    }

    res.status(201).json({ success: true, message: 'Discover post created successfully', data: post })
  } catch (error: any) {
    respondDiscoverError(res, error, 'Failed to create discover post')
  }
}

const POST_UPDATE_FIELD_MAP: Record<string, string> = {
  caption: 'caption',
  categoryId: 'category_id',
  category_id: 'category_id',
  isActive: 'is_active',
  is_active: 'is_active',
  position: 'position',
  videoUrl: 'video_url',
  video_url: 'video_url',
  videoPosterUrl: 'video_poster_url',
  video_poster_url: 'video_poster_url',
  audioUrl: 'audio_url',
  audio_url: 'audio_url',
  audioLabel: 'audio_label',
  audio_label: 'audio_label',
}

export const updateDiscoverPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updates = req.body
    const authReq = req as DiscoverAuthRequest

    if (updates.categoryId === '') updates.categoryId = null
    if (updates.category_id === '') updates.category_id = null
    // Empty string is how the admin form signals "remove the existing
    // track" (no new file chosen, but the clear button was pressed) --
    // same convention as categoryId above.
    if (updates.audioUrl === '') updates.audioUrl = null
    if (updates.audio_url === '') updates.audio_url = null

    const ownershipError = await assertOwnsPostOrIsAdmin(authReq, id)
    if (ownershipError) {
      return res.status(ownershipError.status).json({ success: false, message: ownershipError.message })
    }

    // A seller editing their own post can never re-approve it or touch
    // the global feed pin -- those stay admin-only levers. Editing an
    // already-live post also drops it back to pending, since the content
    // just changed and hasn't been reviewed in its new form.
    if (authReq.sellerProfileId) {
      delete updates.isActive
      delete updates.is_active
      delete updates.position
      updates.isActive = false
    }

    const media = await resolvePostMedia(req)
    if (media.videoUrl) updates.videoUrl = media.videoUrl
    if (media.videoPosterUrl) updates.videoPosterUrl = media.videoPosterUrl
    if (media.audioUrl) updates.audioUrl = media.audioUrl

    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1
    const appliedFields = new Set<string>()

    for (const [inputField, dbField] of Object.entries(POST_UPDATE_FIELD_MAP)) {
      if (appliedFields.has(dbField)) continue
      if (updates[inputField] !== undefined) {
        fields.push(`${dbField} = $${paramCount++}`)
        values.push(updates[inputField])
        appliedFields.add(dbField)
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' })
    }

    values.push(id)

    const result = await dbQuery(
      `UPDATE discover_posts SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values,
    )

    res.json({ success: true, message: 'Discover post updated successfully', data: result.rows[0] })
  } catch (error: any) {
    respondDiscoverError(res, error, 'Failed to update discover post')
  }
}

export const deleteDiscoverPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const ownershipError = await assertOwnsPostOrIsAdmin(req as DiscoverAuthRequest, id)
    if (ownershipError) {
      return res.status(ownershipError.status).json({ success: false, message: ownershipError.message })
    }

    const result = await dbQuery('DELETE FROM discover_posts WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Discover post not found' })
    }
    res.json({ success: true, message: 'Discover post deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting discover post:', error)
    res.status(500).json({ success: false, message: 'Failed to delete discover post', error: error.message })
  }
}

export const reorderDiscoverPosts = async (req: Request, res: Response) => {
  try {
    const order = req.body.order

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid order data' })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      for (const item of order) {
        await client.query('UPDATE discover_posts SET position = $1 WHERE id = $2', [item.position, item.id])
      }
      await client.query('COMMIT')

      const result = await dbQuery('SELECT * FROM discover_posts ORDER BY position DESC, created_at DESC')
      res.json({ success: true, message: 'Discover posts reordered successfully', data: result.rows })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    logger.error('Error reordering discover posts:', error)
    res.status(500).json({ success: false, message: 'Failed to reorder discover posts', error: error.message })
  }
}

// Admin-only approval for a seller-authored post -- the trust/safety
// gate for opening Discover posting beyond staff. There's no separate
// "rejected" state: an admin declining a post just deletes it via the
// existing deleteDiscoverPost endpoint (same admin-only access, no new
// state to invent or for a pending queue to accumulate forever).
export const reviewDiscoverPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await dbQuery(
      `UPDATE discover_posts SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND seller_profile_id IS NOT NULL
       RETURNING *`,
      [id],
    )
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending seller post not found (already reviewed, or not a seller-authored post)',
      })
    }
    res.json({ success: true, message: 'Discover post approved and published', data: result.rows[0] })
  } catch (error: any) {
    logger.error('Error approving discover post:', error)
    res.status(500).json({ success: false, message: 'Failed to approve discover post', error: error.message })
  }
}

// =====================================================
// PRODUCT TAGGING -- verbatim clone of hero-slides.controller.ts's
// addHeroSlideItems/removeHeroSlideItem/reorderHeroSlideItems, scoped to
// discover_post_products instead of hero_slide_items.
// =====================================================

export const addPostProducts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { productIds } = req.body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Product IDs array is required' })
    }

    const ownershipError = await assertOwnsPostOrIsAdmin(req as DiscoverAuthRequest, id)
    if (ownershipError) {
      return res.status(ownershipError.status).json({ success: false, message: ownershipError.message })
    }

    const existingCountResult = await dbQuery(
      'SELECT COUNT(*) as count FROM discover_post_products WHERE discover_post_id = $1',
      [id],
    )
    const existingCount = parseInt(existingCountResult.rows[0].count)
    if (existingCount + productIds.length > MAX_TAGGED_PRODUCTS) {
      return res.status(400).json({
        success: false,
        message: `A discover post can tag at most ${MAX_TAGGED_PRODUCTS} products`,
      })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const maxPosResult = await client.query(
        'SELECT COALESCE(MAX(position), -1) as max_pos FROM discover_post_products WHERE discover_post_id = $1',
        [id],
      )
      let currentPosition = maxPosResult.rows[0].max_pos + 1

      for (const productId of productIds) {
        const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId])
        if (productCheck.rows.length === 0) {
          throw new Error(`Product ${productId} not found`)
        }

        await client.query(
          `INSERT INTO discover_post_products (discover_post_id, product_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (discover_post_id, product_id) DO NOTHING`,
          [id, productId, currentPosition++],
        )
      }

      await client.query('COMMIT')

      const result = await dbQuery(
        `SELECT ${PRODUCT_SELECT_FIELDS}, dpp.position as item_position
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN brands b ON p.brand_id = b.id
         JOIN discover_post_products dpp ON p.id = dpp.product_id
         WHERE dpp.discover_post_id = $1
         ORDER BY dpp.position ASC`,
        [id],
      )

      res.json({ success: true, message: 'Products added to discover post successfully', data: result.rows })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    logger.error('Error adding products to discover post:', error)
    res.status(500).json({ success: false, message: 'Failed to add products to discover post', error: error.message })
  }
}

export const removePostProduct = async (req: Request, res: Response) => {
  try {
    const { id, productId } = req.params
    const ownershipError = await assertOwnsPostOrIsAdmin(req as DiscoverAuthRequest, id)
    if (ownershipError) {
      return res.status(ownershipError.status).json({ success: false, message: ownershipError.message })
    }

    const result = await dbQuery(
      'DELETE FROM discover_post_products WHERE discover_post_id = $1 AND product_id = $2 RETURNING *',
      [id, productId],
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found on this discover post' })
    }
    res.json({ success: true, message: 'Product removed from discover post successfully' })
  } catch (error: any) {
    logger.error('Error removing discover post product:', error)
    res.status(500).json({ success: false, message: 'Failed to remove product from discover post', error: error.message })
  }
}

export const reorderPostProducts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const productOrder = req.body.productOrder || req.body.items

    if (!Array.isArray(productOrder) || productOrder.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid product order data' })
    }

    const ownershipError = await assertOwnsPostOrIsAdmin(req as DiscoverAuthRequest, id)
    if (ownershipError) {
      return res.status(ownershipError.status).json({ success: false, message: ownershipError.message })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      for (const item of productOrder) {
        await client.query(
          'UPDATE discover_post_products SET position = $1 WHERE discover_post_id = $2 AND product_id = $3',
          [item.position, id, item.productId],
        )
      }
      await client.query('COMMIT')

      const result = await dbQuery(
        `SELECT ${PRODUCT_SELECT_FIELDS}, dpp.position as item_position
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN brands b ON p.brand_id = b.id
         JOIN discover_post_products dpp ON p.id = dpp.product_id
         WHERE dpp.discover_post_id = $1
         ORDER BY dpp.position ASC`,
        [id],
      )

      res.json({ success: true, message: 'Products reordered successfully', data: result.rows })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    logger.error('Error reordering discover post products:', error)
    res.status(500).json({ success: false, message: 'Failed to reorder products', error: error.message })
  }
}

// =====================================================
// PUBLIC: FEED
// v1 ranking is deliberately simple -- a real, transactionally-maintained
// engagement score plus mild recency decay, no per-user personalization
// yet (not enough interaction volume on day one to make one meaningful).
// An admin's manual `position` always wins first, as a pin-to-top knob.
// =====================================================

export const getDiscoverFeed = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(MAX_PUBLIC_POSTS_PER_PAGE, parseInt(String(req.query.limit || '10'), 10))
    const offset = (page - 1) * limit
    const userId = (req as AuthRequest).user?.userId
    // Optional -- a seller's public profile page uses this to show only
    // their own approved posts, reusing the exact same feed query/scoring
    // instead of a separate endpoint.
    const sellerId = req.query.sellerId ? String(req.query.sellerId) : null

    const postsResult = await dbQuery(
      `SELECT dp.*,
              cat.name as category_name,
              cat.slug as category_slug,
              sp.id as seller_id,
              sp.display_name as seller_display_name,
              sp.handle as seller_handle,
              sp.avatar_url as seller_avatar_url,
              (dp.like_count + dp.save_count * 3 + dp.add_to_cart_count * 4 + dp.purchase_count * 10
               - GREATEST(0, EXTRACT(EPOCH FROM (now() - dp.created_at)) / 86400 - 3) * 2) as score
       FROM discover_posts dp
       LEFT JOIN categories cat ON dp.category_id = cat.id
       LEFT JOIN seller_profiles sp ON dp.seller_profile_id = sp.id
       WHERE dp.is_active = TRUE ${sellerId ? 'AND dp.seller_profile_id = $3' : ''}
       ORDER BY dp.position DESC, score DESC, dp.created_at DESC
       LIMIT $1 OFFSET $2`,
      sellerId ? [limit, offset, sellerId] : [limit, offset],
    )
    const posts = postsResult.rows
    if (posts.length === 0) {
      return res.json({ success: true, data: { posts: [], page, hasMore: false } })
    }

    const postIds = posts.map((p) => p.id)

    const [productsResult, imagesResult, likedResult, savedResult] = await Promise.all([
      dbQuery(
        `SELECT ${PRODUCT_SELECT_FIELDS}, dpp.discover_post_id, dpp.position as item_position
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN brands b ON p.brand_id = b.id
         JOIN discover_post_products dpp ON p.id = dpp.product_id
         WHERE dpp.discover_post_id = ANY($1) AND p.is_active = TRUE AND p.deleted_at IS NULL
         ORDER BY dpp.discover_post_id, dpp.position ASC`,
        [postIds],
      ),
      dbQuery(
        'SELECT * FROM discover_post_images WHERE discover_post_id = ANY($1) ORDER BY discover_post_id, position ASC',
        [postIds],
      ),
      userId
        ? dbQuery('SELECT discover_post_id FROM discover_post_likes WHERE discover_post_id = ANY($1) AND user_id = $2', [postIds, userId])
        : Promise.resolve({ rows: [] as any[] }),
      userId
        ? dbQuery('SELECT discover_post_id FROM discover_post_saves WHERE discover_post_id = ANY($1) AND user_id = $2', [postIds, userId])
        : Promise.resolve({ rows: [] as any[] }),
    ])

    // Real variants for each resolved product, batched in one query (not
    // one-per-product) to avoid an N+1 explosion across many feed posts.
    const productIds = [...new Set(productsResult.rows.map((p: any) => p.id))]
    const variationsResult =
      productIds.length > 0
        ? await dbQuery(
            'SELECT * FROM product_variations WHERE product_id = ANY($1) AND is_active = true ORDER BY created_at',
            [productIds],
          )
        : { rows: [] as any[] }
    const variationsByProduct = new Map<string, any[]>()
    for (const v of variationsResult.rows) {
      const list = variationsByProduct.get(v.product_id) || []
      list.push(v)
      variationsByProduct.set(v.product_id, list)
    }

    const productsByPost = new Map<string, any[]>()
    for (const row of productsResult.rows) {
      const list = productsByPost.get(row.discover_post_id) || []
      list.push({ ...row, variations: variationsByProduct.get(row.id) || [] })
      productsByPost.set(row.discover_post_id, list)
    }

    const imagesByPost = new Map<string, any[]>()
    for (const row of imagesResult.rows) {
      const list = imagesByPost.get(row.discover_post_id) || []
      list.push(row)
      imagesByPost.set(row.discover_post_id, list)
    }

    const likedSet = new Set(likedResult.rows.map((r: any) => r.discover_post_id))
    const savedSet = new Set(savedResult.rows.map((r: any) => r.discover_post_id))

    const resolved = posts.map((post) => ({
      ...post,
      // Adaptive-bitrate HLS variant, derived at read time (no re-upload,
      // no stored column) -- null when the video isn't Cloudinary-hosted
      // (local/R2 storage), in which case the client just plays video_url.
      video_streaming_url: getCloudinaryStreamingUrl(post.video_url),
      // seller_id/seller_display_name/seller_handle/seller_avatar_url
      // already flow through via the spread above (same flat-field
      // pattern as category_name/category_slug) -- null across the
      // board for platform/admin content, and the frontend falls back
      // to the existing "@TechTools" treatment in that case.
      products: productsByPost.get(post.id) || [],
      images: post.media_type === 'image' ? imagesByPost.get(post.id) || [] : undefined,
      isLiked: likedSet.has(post.id),
      isSaved: savedSet.has(post.id),
    }))

    res.json({ success: true, data: { posts: resolved, page, hasMore: posts.length === limit } })
  } catch (error: any) {
    logger.error('Error fetching discover feed:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch discover feed', error: error.message })
  }
}

// =====================================================
// INTERACTIONS -- real, per-user, transactional. Return the new count so
// the UI can reflect it immediately (TikTok-style instant feedback)
// instead of waiting on the next feed refresh.
// =====================================================

async function toggleInteraction(
  table: 'discover_post_likes' | 'discover_post_saves',
  countColumn: 'like_count' | 'save_count',
  req: Request,
  res: Response,
  adding: boolean,
) {
  const { id } = req.params
  const userId = (req as AuthRequest).user?.userId

  const client = await getClient()
  try {
    await client.query('BEGIN')

    if (adding) {
      const inserted = await client.query(
        `INSERT INTO ${table} (discover_post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
        [id, userId],
      )
      if (inserted.rows.length > 0) {
        await client.query(`UPDATE discover_posts SET ${countColumn} = ${countColumn} + 1 WHERE id = $1`, [id])
      }
    } else {
      const deleted = await client.query(`DELETE FROM ${table} WHERE discover_post_id = $1 AND user_id = $2 RETURNING id`, [id, userId])
      if (deleted.rows.length > 0) {
        await client.query(`UPDATE discover_posts SET ${countColumn} = GREATEST(0, ${countColumn} - 1) WHERE id = $1`, [id])
      }
    }

    const countResult = await client.query(`SELECT ${countColumn} FROM discover_posts WHERE id = $1`, [id])
    await client.query('COMMIT')

    if (countResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Discover post not found' })
    }

    res.json({ success: true, data: { count: countResult.rows[0][countColumn] } })
  } catch (error: any) {
    await client.query('ROLLBACK')
    logger.error(`Error toggling ${table}:`, error)
    res.status(500).json({ success: false, message: 'Failed to update discover post', error: error.message })
  } finally {
    client.release()
  }
}

export const likePost = (req: Request, res: Response) => toggleInteraction('discover_post_likes', 'like_count', req, res, true)
export const unlikePost = (req: Request, res: Response) => toggleInteraction('discover_post_likes', 'like_count', req, res, false)
export const savePost = (req: Request, res: Response) => toggleInteraction('discover_post_saves', 'save_count', req, res, true)
export const unsavePost = (req: Request, res: Response) => toggleInteraction('discover_post_saves', 'save_count', req, res, false)

// Best-effort, fire-and-forget counters -- called when a user shares or
// adds-to-cart from the feed. Not per-user (no "already shared" concept),
// so a plain increment is enough; never blocks the client action it backs.
export const trackShare = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await dbQuery('UPDATE discover_posts SET share_count = share_count + 1 WHERE id = $1', [id])
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Error tracking discover share:', error)
    res.status(500).json({ success: false, message: 'Failed to track share', error: error.message })
  }
}

export const trackAddToCart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await dbQuery('UPDATE discover_posts SET add_to_cart_count = add_to_cart_count + 1 WHERE id = $1', [id])
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Error tracking discover add-to-cart:', error)
    res.status(500).json({ success: false, message: 'Failed to track add to cart', error: error.message })
  }
}
