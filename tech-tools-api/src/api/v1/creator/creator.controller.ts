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
      error: 'Creator features are not enabled',
    })
    return false
  }

  return true
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const generateSku = () =>
  `BOOK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

const tableExists = async (tableName: string) => {
  const result = await query(`SELECT to_regclass($1) AS regclass`, [
    `public.${tableName}`,
  ])

  return Boolean(result.rows[0]?.regclass)
}

const columnExists = async (tableName: string, columnName: string) => {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  )

  return Boolean(result.rows[0]?.exists)
}

export const getMyCreatorProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res)) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const creatorTableReady = await tableExists('creator_profiles')
    if (!creatorTableReady) {
      return res.status(503).json({
        success: false,
        error: 'Creator schema is not ready',
      })
    }

    const result = await query(
      `SELECT id, user_id, handle, display_name, bio, avatar_url, website_url,
              social_links, payout_address, verification_status, is_public,
              created_at, updated_at
       FROM creator_profiles
       WHERE user_id = $1`,
      [userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Creator profile not found',
      })
    }

    res.json({
      success: true,
      data: {
        profile: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Get creator profile error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator profile',
    })
  }
}

export const upsertMyCreatorProfile = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!requireFeatureEnabled(res)) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const creatorTableReady = await tableExists('creator_profiles')
    if (!creatorTableReady) {
      return res.status(503).json({
        success: false,
        error: 'Creator schema is not ready',
      })
    }

    const {
      handle,
      displayName,
      bio,
      avatarUrl,
      websiteUrl,
      socialLinks,
      payoutAddress,
      isPublic = true,
    } = req.body

    if (!handle || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'handle and displayName are required',
      })
    }

    const normalizedHandle = toSlug(String(handle))
    if (!normalizedHandle) {
      return res.status(400).json({
        success: false,
        error: 'Invalid handle',
      })
    }

    const result = await query(
      `INSERT INTO creator_profiles (
         user_id, handle, display_name, bio, avatar_url, website_url,
         social_links, payout_address, is_public, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET
         handle = EXCLUDED.handle,
         display_name = EXCLUDED.display_name,
         bio = EXCLUDED.bio,
         avatar_url = EXCLUDED.avatar_url,
         website_url = EXCLUDED.website_url,
         social_links = EXCLUDED.social_links,
         payout_address = EXCLUDED.payout_address,
         is_public = EXCLUDED.is_public,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        normalizedHandle,
        displayName,
        bio || null,
        avatarUrl || null,
        websiteUrl || null,
        JSON.stringify(socialLinks || {}),
        payoutAddress || null,
        Boolean(isPublic),
      ],
    )

    res.json({
      success: true,
      data: {
        profile: result.rows[0],
      },
    })
  } catch (error: any) {
    logger.error('Upsert creator profile error:', error)

    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Handle is already in use',
      })
    }

    res.status(500).json({
      success: false,
      error: 'Failed to save creator profile',
    })
  }
}

export const getCreatorProfileByHandle = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!requireFeatureEnabled(res)) {
      return
    }

    const creatorTableReady = await tableExists('creator_profiles')
    if (!creatorTableReady) {
      return res.status(503).json({
        success: false,
        error: 'Creator schema is not ready',
      })
    }

    const { handle } = req.params
    const result = await query(
      `SELECT id, handle, display_name, bio, avatar_url, website_url,
              social_links, verification_status, created_at, updated_at
       FROM creator_profiles
       WHERE handle = $1 AND is_public = true`,
      [toSlug(String(handle))],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Creator profile not found',
      })
    }

    res.json({
      success: true,
      data: {
        profile: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Get creator profile by handle error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator profile',
    })
  }
}

export const createMyBook = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res)) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const creatorTableReady = await tableExists('creator_profiles')
    if (!creatorTableReady) {
      return res.status(503).json({
        success: false,
        error: 'Creator schema is not ready',
      })
    }

    const creatorResult = await query(
      'SELECT id FROM creator_profiles WHERE user_id = $1',
      [userId],
    )

    if (creatorResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Create creator profile first',
      })
    }

    const creatorProfileId = creatorResult.rows[0].id

    const {
      name,
      slug,
      description,
      shortDescription,
      basePrice,
      salePrice,
      format = 'pdf',
      fileUrl,
      previewUrl,
      coverImageUrl,
      languageCode = 'en',
      pageCount,
      isbn,
      publisherName,
      publicationDate,
      drmEnabled = false,
      metadata,
    } = req.body

    if (!name || !basePrice) {
      return res.status(400).json({
        success: false,
        error: 'name and basePrice are required',
      })
    }

    const resolvedSlug = toSlug(String(slug || name))
    if (!resolvedSlug) {
      return res.status(400).json({
        success: false,
        error: 'Invalid slug',
      })
    }

    const existingSlug = await query('SELECT id FROM products WHERE slug = $1', [
      resolvedSlug,
    ])

    if (existingSlug.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A product with this slug already exists',
      })
    }

    const supportsProductKind = await columnExists('products', 'product_kind')
    const supportsCreatorProfile = await columnExists(
      'products',
      'creator_profile_id',
    )

    const productInsert = supportsProductKind && supportsCreatorProfile
      ? await query(
          `INSERT INTO products (
             sku, name, slug, description, short_description,
             base_price, sale_price, is_active, is_digital,
             product_kind, creator_profile_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, 'book', $8)
           RETURNING id, sku, name, slug, product_kind`,
          [
            generateSku(),
            name,
            resolvedSlug,
            description || null,
            shortDescription || null,
            basePrice,
            salePrice || null,
            creatorProfileId,
          ],
        )
      : await query(
          `INSERT INTO products (
             sku, name, slug, description, short_description,
             base_price, sale_price, is_active, is_digital
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
           RETURNING id, sku, name, slug`,
          [
            generateSku(),
            name,
            resolvedSlug,
            description || null,
            shortDescription || null,
            basePrice,
            salePrice || null,
          ],
        )

    const product = productInsert.rows[0]

    const bookMetadataReady = await tableExists('book_metadata')
    if (bookMetadataReady) {
      await query(
        `INSERT INTO book_metadata (
           product_id, format, file_url, preview_url, cover_image_url,
           language_code, page_count, isbn, publisher_name,
           publication_date, drm_enabled, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
        [
          product.id,
          format,
          fileUrl || null,
          previewUrl || null,
          coverImageUrl || null,
          languageCode,
          pageCount || null,
          isbn || null,
          publisherName || null,
          publicationDate || null,
          Boolean(drmEnabled),
          JSON.stringify(metadata || {}),
        ],
      )
    }

    res.status(201).json({
      success: true,
      data: {
        book: product,
      },
    })
  } catch (error) {
    logger.error('Create creator book error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create book',
    })
  }
}