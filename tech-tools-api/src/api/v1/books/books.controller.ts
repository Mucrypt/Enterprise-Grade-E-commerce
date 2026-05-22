import { Request, Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import jwt from 'jsonwebtoken'

const isBooksFeatureEnabled = () =>
  String(process.env.ENABLE_BOOKS_WEB3 || 'false').toLowerCase() === 'true'

const hasBooksSchema = async () => {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'products'
         AND column_name = 'product_kind'
     ) AS exists`,
  )

  return Boolean(result.rows[0]?.exists)
}

const hasDigitalAssetFormatSchema = async () => {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'digital_assets'
         AND column_name = 'format_key'
     ) AS exists`,
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

const hasPublicationStatusSchema = async () => {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'products'
         AND column_name = 'publication_status'
     ) AS exists`,
  )

  return Boolean(result.rows[0]?.exists)
}

export const getBooks = async (req: Request, res: Response) => {
  try {
    if (!isBooksFeatureEnabled()) {
      return res.status(404).json({
        success: false,
        error: 'Books feature is not enabled',
      })
    }

    const { page = 1, limit = 20, search, creatorHandle } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const booksSchemaEnabled = await hasBooksSchema()
    const hasPublicationStatus = await hasPublicationStatusSchema()
    let whereClause = 'WHERE p.is_active = true AND p.deleted_at IS NULL'
    const params: any[] = []
    let idx = 1

    if (booksSchemaEnabled) {
      whereClause += ` AND p.product_kind = 'book'`
    } else {
      whereClause += ` AND p.is_digital = true`
    }

    if (hasPublicationStatus) {
      whereClause += ` AND p.publication_status = 'published'`
    }

    if (search) {
      whereClause += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx} OR p.sku ILIKE $${idx})`
      params.push(`%${search}%`)
      idx++
    }

    if (creatorHandle) {
      whereClause += ` AND cp.handle = $${idx}`
      params.push(creatorHandle)
      idx++
    }

    const countResult = await query(
      `SELECT COUNT(*)
       FROM products p
       LEFT JOIN creator_profiles cp ON cp.id = p.creator_profile_id
       ${whereClause}`,
      params,
    )

    const total = Number(countResult.rows[0]?.count || 0)

    const booksResult = await query(
      `SELECT
         p.id,
         p.sku,
         p.name,
         p.slug,
         p.description,
         p.short_description,
         p.base_price,
         p.sale_price,
         p.product_kind,
         p.created_at,
         cp.handle AS creator_handle,
         cp.display_name AS creator_name,
         bm.format,
         bm.preview_url,
         bm.cover_image_url,
         bm.language_code,
         bm.page_count
       FROM products p
       LEFT JOIN creator_profiles cp ON cp.id = p.creator_profile_id
       LEFT JOIN book_metadata bm ON bm.product_id = p.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset],
    )

    res.json({
      success: true,
      data: {
        books: booksResult.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get books error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch books',
    })
  }
}

export const getBookById = async (req: Request, res: Response) => {
  try {
    if (!isBooksFeatureEnabled()) {
      return res.status(404).json({
        success: false,
        error: 'Books feature is not enabled',
      })
    }

    const { id } = req.params
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    const booksSchemaEnabled = await hasBooksSchema()
    const hasFormatSchema = await hasDigitalAssetFormatSchema()
    const hasPublicationStatus = await hasPublicationStatusSchema()
    const identityCondition = isUUID ? 'p.id = $1' : 'p.slug = $1'
    const kindCondition = booksSchemaEnabled
      ? `AND p.product_kind = 'book'`
      : `AND p.is_digital = true`
    const publicationCondition = hasPublicationStatus
      ? `AND p.publication_status = 'published'`
      : ''

    const result = await query(
      `SELECT
         p.*,
         cp.handle AS creator_handle,
         cp.display_name AS creator_name,
         bm.format,
         bm.file_url,
         bm.preview_url,
         bm.cover_image_url,
         bm.language_code,
         bm.page_count,
         bm.isbn,
         bm.publisher_name,
         bm.publication_date,
         bm.drm_enabled,
         bm.metadata,
         wba.chain_id,
         wba.contract_address,
         wba.token_standard,
         wba.token_id,
         wba.royalty_bps,
         wba.metadata_uri
       FROM products p
       LEFT JOIN creator_profiles cp ON cp.id = p.creator_profile_id
       LEFT JOIN book_metadata bm ON bm.product_id = p.id
       LEFT JOIN web3_book_assets wba ON wba.product_id = p.id
       WHERE ${identityCondition}
         AND p.is_active = true
         AND p.deleted_at IS NULL
         ${kindCondition}
         ${publicationCondition}`,
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
      })
    }

    const book = result.rows[0]
    const formatResult = await query(
      hasFormatSchema
        ? `SELECT COALESCE(
             json_agg(DISTINCT format_key) FILTER (WHERE format_key IS NOT NULL),
             '[]'::json
           ) AS formats
           FROM digital_assets
           WHERE product_id = $1
             AND asset_type = 'full'
             AND is_active = true`
        : `SELECT COALESCE(
             json_agg(DISTINCT split_part(mime_type, '/', 2)),
             '[]'::json
           ) AS formats
           FROM digital_assets
           WHERE product_id = $1
             AND asset_type = 'full'
             AND is_active = true`,
      [book.id],
    )

    book.available_formats = formatResult.rows[0]?.formats || []

    res.json({
      success: true,
      data: {
        book,
      },
    })
  } catch (error) {
    logger.error('Get book by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch book',
    })
  }
}

export const getBookSampleAccess = async (req: Request, res: Response) => {
  try {
    if (!isBooksFeatureEnabled()) {
      return res.status(404).json({
        success: false,
        error: 'Books feature is not enabled',
      })
    }

    const { id } = req.params
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const identityCondition = isUUID ? 'p.id = $1' : 'p.slug = $1'
    const requestedFormat = normalizeFormatKey(String(req.query.format || ''))
    const hasFormatSchema = await hasDigitalAssetFormatSchema()
    const hasPublicationStatus = await hasPublicationStatusSchema()

    const publicationCondition = hasPublicationStatus
      ? `AND p.publication_status = 'published'`
      : ''

    const bookResult = await query(
      `SELECT p.id, p.slug, bm.preview_url
       FROM products p
       LEFT JOIN book_metadata bm ON bm.product_id = p.id
       WHERE ${identityCondition}
         AND p.is_active = true
         AND p.deleted_at IS NULL
         ${publicationCondition}
       LIMIT 1`,
      [id],
    )

    if (bookResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
      })
    }

    const book = bookResult.rows[0]

    const formatFilter = hasFormatSchema && requestedFormat
      ? `AND da.format_key = $2`
      : ''

    const assetResult = await query(
      `SELECT da.id, da.storage_url, da.mime_type${hasFormatSchema ? ', da.format_key' : ''}
       FROM digital_assets da
       WHERE da.product_id = $1
         AND da.asset_type = 'sample'
         AND da.is_active = true
         ${formatFilter}
       ORDER BY da.created_at DESC
       LIMIT 1`,
      hasFormatSchema && requestedFormat ? [book.id, requestedFormat] : [book.id],
    )

    if (assetResult.rows.length === 0) {
      if (book.preview_url) {
        return res.json({
          success: true,
          data: {
            accessUrl: book.preview_url,
            expiresInSeconds: null,
            type: 'preview_url',
          },
        })
      }

      return res.status(404).json({
        success: false,
        error: 'Sample not available for this book',
      })
    }

    const asset = assetResult.rows[0]
    const secret = process.env.JWT_SECRET || 'development-secret'
    const token = jwt.sign(
      {
        bookId: book.id,
        assetId: asset.id,
        access: 'book_sample',
      },
      secret,
      { expiresIn: 90 },
    )

    const protocol = req.headers['x-forwarded-proto'] || req.protocol
    const host = req.headers.host
    const accessUrl = `${protocol}://${host}/api/v1/books/samples/access/${asset.id}?token=${token}`

    res.json({
      success: true,
      data: {
        accessUrl,
        expiresInSeconds: 90,
        mimeType: asset.mime_type,
        format: hasFormatSchema ? asset.format_key || null : null,
      },
    })
  } catch (error) {
    logger.error('Get book sample access error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate sample access URL',
    })
  }
}

