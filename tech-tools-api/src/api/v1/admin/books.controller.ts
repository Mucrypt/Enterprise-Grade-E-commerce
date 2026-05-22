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

const isAdminBookPublishingEnabled = () =>
  String(process.env.ENABLE_ADMIN_BOOK_PUBLISHING || 'false').toLowerCase() ===
  'true'

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

const requireAdminPublishingEnabled = (res: Response) => {
  if (!isAdminBookPublishingEnabled()) {
    res.status(404).json({
      success: false,
      error: 'Admin book publishing is not enabled',
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

const isSuperAdmin = (req: AuthRequest) => req.user?.userType === 'super_admin'

const getAdminBookPolicyAction = (req: AuthRequest, requested: string) => {
  const normalized = String(requested || 'draft').trim().toLowerCase()
  if (normalized === 'publish' && isSuperAdmin(req)) {
    return 'publish'
  }

  if (normalized === 'publish' && !isSuperAdmin(req)) {
    return 'forbidden_publish'
  }

  if (normalized === 'submit' || normalized === 'submit_for_review') {
    return 'submit'
  }

  return 'draft'
}

const insertAdminActivity = async (options: {
  req: AuthRequest
  action: string
  resourceId?: string | null
  details?: Record<string, unknown>
}) => {
  try {
    const adminId = options.req.user?.userId
    if (!adminId) {
      return
    }

    await query(
      `INSERT INTO admin_activity_logs
        (admin_id, action, resource_type, resource_id, ip_address, user_agent, details)
       VALUES ($1, $2, 'books', $3, $4, $5, $6::jsonb)`,
      [
        adminId,
        options.action,
        options.resourceId || null,
        options.req.ip || null,
        options.req.headers['user-agent'] || null,
        JSON.stringify(options.details || {}),
      ],
    )
  } catch (error) {
    logger.warn('Failed to log admin book activity', error)
  }
}

const getIdempotentResponse = async (
  adminId: string,
  action: string,
  idempotencyKey: string,
) => {
  const idempotencyReady = await tableExists('admin_book_idempotency')
  if (!idempotencyReady) {
    return null
  }

  const result = await query(
    `SELECT response_payload
       FROM admin_book_idempotency
      WHERE admin_id = $1
        AND action = $2
        AND idempotency_key = $3
      LIMIT 1`,
    [adminId, action, idempotencyKey],
  )

  return result.rows[0]?.response_payload || null
}

const saveIdempotentResponse = async (options: {
  adminId: string
  action: string
  idempotencyKey: string
  resourceId?: string | null
  responsePayload: Record<string, unknown>
}) => {
  const idempotencyReady = await tableExists('admin_book_idempotency')
  if (!idempotencyReady) {
    return
  }

  await query(
    `INSERT INTO admin_book_idempotency
      (admin_id, action, idempotency_key, resource_id, response_payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (admin_id, action, idempotency_key)
     DO UPDATE SET
       resource_id = COALESCE(admin_book_idempotency.resource_id, EXCLUDED.resource_id),
       response_payload = COALESCE(admin_book_idempotency.response_payload, EXCLUDED.response_payload)`,
    [
      options.adminId,
      options.action,
      options.idempotencyKey,
      options.resourceId || null,
      JSON.stringify(options.responsePayload),
    ],
  )
}

export const createAdminBook = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res) || !requireAdminPublishingEnabled(res)) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
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
      publicationAction = 'draft',
      moderationNotes,
      idempotencyKey,
    } = req.body

    if (!name || basePrice === undefined || basePrice === null) {
      return res.status(400).json({
        success: false,
        error: 'name and basePrice are required',
      })
    }

    const parsedPrice = Number(basePrice)
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        error: 'basePrice must be a valid non-negative number',
      })
    }

    const normalizedKey = String(idempotencyKey || '').trim()
    if (normalizedKey && (normalizedKey.length < 8 || normalizedKey.length > 128)) {
      return res.status(400).json({
        success: false,
        error: 'idempotencyKey must be 8-128 characters when provided',
      })
    }

    if (normalizedKey) {
      const previous = await getIdempotentResponse(
        adminId,
        'create_book',
        normalizedKey,
      )
      if (previous) {
        return res.status(200).json(previous)
      }
    }

    const policyAction = getAdminBookPolicyAction(req, publicationAction)
    if (policyAction === 'forbidden_publish') {
      return res.status(403).json({
        success: false,
        error: 'Only super_admin can directly publish books',
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
    const supportsPublicationStatus = await columnExists('products', 'publication_status')
    const supportsAdminOrigin = await columnExists('products', 'admin_origin')
    const supportsCreatedByAdmin = await columnExists(
      'products',
      'created_by_admin_id',
    )

    const publicationStatus =
      policyAction === 'publish'
        ? 'published'
        : policyAction === 'submit'
          ? 'pending_review'
          : 'draft'

    const insertColumns = [
      'sku',
      'name',
      'slug',
      'description',
      'short_description',
      'base_price',
      'sale_price',
      'is_active',
      'is_digital',
    ]

    const insertValues: any[] = [
      generateSku(),
      name,
      resolvedSlug,
      description || null,
      shortDescription || null,
      parsedPrice,
      salePrice || null,
      true,
      true,
    ]

    if (supportsProductKind) {
      insertColumns.push('product_kind')
      insertValues.push('book')
    }

    if (supportsAdminOrigin) {
      insertColumns.push('admin_origin')
      insertValues.push(true)
    }

    if (supportsCreatedByAdmin) {
      insertColumns.push('created_by_admin_id')
      insertValues.push(adminId)
    }

    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ')

    const productInsert = await query(
      `INSERT INTO products (${insertColumns.join(', ')})
       VALUES (${placeholders})
       RETURNING id, sku, name, slug, product_kind, publication_status`,
      insertValues,
    )

    const product = productInsert.rows[0]

    if (supportsPublicationStatus) {
      await query(
        `UPDATE products
         SET publication_status = $1,
             submitted_for_review_at = CASE
               WHEN $2 = 'submit' THEN CURRENT_TIMESTAMP
               ELSE submitted_for_review_at
             END,
             rights_declared = CASE
               WHEN $2 = 'draft' THEN rights_declared
               ELSE true
             END,
             rights_declared_at = CASE
               WHEN $2 = 'draft' THEN rights_declared_at
               WHEN rights_declared_at IS NULL THEN CURRENT_TIMESTAMP
               ELSE rights_declared_at
             END,
             creator_terms_accepted = CASE
               WHEN $2 = 'draft' THEN creator_terms_accepted
               ELSE true
             END,
             reviewed_by = CASE
               WHEN $2 = 'publish' THEN $3
               ELSE reviewed_by
             END,
             reviewed_at = CASE
               WHEN $2 = 'publish' THEN CURRENT_TIMESTAMP
               ELSE reviewed_at
             END,
             moderation_notes = COALESCE($4, moderation_notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [publicationStatus, policyAction, adminId, moderationNotes || null, product.id],
      )
      product.publication_status = publicationStatus
    }

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

    await insertAdminActivity({
      req,
      action: 'admin_book_create',
      resourceId: product.id,
      details: {
        publicationStatus,
        policyAction,
      },
    })

    const payload = {
      success: true,
      data: {
        book: product,
        publicationStatus,
      },
    }

    if (normalizedKey) {
      await saveIdempotentResponse({
        adminId,
        action: 'create_book',
        idempotencyKey: normalizedKey,
        resourceId: product.id,
        responsePayload: payload,
      })
    }

    return res.status(201).json(payload)
  } catch (error) {
    logger.error('Create admin book error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create admin book',
    })
  }
}

export const uploadAdminBookAssets = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!requireFeatureEnabled(res) || !requireAdminPublishingEnabled(res)) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { bookId } = req.params
    const normalizedKey = String(req.body.idempotencyKey || '').trim()

    if (normalizedKey && (normalizedKey.length < 8 || normalizedKey.length > 128)) {
      return res.status(400).json({
        success: false,
        error: 'idempotencyKey must be 8-128 characters when provided',
      })
    }

    if (normalizedKey) {
      const previous = await getIdempotentResponse(
        adminId,
        'upload_assets',
        normalizedKey,
      )
      if (previous) {
        return res.status(200).json(previous)
      }
    }

    const supportsAdminOrigin = await columnExists('products', 'admin_origin')
    const bookCheck = supportsAdminOrigin
      ? await query(
          `SELECT id, admin_origin
           FROM products
           WHERE id = $1
             AND deleted_at IS NULL
             AND product_kind = 'book'
           LIMIT 1`,
          [bookId],
        )
      : await query(
          `SELECT id, true AS admin_origin
           FROM products
           WHERE id = $1
             AND deleted_at IS NULL
             AND product_kind = 'book'
           LIMIT 1`,
          [bookId],
        )

    if (bookCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
      })
    }

    if (!bookCheck.rows[0].admin_origin) {
      return res.status(403).json({
        success: false,
        error: 'Admin uploads are only allowed for admin-created books',
      })
    }

    const files = (req.files as Express.Multer.File[] | undefined) || []
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one file is required',
      })
    }

    const supportsFormatKey = await columnExists('digital_assets', 'format_key')
    const supportsUploadedByAdmin = await columnExists(
      'products',
      'last_uploaded_by_admin_id',
    )

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

      const assetResult = supportsFormatKey
        ? await query(
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
        : await query(
            `INSERT INTO digital_assets (
               product_id, asset_type, storage_url, mime_type, file_size,
               checksum, watermark_template, is_active, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP)
             RETURNING *`,
            [
              bookId,
              assetType,
              processed.url,
              processed.mimeType,
              processed.fileSize,
              null,
              label,
            ],
          )

      published.push({
        ...assetResult.rows[0],
        originalFileName: file.originalname,
      })
    }

    if (supportsUploadedByAdmin) {
      await query(
        `UPDATE products
            SET last_uploaded_by_admin_id = $1,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $2`,
        [adminId, bookId],
      )
    }

    await insertAdminActivity({
      req,
      action: 'admin_book_upload_assets',
      resourceId: bookId,
      details: {
        files: published.length,
        assetType,
      },
    })

    const payload = {
      success: true,
      data: {
        assets: published,
      },
    }

    if (normalizedKey) {
      await saveIdempotentResponse({
        adminId,
        action: 'upload_assets',
        idempotencyKey: normalizedKey,
        resourceId: bookId,
        responsePayload: payload,
      })
    }

    return res.status(201).json(payload)
  } catch (error: any) {
    logger.error('Upload admin book assets error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to upload admin book assets',
    })
  }
}

export const submitAdminBookForReview = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!requireFeatureEnabled(res) || !requireAdminPublishingEnabled(res)) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { bookId } = req.params
    const { notes } = req.body

    const bookCheck = await query(
      `SELECT id
       FROM products
       WHERE id = $1
         AND deleted_at IS NULL
         AND product_kind = 'book'
       LIMIT 1`,
      [bookId],
    )

    if (bookCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
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

    await insertAdminActivity({
      req,
      action: 'admin_book_submit_review',
      resourceId: bookId,
      details: {
        submittedBy: adminId,
      },
    })

    return res.json({
      success: true,
      data: {
        book: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Submit admin book for review error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to submit admin book for review',
    })
  }
}

export const publishAdminBook = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireFeatureEnabled(res) || !requireAdminPublishingEnabled(res)) {
      return
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'Only super_admin can directly publish books',
      })
    }

    const { bookId } = req.params
    const { moderationNotes } = req.body

    const result = await query(
      `UPDATE products
       SET publication_status = 'published',
           rights_declared = true,
           rights_declared_at = COALESCE(rights_declared_at, CURRENT_TIMESTAMP),
           creator_terms_accepted = true,
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           moderation_notes = COALESCE($2, moderation_notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
         AND deleted_at IS NULL
         AND product_kind = 'book'
       RETURNING id, name, slug, publication_status, reviewed_at, moderation_notes`,
      [adminId, moderationNotes || null, bookId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
      })
    }

    await insertAdminActivity({
      req,
      action: 'admin_book_publish',
      resourceId: bookId,
      details: {
        publishedBy: adminId,
      },
    })

    return res.json({
      success: true,
      data: {
        book: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Publish admin book error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to publish admin book',
    })
  }
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
