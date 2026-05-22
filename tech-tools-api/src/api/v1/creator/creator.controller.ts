import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  inferBookAssetFormat,
  processBookAsset,
  validateBookAssetFile,
} from '../../../utils/media'

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

const normalizeFormatKey = (formatKey: string | undefined) => {
  const normalized = String(formatKey || '')
    .trim()
    .toLowerCase()

  if (!normalized) {
    return null
  }

  const supported = ['pdf', 'epub', 'mobi', 'azw3', 'html', 'audio']
  return supported.includes(normalized) ? normalized : null
}

const normalizeAssetType = (value: string | undefined) => {
  const normalized = String(value || '').trim().toLowerCase()
  const supported = ['full', 'sample', 'cover', 'audio']
  return supported.includes(normalized) ? (normalized as any) : 'full'
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
      assets,
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

    const digitalAssetsReady = await tableExists('digital_assets')
    if (digitalAssetsReady) {
      const supportsFormatKey = await columnExists('digital_assets', 'format_key')
      const resolvedAssets = Array.isArray(assets) ? [...assets] : []

      if (fileUrl && !resolvedAssets.some((asset: any) => asset?.url === fileUrl)) {
        resolvedAssets.push({
          url: fileUrl,
          mimeType: 'application/pdf',
          formatKey: format,
          assetType: 'full',
          isActive: true,
        })
      }

      for (const asset of resolvedAssets) {
        if (!asset?.url) {
          continue
        }

        const assetType = ['full', 'sample', 'cover', 'audio'].includes(
          String(asset.assetType || 'full'),
        )
          ? String(asset.assetType || 'full')
          : 'full'

        const formatKey = normalizeFormatKey(asset.formatKey || format)
        const mimeType = String(asset.mimeType || 'application/octet-stream')

        if (supportsFormatKey) {
          await query(
            `INSERT INTO digital_assets (
               product_id, asset_type, storage_url, mime_type, file_size,
               checksum, is_active, format_key, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
            [
              product.id,
              assetType,
              asset.url,
              mimeType,
              asset.fileSize || null,
              asset.checksum || null,
              asset.isActive !== false,
              formatKey,
            ],
          )
        } else {
          await query(
            `INSERT INTO digital_assets (
               product_id, asset_type, storage_url, mime_type, file_size,
               checksum, is_active, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
            [
              product.id,
              assetType,
              asset.url,
              mimeType,
              asset.fileSize || null,
              asset.checksum || null,
              asset.isActive !== false,
            ],
          )
        }
      }
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

export const uploadMyBookAssets = async (req: AuthRequest, res: Response) => {
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

    const { bookId } = req.params
    const bookCheck = await query(
      `SELECT p.id, p.creator_profile_id, cp.user_id
       FROM products p
       LEFT JOIN creator_profiles cp ON cp.id = p.creator_profile_id
       WHERE p.id = $1
       LIMIT 1`,
      [bookId],
    )

    if (bookCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
      })
    }

    if (bookCheck.rows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not own this creator book',
      })
    }

    const files = (req.files as Express.Multer.File[] | undefined) || []
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one file is required',
      })
    }

    const assetType = normalizeAssetType((req.body.assetType as string) || 'full')
    const label = (req.body.label as string) || null
    const published = [] as any[]

    for (const file of files) {
      const validation = validateBookAssetFile(file)
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        })
      }

      const resolvedFormat =
        normalizeFormatKey((req.body.formatKey as string) || '') ||
        inferBookAssetFormat(file) ||
        'pdf'

      const processed = await processBookAsset(file, {
        productId: bookId,
        formatKey: resolvedFormat,
        assetType,
      })

      const assetResult = await query(
        `INSERT INTO digital_assets (
           product_id, asset_type, storage_url, mime_type, file_size,
           checksum, watermark_template, is_active, format_key, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          bookId,
          assetType,
          processed.url,
          processed.mimeType,
          processed.fileSize,
          null,
          label,
          processed.format,
        ],
      )

      published.push({
        ...assetResult.rows[0],
        originalFileName: file.originalname,
      })
    }

    res.status(201).json({
      success: true,
      data: {
        assets: published,
      },
    })
  } catch (error: any) {
    logger.error('Upload creator book assets error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to upload book assets',
    })
  }
}

export const submitMyBookForReview = async (
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

    const { bookId } = req.params
    const { rightsDeclared = true, creatorTermsAccepted = true, notes } = req.body

    const bookCheck = await query(
      `SELECT p.id, cp.user_id
       FROM products p
       LEFT JOIN creator_profiles cp ON cp.id = p.creator_profile_id
       WHERE p.id = $1
         AND p.deleted_at IS NULL
       LIMIT 1`,
      [bookId],
    )

    if (bookCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
      })
    }

    if (bookCheck.rows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not own this creator book',
      })
    }

    const fullAssetResult = await query(
      `SELECT COUNT(*) AS total
       FROM digital_assets
       WHERE product_id = $1
         AND asset_type = 'full'
         AND is_active = true`,
      [bookId],
    )

    if (Number(fullAssetResult.rows[0]?.total || 0) === 0) {
      return res.status(400).json({
        success: false,
        error: 'Upload at least one full book asset before submitting for review',
      })
    }

    if (!rightsDeclared || !creatorTermsAccepted) {
      return res.status(400).json({
        success: false,
        error: 'Rights declaration and creator terms acceptance are required',
      })
    }

    const result = await query(
      `UPDATE products
       SET publication_status = 'pending_review',
           rights_declared = true,
           rights_declared_at = CURRENT_TIMESTAMP,
           creator_terms_accepted = true,
           submitted_for_review_at = CURRENT_TIMESTAMP,
           moderation_notes = COALESCE($1, moderation_notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, slug, publication_status, submitted_for_review_at`,
      [notes || null, bookId],
    )

    res.json({
      success: true,
      data: {
        book: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Submit creator book for review error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to submit book for review',
    })
  }
}

export const getCreatorDashboardMetrics = async (
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

    const creatorResult = await query(
      `SELECT id, created_at
       FROM creator_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    )

    if (creatorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Creator profile not found',
      })
    }

    const creator = creatorResult.rows[0]

    const bookStatsResult = await query(
      `SELECT
         COUNT(*)::int AS total_books,
         COUNT(*) FILTER (WHERE publication_status = 'published')::int AS published_books,
         COUNT(*) FILTER (WHERE publication_status = 'pending_review')::int AS pending_review_books,
         COUNT(*) FILTER (WHERE publication_status = 'rejected')::int AS rejected_books,
         MIN(created_at) AS first_book_created_at,
         MIN(submitted_for_review_at) AS first_submitted_for_review_at
       FROM products
       WHERE creator_profile_id = $1
         AND deleted_at IS NULL
         AND (product_kind = 'book' OR is_digital = true)`,
      [creator.id],
    )

    const salesStatsResult = await query(
      `SELECT
         COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
         COALESCE(SUM((oi.unit_price * oi.quantity) - COALESCE(oi.discount_amount, 0)), 0)::numeric AS gross_sales,
         COUNT(DISTINCT oi.order_id)::int AS paid_orders,
         COUNT(DISTINCT oi.product_id)::int AS books_sold_count,
         MIN(o.created_at) AS first_sale_at,
         COALESCE(SUM(
           CASE
             WHEN o.created_at >= NOW() - INTERVAL '30 days'
             THEN (oi.unit_price * oi.quantity) - COALESCE(oi.discount_amount, 0)
             ELSE 0
           END
         ), 0)::numeric AS gross_sales_30d
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE p.creator_profile_id = $1
         AND p.deleted_at IS NULL
         AND o.payment_status = 'paid'
         AND o.order_status NOT IN ('cancelled', 'refunded')`,
      [creator.id],
    )

    const stats = bookStatsResult.rows[0]
    const sales = salesStatsResult.rows[0]

    const creatorActivated = stats.total_books > 0
    const firstBookCreatedAt = stats.first_book_created_at || null
    const firstSaleAt = sales.first_sale_at || null

    const timeToFirstSaleHours =
      firstBookCreatedAt && firstSaleAt
        ? Math.max(
            0,
            Math.round(
              (new Date(firstSaleAt).getTime() - new Date(firstBookCreatedAt).getTime()) /
                (1000 * 60 * 60),
            ),
          )
        : null

    res.json({
      success: true,
      data: {
        activation: {
          creatorProfileCreatedAt: creator.created_at,
          creatorActivated,
          totalBooks: stats.total_books,
          publishedBooks: stats.published_books,
          pendingReviewBooks: stats.pending_review_books,
          rejectedBooks: stats.rejected_books,
          firstBookCreatedAt,
          firstSubmittedForReviewAt: stats.first_submitted_for_review_at || null,
        },
        sales: {
          unitsSold: sales.units_sold,
          grossSales: Number(sales.gross_sales || 0),
          grossSales30d: Number(sales.gross_sales_30d || 0),
          paidOrders: sales.paid_orders,
          booksSoldCount: sales.books_sold_count,
          firstSaleAt,
          timeToFirstSaleHours,
        },
      },
    })
  } catch (error) {
    logger.error('Get creator dashboard metrics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator dashboard metrics',
    })
  }
}