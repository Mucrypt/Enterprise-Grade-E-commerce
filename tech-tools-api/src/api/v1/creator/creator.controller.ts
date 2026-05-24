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
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  const supported = ['full', 'sample', 'cover', 'audio']
  return supported.includes(normalized) ? (normalized as any) : 'full'
}

type CreatorAccessContext = {
  creatorProfileId: string
  sellerProfileId: string | null
  verificationStatus: string | null
  isSellerSuspended: boolean
  isSellerActive: boolean
  maxActiveListings: number | null
  isBusinessAccount: boolean
}

const getCreatorAccessContext = async (
  userId: string,
  options?: { requireApproved?: boolean },
): Promise<CreatorAccessContext | null> => {
  const result = await query(
    `SELECT cp.id AS creator_profile_id,
            sp.id AS seller_profile_id,
            sp.verification_status,
            COALESCE(sp.is_suspended, false) AS is_seller_suspended,
            COALESCE(sp.is_active, true) AS is_seller_active,
            sp.max_active_listings,
            COALESCE(u.is_business_account, false) AS is_business_account
     FROM creator_profiles cp
     INNER JOIN users u ON u.id = cp.user_id
     LEFT JOIN seller_profiles sp ON sp.user_id = cp.user_id
     WHERE cp.user_id = $1
     LIMIT 1`,
    [userId],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  const context: CreatorAccessContext = {
    creatorProfileId: row.creator_profile_id,
    sellerProfileId: row.seller_profile_id || null,
    verificationStatus: row.verification_status || null,
    isSellerSuspended: Boolean(row.is_seller_suspended),
    isSellerActive: Boolean(row.is_seller_active),
    maxActiveListings:
      row.max_active_listings !== null && row.max_active_listings !== undefined
        ? Number(row.max_active_listings)
        : null,
    isBusinessAccount: Boolean(row.is_business_account),
  }

  if (options?.requireApproved) {
    if (!context.isBusinessAccount) {
      return null
    }

    if (!context.sellerProfileId) {
      return null
    }

    if (context.isSellerSuspended || !context.isSellerActive) {
      return null
    }

    if (context.verificationStatus !== 'approved') {
      return null
    }
  }

  return context
}

const appendCreatorAuditLog = async (options: {
  sellerProfileId: string | null
  userId: string
  actorId: string
  action: string
  previousState?: Record<string, unknown> | null
  newState?: Record<string, unknown> | null
  details?: Record<string, unknown> | null
  req: AuthRequest
}) => {
  if (!options.sellerProfileId) {
    return
  }

  const auditReady = await tableExists('seller_audit_log')
  if (!auditReady) {
    return
  }

  try {
    await query(
      `INSERT INTO seller_audit_log
        (seller_profile_id, user_id, actor_id, action, previous_state, new_state, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)`,
      [
        options.sellerProfileId,
        options.userId,
        options.actorId,
        options.action,
        options.previousState ? JSON.stringify(options.previousState) : null,
        options.newState ? JSON.stringify(options.newState) : null,
        options.details ? JSON.stringify(options.details) : null,
        options.req.ip || null,
        options.req.headers['user-agent'] || null,
      ],
    )
  } catch (error) {
    logger.warn('Failed to append creator audit log', error)
  }
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

    const access = await getCreatorAccessContext(userId, {
      requireApproved: true,
    })

    if (!access) {
      return res.status(403).json({
        success: false,
        error:
          'Creator publishing access requires approved seller verification',
      })
    }

    const creatorProfileId = access.creatorProfileId

    if (access.maxActiveListings !== null && access.maxActiveListings > 0) {
      const activeCountResult = await query(
        `SELECT COUNT(*)::int AS total
         FROM products
         WHERE creator_profile_id = $1
           AND deleted_at IS NULL
           AND COALESCE(is_active, true) = true`,
        [creatorProfileId],
      )

      if ((activeCountResult.rows[0]?.total || 0) >= access.maxActiveListings) {
        return res.status(409).json({
          success: false,
          error:
            'Active listing limit reached for your seller tier. Upgrade or deactivate existing products first.',
        })
      }
    }

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

    const existingSlug = await query(
      'SELECT id FROM products WHERE slug = $1',
      [resolvedSlug],
    )

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

    const productInsert =
      supportsProductKind && supportsCreatorProfile
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

    await appendCreatorAuditLog({
      sellerProfileId: access.sellerProfileId,
      userId,
      actorId: userId,
      action: 'creator_product_created',
      newState: {
        productId: product.id,
        slug: product.slug,
        basePrice,
        salePrice: salePrice || null,
      },
      details: {
        source: 'creator_dashboard',
      },
      req,
    })

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
      const supportsFormatKey = await columnExists(
        'digital_assets',
        'format_key',
      )
      const resolvedAssets = Array.isArray(assets) ? [...assets] : []

      if (
        fileUrl &&
        !resolvedAssets.some((asset: any) => asset?.url === fileUrl)
      ) {
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

    const access = await getCreatorAccessContext(userId, {
      requireApproved: true,
    })
    if (!access) {
      return res.status(403).json({
        success: false,
        error: 'Creator access is not approved for this account',
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

    const assetType = normalizeAssetType(
      (req.body.assetType as string) || 'full',
    )
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

    await appendCreatorAuditLog({
      sellerProfileId: access.sellerProfileId,
      userId,
      actorId: userId,
      action: 'creator_asset_uploaded',
      details: {
        productId: bookId,
        files: published.length,
      },
      req,
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

    const access = await getCreatorAccessContext(userId, {
      requireApproved: true,
    })
    if (!access) {
      return res.status(403).json({
        success: false,
        error: 'Creator access is not approved for this account',
      })
    }

    const { bookId } = req.params
    const {
      rightsDeclared = true,
      creatorTermsAccepted = true,
      notes,
    } = req.body

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
        error:
          'Upload at least one full book asset before submitting for review',
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

    await appendCreatorAuditLog({
      sellerProfileId: access.sellerProfileId,
      userId,
      actorId: userId,
      action: 'creator_product_submitted_for_review',
      details: {
        productId: bookId,
      },
      req,
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
              (new Date(firstSaleAt).getTime() -
                new Date(firstBookCreatedAt).getTime()) /
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
          firstSubmittedForReviewAt:
            stats.first_submitted_for_review_at || null,
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

export const getCreatorDashboardActivity = async (
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

    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 25)

    const decodeCursor = (rawCursor: unknown) => {
      if (typeof rawCursor !== 'string' || !rawCursor.trim()) {
        return null
      }

      try {
        const parsed = JSON.parse(
          Buffer.from(rawCursor, 'base64').toString('utf8'),
        ) as {
          occurredAt?: string
          sortWeight?: number
          cursorKey?: string
        }

        if (
          !parsed.occurredAt ||
          typeof parsed.sortWeight !== 'number' ||
          !parsed.cursorKey
        ) {
          return null
        }

        const occurredAt = new Date(parsed.occurredAt)
        if (Number.isNaN(occurredAt.getTime())) {
          return null
        }

        return {
          occurredAt: occurredAt.toISOString(),
          sortWeight: parsed.sortWeight,
          cursorKey: parsed.cursorKey,
        }
      } catch {
        return null
      }
    }

    const encodeCursor = (cursor: {
      occurredAt: string
      sortWeight: number
      cursorKey: string
    }) => Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64')

    const cursor = decodeCursor(req.query.cursor)
    if (req.query.cursor && !cursor) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cursor',
      })
    }

    const creatorResult = await query(
      `SELECT cp.id,
              cp.handle,
              cp.display_name,
              cp.created_at AS creator_created_at,
              u.business_mode_activated_at
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.user_id = $1
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

    const activityResult = await query(
      `WITH creator AS (
         SELECT id, handle, display_name, creator_created_at, business_mode_activated_at
         FROM (
           SELECT id,
                  handle,
                  display_name,
                  creator_created_at,
                  business_mode_activated_at
           FROM (
             VALUES ($1::uuid, $2::text, $3::text, $4::timestamptz, $5::timestamptz)
           ) AS creator_data(id, handle, display_name, creator_created_at, business_mode_activated_at)
         ) AS creator_values
       )
       SELECT *
       FROM (
         SELECT
           creator.creator_created_at AS occurred_at,
           'creator_profile_created'::text AS event_type,
           creator.id AS entity_id,
           creator.handle AS entity_slug,
           creator.display_name AS entity_name,
           'Creator profile created'::text AS title,
           'Your creator profile is now live.'::text AS description,
           'creator'::text AS subject_type,
           NULL::uuid AS order_id,
           NULL::text AS order_number,
           NULL::int AS quantity,
           NULL::numeric AS amount,
           100 AS sort_weight,
           concat('creator:', creator.id::text) AS cursor_key
         FROM creator

         UNION ALL

         SELECT
           creator.business_mode_activated_at AS occurred_at,
           'business_mode_activated'::text,
           NULL::uuid,
           NULL::text,
           NULL::text,
           'Business mode activated'::text,
           'Business mode was enabled for this account.'::text,
           'account'::text,
           NULL::uuid,
           NULL::text,
           NULL::int,
           NULL::numeric,
           95,
           concat('business_mode:', creator.id::text)
         FROM creator
         WHERE creator.business_mode_activated_at IS NOT NULL

         UNION ALL

         SELECT
           p.created_at AS occurred_at,
           'draft_created'::text,
           p.id,
           p.slug,
           p.name,
           'Draft created'::text,
           CASE
             WHEN p.publication_status = 'published' THEN 'A new title was drafted and published.'
             ELSE 'A new draft was created in the publishing studio.'
           END AS description,
           'book'::text,
           NULL::uuid,
           NULL::text,
           NULL::int,
           NULL::numeric,
           80,
           concat('draft_created:', p.id::text)
         FROM products p
         JOIN creator ON creator.id = p.creator_profile_id
         WHERE p.deleted_at IS NULL
           AND (p.product_kind = 'book' OR p.is_digital = true)

         UNION ALL

         SELECT
           p.submitted_for_review_at AS occurred_at,
           'draft_submitted'::text,
           p.id,
           p.slug,
           p.name,
           'Submitted for review'::text,
           'The draft was sent to the moderation queue.'::text,
           'book'::text,
           NULL::uuid,
           NULL::text,
           NULL::int,
           NULL::numeric,
           70,
           concat('draft_submitted:', p.id::text)
         FROM products p
         JOIN creator ON creator.id = p.creator_profile_id
         WHERE p.deleted_at IS NULL
           AND p.submitted_for_review_at IS NOT NULL
           AND (p.product_kind = 'book' OR p.is_digital = true)

         UNION ALL

         SELECT
           o.created_at AS occurred_at,
           'sale_completed'::text,
           p.id,
           p.slug,
           p.name,
           'Sale completed'::text,
           format(
             '%s unit%s sold in order %s',
             oi.quantity,
             CASE WHEN oi.quantity = 1 THEN '' ELSE 's' END,
             o.order_number
           )::text,
           'sale'::text,
           o.id,
           o.order_number,
           oi.quantity,
           (oi.unit_price * oi.quantity) - COALESCE(oi.discount_amount, 0),
           60,
           concat('sale:', o.id::text, ':', oi.id::text)
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         JOIN creator ON creator.id = p.creator_profile_id
         WHERE p.deleted_at IS NULL
           AND o.payment_status = 'paid'
           AND o.order_status NOT IN ('cancelled', 'refunded')
       ) activity
       WHERE activity.occurred_at IS NOT NULL
         AND (
           $6::timestamptz IS NULL
           OR activity.occurred_at < $6
           OR (
             activity.occurred_at = $6
             AND activity.sort_weight < $7
           )
           OR (
             activity.occurred_at = $6
             AND activity.sort_weight = $7
             AND activity.cursor_key < $8
           )
         )
       ORDER BY activity.occurred_at DESC, activity.sort_weight DESC, activity.cursor_key DESC
       LIMIT $9`,
      [
        creator.id,
        creator.handle,
        creator.display_name,
        creator.creator_created_at,
        creator.business_mode_activated_at,
        cursor?.occurredAt || null,
        cursor?.sortWeight || null,
        cursor?.cursorKey || null,
        limit + 1,
      ],
    )

    const hasMore = activityResult.rows.length > limit
    const pageItems = hasMore
      ? activityResult.rows.slice(0, limit)
      : activityResult.rows
    const lastItem = pageItems[pageItems.length - 1]

    const nextCursor =
      hasMore && lastItem
        ? encodeCursor({
            occurredAt: new Date(lastItem.occurred_at).toISOString(),
            sortWeight: Number(lastItem.sort_weight),
            cursorKey: String(lastItem.cursor_key),
          })
        : null

    res.json({
      success: true,
      data: {
        items: pageItems.map((row) => ({
          id: `${row.event_type}-${
            row.entity_id || row.order_id || row.occurred_at
          }`,
          eventType: row.event_type,
          subjectType: row.subject_type,
          title: row.title,
          description: row.description,
          occurredAt: row.occurred_at,
          entityId: row.entity_id,
          entitySlug: row.entity_slug,
          entityName: row.entity_name,
          orderId: row.order_id,
          orderNumber: row.order_number,
          quantity: row.quantity,
          amount:
            row.amount !== null && row.amount !== undefined
              ? Number(row.amount)
              : null,
        })),
        pagination: {
          hasMore,
          nextCursor,
          limit,
        },
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Get creator dashboard activity error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator dashboard activity',
    })
  }
}

// ============================================================
// Creator Audit Log Helper
// ============================================================

const appendCreatorEntityAuditLog = async (options: {
  creatorProfileId: string
  userId: string
  action: string
  entityType?: string
  entityId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  meta?: Record<string, unknown> | null
  req: AuthRequest
}) => {
  try {
    const auditTableExists = await tableExists('creator_audit_logs')
    if (!auditTableExists) return

    await query(
      `INSERT INTO creator_audit_logs
        (creator_profile_id, user_id, action, entity_type, entity_id,
         old_value, new_value, meta, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)`,
      [
        options.creatorProfileId,
        options.userId,
        options.action,
        options.entityType || 'book',
        options.entityId || null,
        options.oldValue ? JSON.stringify(options.oldValue) : null,
        options.newValue ? JSON.stringify(options.newValue) : null,
        options.meta ? JSON.stringify(options.meta) : null,
        options.req.ip || null,
        options.req.headers['user-agent'] || null,
      ],
    )
  } catch (err) {
    logger.warn('Failed to append creator audit log', err)
  }
}

// ============================================================
// GET /creator/products
// List the authenticated creator's own book products
// ============================================================

export const getCreatorProducts = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: 'Authentication required' })
    }

    const access = await getCreatorAccessContext(userId, {
      requireApproved: true,
    })

    if (!access) {
      return res.status(403).json({
        success: false,
        error: 'Creator access is not approved for this account',
      })
    }

    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
    const offset = (page - 1) * limit
    const statusFilter =
      typeof req.query.status === 'string' ? req.query.status : null
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : null

    let whereExtra = ''
    const params: unknown[] = [access.creatorProfileId, limit + 1, offset]
    let idx = 4

    if (statusFilter) {
      whereExtra += ` AND p.publication_status = $${idx}`
      params.push(statusFilter)
      idx++
    }
    if (search) {
      whereExtra += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx})`
      params.push(`%${search}%`)
      idx++
    }

    const booksResult = await query(
      `SELECT p.id, p.name, p.slug, p.publication_status, p.base_price,
              p.sale_price, p.short_description, bm.cover_image_url,
              p.created_at, p.updated_at,
              COALESCE(
                (SELECT SUM(oi.quantity)
                 FROM order_items oi
                 INNER JOIN orders o ON o.id = oi.order_id
                 WHERE oi.product_id = p.id AND o.payment_status = 'paid'),
                0
              ) AS total_units_sold
       FROM products p
       LEFT JOIN book_metadata bm ON bm.product_id = p.id
       WHERE p.creator_profile_id = $1
         AND p.deleted_at IS NULL
         AND (p.product_kind = 'book' OR p.is_digital = true)
         ${whereExtra}
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      params,
    )

    const hasMore = booksResult.rows.length > limit
    const items = hasMore ? booksResult.rows.slice(0, limit) : booksResult.rows

    return res.json({
      success: true,
      data: {
        items: items.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          publicationStatus: row.publication_status,
          basePrice: Number(row.base_price),
          salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
          shortDescription: row.short_description || null,
          coverImageUrl: row.cover_image_url || null,
          totalUnitsSold: Number(row.total_units_sold),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        pagination: { page, limit, hasMore },
      },
    })
  } catch (error) {
    logger.error('Get creator products error:', error)
    return res
      .status(500)
      .json({ success: false, error: 'Failed to fetch creator products' })
  }
}

// ============================================================
// PATCH /creator/products/:productId
// Creator can update price, description, and status of their own book
// ============================================================

const ALLOWED_CREATOR_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['draft'],
  rejected: ['draft'],
  // published/pending_review transitions are handled by the review workflow
}

export const updateCreatorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: 'Authentication required' })
    }

    const { productId } = req.params

    // Verify creator access
    const profileResult = await query(
      `SELECT cp.id AS creator_profile_id, sp.verification_status, sp.is_suspended
       FROM creator_profiles cp
       INNER JOIN seller_profiles sp ON sp.user_id = cp.user_id
       WHERE cp.user_id = $1
       LIMIT 1`,
      [userId],
    )

    if (profileResult.rows.length === 0) {
      return res
        .status(403)
        .json({ success: false, error: 'Creator profile not found.' })
    }

    const profile = profileResult.rows[0]
    if (profile.verification_status !== 'approved') {
      return res
        .status(403)
        .json({
          success: false,
          error: 'Creator access requires admin approval.',
        })
    }
    if (profile.is_suspended) {
      return res
        .status(403)
        .json({ success: false, error: 'Creator access is suspended.' })
    }

    // Fetch the existing book owned by this creator
    const bookResult = await query(
      `SELECT id, name, base_price, sale_price, description, short_description,
              publication_status, creator_profile_id
       FROM products
       WHERE id = $1 AND creator_profile_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [productId, profile.creator_profile_id],
    )

    if (bookResult.rows.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          error: 'Product not found or not owned by you.',
        })
    }

    const existing = bookResult.rows[0]

    const {
      basePrice,
      salePrice,
      description,
      shortDescription,
      publicationStatus,
    } = req.body as {
      basePrice?: number
      salePrice?: number | null
      description?: string
      shortDescription?: string
      publicationStatus?: string
    }

    // Validate price
    if (basePrice !== undefined) {
      const price = Number(basePrice)
      if (!Number.isFinite(price) || price < 0) {
        return res
          .status(400)
          .json({
            success: false,
            error: 'basePrice must be a non-negative number.',
          })
      }
      // Rate of change guard: block >500% price increase in one shot
      const existingPrice = Number(existing.base_price)
      if (existingPrice > 0 && price > existingPrice * 6) {
        return res.status(400).json({
          success: false,
          error:
            'Price increase exceeds the allowed limit. Please use smaller increments.',
        })
      }
    }

    if (salePrice !== undefined && salePrice !== null) {
      const sp = Number(salePrice)
      if (!Number.isFinite(sp) || sp < 0) {
        return res
          .status(400)
          .json({
            success: false,
            error: 'salePrice must be a non-negative number.',
          })
      }
      const effectiveBase =
        basePrice !== undefined
          ? Number(basePrice)
          : Number(existing.base_price)
      if (sp >= effectiveBase) {
        return res
          .status(400)
          .json({
            success: false,
            error: 'salePrice must be less than basePrice.',
          })
      }
    }

    // Validate status transitions
    if (publicationStatus !== undefined) {
      const allowedNext =
        ALLOWED_CREATOR_STATUS_TRANSITIONS[existing.publication_status] || []
      if (!allowedNext.includes(publicationStatus)) {
        return res.status(400).json({
          success: false,
          error: `Cannot transition from '${existing.publication_status}' to '${publicationStatus}'. Use the submit-for-review workflow.`,
        })
      }
    }

    // Build update
    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP']
    const updateParams: unknown[] = []
    let pIdx = 1

    if (basePrice !== undefined) {
      setClauses.push(`base_price = $${pIdx}`)
      updateParams.push(Number(basePrice))
      pIdx++
    }
    if (salePrice !== undefined) {
      setClauses.push(`sale_price = $${pIdx}`)
      updateParams.push(salePrice === null ? null : Number(salePrice))
      pIdx++
    }
    if (description !== undefined) {
      setClauses.push(`description = $${pIdx}`)
      updateParams.push(String(description).trim())
      pIdx++
    }
    if (shortDescription !== undefined) {
      setClauses.push(`short_description = $${pIdx}`)
      updateParams.push(String(shortDescription).trim())
      pIdx++
    }
    if (publicationStatus !== undefined) {
      setClauses.push(`publication_status = $${pIdx}`)
      updateParams.push(publicationStatus)
      pIdx++
    }

    if (updateParams.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'No updatable fields provided.' })
    }

    updateParams.push(productId)
    const updatedResult = await query(
      `UPDATE products SET ${setClauses.join(', ')}
       WHERE id = $${pIdx}
       RETURNING id, name, slug, base_price, sale_price, description,
                 short_description, publication_status, updated_at`,
      updateParams,
    )

    await appendCreatorEntityAuditLog({
      creatorProfileId: profile.creator_profile_id,
      userId,
      action: 'product_updated',
      entityType: 'book',
      entityId: productId,
      oldValue: {
        base_price: existing.base_price,
        sale_price: existing.sale_price,
        description: existing.description,
        short_description: existing.short_description,
        publication_status: existing.publication_status,
      },
      newValue: updatedResult.rows[0] as Record<string, unknown>,
      req,
    })

    return res.json({
      success: true,
      data: { product: updatedResult.rows[0] },
    })
  } catch (error) {
    logger.error('Update creator product error:', error)
    return res
      .status(500)
      .json({ success: false, error: 'Failed to update product' })
  }
}

// ============================================================
// GET /creator/audit-logs
// Paginated audit log for the authenticated creator
// ============================================================

export const getCreatorAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: 'Authentication required' })
    }

    const auditTableExists = await tableExists('creator_audit_logs')
    if (!auditTableExists) {
      return res.json({
        success: true,
        data: { items: [], pagination: { page: 1, limit: 20, hasMore: false } },
      })
    }

    const profileResult = await query(
      `SELECT id AS creator_profile_id FROM creator_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    )

    if (profileResult.rows.length === 0) {
      return res
        .status(403)
        .json({ success: false, error: 'Creator profile not found.' })
    }

    const creatorProfileId = profileResult.rows[0].creator_profile_id
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
    const offset = (page - 1) * limit

    const logsResult = await query(
      `SELECT id, action, entity_type, entity_id, old_value, new_value,
              meta, ip_address, created_at
       FROM creator_audit_logs
       WHERE creator_profile_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [creatorProfileId, limit + 1, offset],
    )

    const hasMore = logsResult.rows.length > limit
    const items = hasMore ? logsResult.rows.slice(0, limit) : logsResult.rows

    return res.json({
      success: true,
      data: { items, pagination: { page, limit, hasMore } },
    })
  } catch (error) {
    logger.error('Get creator audit logs error:', error)
    return res
      .status(500)
      .json({ success: false, error: 'Failed to fetch audit logs' })
  }
}