export const resolveBookSampleAccess = async (req: Request, res: Response) => {
  try {
    if (!isBooksFeatureEnabled()) {
      return res.status(404).json({
        success: false,
        error: 'Books feature is not enabled',
      })
    }

    const { assetId } = req.params
    const token = String(req.query.token || '')

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
      })
    }

    const secret = process.env.JWT_SECRET || 'development-secret'
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload

    if (
      decoded.access !== 'book_sample' ||
      decoded.assetId !== assetId ||
      !decoded.bookId
    ) {
      return res.status(403).json({
        success: false,
        error: 'Invalid access token',
      })
    }

    const hasPublicationStatus = await hasPublicationStatusSchema()
    const publicationCondition = hasPublicationStatus
      ? `AND p.publication_status = 'published'`
      : ''

    const assetResult = await query(
      `SELECT da.storage_url
       FROM digital_assets da
       JOIN products p ON p.id = da.product_id
       WHERE da.id = $1
         AND da.product_id = $2
         AND da.asset_type = 'sample'
         AND da.is_active = true
         AND p.is_active = true
         AND p.deleted_at IS NULL
         ${publicationCondition}
       LIMIT 1`,
      [assetId, decoded.bookId],
    )

    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sample asset not found',
      })
    }

    return res.redirect(assetResult.rows[0].storage_url)
  } catch (error) {
    logger.warn('Resolve book sample access error:', error)
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired access token',
    })
  }
}
