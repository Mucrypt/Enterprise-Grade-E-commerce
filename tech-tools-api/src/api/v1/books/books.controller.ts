import { Request, Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

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
    let whereClause = 'WHERE p.is_active = true AND p.deleted_at IS NULL'
    const params: any[] = []
    let idx = 1

    if (booksSchemaEnabled) {
      whereClause += ` AND p.product_kind = 'book'`
    } else {
      whereClause += ` AND p.is_digital = true`
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
    const identityCondition = isUUID ? 'p.id = $1' : 'p.slug = $1'
    const kindCondition = booksSchemaEnabled
      ? `AND p.product_kind = 'book'`
      : `AND p.is_digital = true`

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
         ${kindCondition}`,
      [id],
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
    logger.error('Get book by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch book',
    })
  }
}
