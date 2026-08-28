import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query, getClient } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  processProductImage,
  processVideo,
  validateImageFile,
  validateVideoFile,
} from '../../../utils/media'
import fs from 'fs/promises'
import { recordAdminActivity } from '../../../services/admin-activity.service'

// Real ISO-3166 alpha-2 codes for EU member states -- backs the EU
// WAREHOUSE badge. Checked against a product's primary supplier's
// suppliers.country_code (the exact join fulfillment.service.ts already
// uses for real order routing) -- never guessed, absent when there's no
// supplier link or the code isn't one of these.
// { [attributeId]: value } arrives as a real object on a plain JSON
// request, but multipart/form-data (product image/video uploads) can only
// carry strings -- the admin-dashboard JSON-encodes it in that case (see
// product.service.ts's createProductWithMedia), so this accepts either.
function parseAttributeValues(raw: unknown): Record<string, string> | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, string>) : null
}

const EU_COUNTRY_CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
]

export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      categoryId,
      brandId,
      category, // Support slug-based filtering
      brand, // Support slug-based filtering
      minPrice,
      maxPrice,
      minRating,
      sortBy = 'created_at',
      sortOrder = 'desc',
      featured,
      inStock,
      search,
      attributes,
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    let whereClause = 'WHERE p.is_active = true AND p.deleted_at IS NULL'
    const queryParams: any[] = []
    let paramCount = 1

    // Build filters - support both ID and slug for category
    if (categoryId) {
      whereClause += ` AND p.category_id = $${paramCount}`
      queryParams.push(categoryId)
      paramCount++
    } else if (category) {
      // Look up category by slug
      whereClause += ` AND p.category_id IN (SELECT id FROM categories WHERE slug = $${paramCount})`
      queryParams.push(category)
      paramCount++
    }

    // Support both ID and slug for brand
    if (brandId) {
      whereClause += ` AND p.brand_id = $${paramCount}`
      queryParams.push(brandId)
      paramCount++
    } else if (brand) {
      // Look up brand by slug
      whereClause += ` AND p.brand_id IN (SELECT id FROM brands WHERE slug = $${paramCount})`
      queryParams.push(brand)
      paramCount++
    }

    // Search filter -- ILIKE substring match plus a pg_trgm similarity
    // fallback so a close-but-not-exact query ("flashlite") still
    // surfaces "flashlight" instead of returning nothing. $paramCount is
    // the %wrapped% term for ILIKE, $paramCount+1 is the raw term for
    // similarity().
    if (search) {
      const rawTerm = String(search)
      whereClause += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR p.sku ILIKE $${paramCount} OR similarity(p.name, $${paramCount + 1}) > 0.3)`
      queryParams.push(`%${rawTerm}%`, rawTerm)
      paramCount += 2
    }

    if (minPrice) {
      whereClause += ` AND COALESCE(p.sale_price, p.base_price) >= $${paramCount}`
      queryParams.push(minPrice)
      paramCount++
    }

    if (maxPrice) {
      whereClause += ` AND COALESCE(p.sale_price, p.base_price) <= $${paramCount}`
      queryParams.push(maxPrice)
      paramCount++
    }

    if (featured === 'true') {
      whereClause += ` AND p.is_featured = true`
    }

    if (inStock === 'true') {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM inventory i
        WHERE i.product_id = p.id AND i.available_stock > 0
      )`
    }

    // Requires the product_review_summary join present in both queries
    // below (a real, review-backed rating -- prs.average_rating is 0/NULL
    // for products with no reviews, so this correctly excludes them
    // rather than treating "no rating" as "0 stars").
    if (minRating) {
      whereClause += ` AND prs.average_rating >= $${paramCount}`
      queryParams.push(minRating)
      paramCount++
    }

    // ?attributes[name]=value -- e.g. ?attributes[Voltage]=18V. Self-
    // contained EXISTS per pair, so no extra join is needed just for
    // filtering (the count query stays lean).
    if (attributes && typeof attributes === 'object') {
      for (const [attrName, attrValue] of Object.entries(
        attributes as Record<string, string>,
      )) {
        if (!attrValue) continue
        whereClause += ` AND EXISTS (
          SELECT 1 FROM product_attribute_values pav
          JOIN category_attributes ca ON ca.id = pav.attribute_id
          WHERE pav.product_id = p.id AND ca.name = $${paramCount} AND pav.value = $${paramCount + 1}
        )`
        queryParams.push(attrName, attrValue)
        paramCount += 2
      }
    }

    // Validate sort column
    const validSortColumns = [
      'created_at',
      'updated_at',
      'base_price',
      'sale_price',
      'name',
      'average_rating',
    ]
    const safeSortBy = validSortColumns.includes(sortBy as string)
      ? (sortBy as string)
      : 'created_at'

    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // sale_price is NULL for most non-sale products -- sorting by the raw
    // column would push them all to one end regardless of their real,
    // effective price. Mirrors the price *filter* above, which already
    // gets this right via COALESCE. average_rating lives on the joined
    // product_review_summary row (prs), not on products (p) itself.
    const orderByExpression =
      safeSortBy === 'sale_price' || safeSortBy === 'base_price'
        ? `COALESCE(p.sale_price, p.base_price)`
        : safeSortBy === 'average_rating'
          ? `COALESCE(prs.average_rating, 0)`
          : `p.${safeSortBy}`

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM products p
       LEFT JOIN product_review_summary prs ON prs.product_id = p.id
       ${whereClause}`,
      queryParams,
    )
    const total = parseInt(countResult.rows[0].count)

    // Get products with joins for category and brand
    const productsResult = await query(
      `SELECT
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        b.name as brand_name,
        b.slug as brand_slug,
        COALESCE(prs.average_rating, 0) as average_rating,
        COALESCE(prs.total_reviews, 0) as review_count,
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
        ) as total_stock,
        (
          SELECT json_agg(json_build_object(
            'attribute_id', pav.attribute_id,
            'name', ca.name,
            'value', pav.value,
            'unit', ca.unit
          ) ORDER BY ca.display_order, ca.name)
          FROM product_attribute_values pav
          JOIN category_attributes ca ON ca.id = pav.attribute_id
          WHERE pav.product_id = p.id
        ) as attribute_values,
        -- Real merchandising signals, all real data or absent -- never
        -- fabricated/guessed. Frontend applies the actual badge
        -- thresholds against these raw numbers so they're tunable
        -- without a migration.
        (p.created_at >= NOW() - INTERVAL '30 days') as is_new,
        COALESCE(sales90.units_sold, 0) as units_sold_90d,
        COALESCE(sales7.units_sold, 0) as units_sold_7d,
        COALESCE(views7.views, 0) as views_7d,
        (supplier_country.country_code = ANY($${paramCount})) as is_eu_warehouse
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN product_review_summary prs ON prs.product_id = p.id
       LEFT JOIN (
         SELECT oi.product_id, SUM(oi.quantity) as units_sold
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.order_status NOT IN ('cancelled', 'refunded')
           AND o.created_at >= NOW() - INTERVAL '90 days'
         GROUP BY oi.product_id
       ) sales90 ON sales90.product_id = p.id
       LEFT JOIN (
         SELECT oi.product_id, SUM(oi.quantity) as units_sold
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.order_status NOT IN ('cancelled', 'refunded')
           AND o.created_at >= NOW() - INTERVAL '7 days'
         GROUP BY oi.product_id
       ) sales7 ON sales7.product_id = p.id
       LEFT JOIN (
         SELECT product_id, COUNT(*) as views
         FROM events_core
         WHERE event_type = 'product_view' AND event_time >= NOW() - INTERVAL '7 days'
         GROUP BY product_id
       ) views7 ON views7.product_id = p.id
       LEFT JOIN LATERAL (
         SELECT s.country_code
         FROM supplier_products sp
         JOIN suppliers s ON s.id = sp.supplier_id
         WHERE sp.product_id = p.id AND sp.is_available = true
         ORDER BY sp.is_primary DESC, sp.cost_price ASC
         LIMIT 1
       ) supplier_country ON true
       ${whereClause}
       ORDER BY ${orderByExpression} ${safeSortOrder}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, EU_COUNTRY_CODES, limit, offset],
    )

    res.json({
      success: true,
      data: {
        products: productsResult.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get products error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
    })
  }
}

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Check if id is a UUID or a slug
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const whereCondition = isUUID ? 'p.id = $1' : 'p.slug = $1'

    const result = await query(
      `SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        b.name as brand_name,
        b.slug as brand_slug,
        (
          SELECT json_agg(json_build_object(
            'id', pm.id,
            'image_url', pm.url,
            'url', pm.url,
            'type', pm.type,
            'alt_text', pm.alt_text,
            'is_primary', pm.is_primary,
            'position', pm.position,
            'cdn_urls', pm.cdn_urls
          ) ORDER BY pm.is_primary DESC, pm.position)
          FROM product_media pm
          WHERE pm.product_id = p.id AND pm.type = 'image'
        ) as images,
        (
          SELECT json_agg(json_build_object(
            'id', pm.id,
            'url', pm.url,
            'type', pm.type,
            'alt_text', pm.alt_text,
            'is_primary', pm.is_primary,
            'position', pm.position,
            'cdn_urls', pm.cdn_urls
          ) ORDER BY pm.position)
          FROM product_media pm
          WHERE pm.product_id = p.id
        ) as media,
        (
          SELECT json_agg(json_build_object(
            'id', ps.id,
            'spec_key', ps.spec_key,
            'spec_value', ps.spec_value,
            'spec_group', ps.spec_group,
            'display_order', ps.display_order
          ) ORDER BY ps.spec_group, ps.display_order)
          FROM product_specifications ps
          WHERE ps.product_id = p.id
        ) as specifications,
        (
          SELECT json_agg(json_build_object(
            'attribute_id', pav.attribute_id,
            'name', ca.name,
            'value', pav.value,
            'unit', ca.unit
          ) ORDER BY ca.display_order, ca.name)
          FROM product_attribute_values pav
          JOIN category_attributes ca ON ca.id = pav.attribute_id
          WHERE pav.product_id = p.id
        ) as attribute_values,
        (
          SELECT json_agg(json_build_object(
            'id', i.id,
            'warehouse_location', i.warehouse_location,
            'current_stock', i.current_stock,
            'reserved_stock', i.reserved_stock,
            'available_stock', i.available_stock,
            'low_stock_threshold', i.low_stock_threshold
          ))
          FROM inventory i
          WHERE i.product_id = p.id
        ) as inventory,
        (
          SELECT COALESCE(SUM(i.available_stock), 0)
          FROM inventory i
          WHERE i.product_id = p.id
        ) as total_stock,
        (
          SELECT COALESCE(AVG(r.rating), 0)
          FROM reviews r
          WHERE r.product_id = p.id AND r.is_approved = true
        ) as average_rating,
        (
          SELECT COUNT(*)
          FROM reviews r
          WHERE r.product_id = p.id AND r.is_approved = true
        ) as review_count,
        (
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.product_id = p.id AND o.order_status NOT IN ('cancelled', 'refunded')
        ) as units_sold
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE ${whereCondition} AND p.deleted_at IS NULL`,
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      })
    }

    const product = result.rows[0]

    // Get variations if any - use the actual product.id from the result
    const variationsResult = await query(
      `SELECT * FROM product_variations 
       WHERE product_id = $1 AND is_active = true
       ORDER BY created_at`,
      [product.id],
    )

    product.variations = variationsResult.rows

    res.json({
      success: true,
      data: {
        product,
      },
    })
  } catch (error) {
    logger.error('Get product by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
    })
  }
}

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const {
      sku,
      name,
      slug,
      description,
      shortDescription,
      brandId,
      categoryId,
      basePrice,
      salePrice,
      costPrice,
      taxRate = 0,
      stockQuantity = 0,
      weight,
      weightUnit = 'kg',
      length,
      width,
      height,
      dimensionsUnit = 'cm',
      isActive = true,
      isDigital = false,
      isFeatured = false,
      isBackorderAllowed = false,
      minOrderQuantity = 1,
      maxOrderQuantity,
      metaTitle,
      metaDescription,
      deliveryTemplateId = null,
      // { [attributeId]: value } -- category_attributes/product_attribute_values,
      // deliberately separate from the free-text product_specifications table.
      attributeValues,
      // Media-related fields
      imageDescriptions, // JSON string array of descriptions for each image
      videoPurpose, // purpose for video (demo, tutorial, unboxing, etc.)
      videoTitle,
      videoDescription,
    } = req.body

    // Check if SKU already exists
    const existingSku = await query('SELECT id FROM products WHERE sku = $1', [
      sku,
    ])

    if (existingSku.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Product with this SKU already exists',
      })
    }

    // Check if slug already exists
    const existingSlug = await query(
      'SELECT id FROM products WHERE slug = $1',
      [slug],
    )

    if (existingSlug.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Product with this slug already exists',
      })
    }

    // Create the product and its inventory record together, in one
    // transaction. Previously only `products.stock_quantity` was written
    // here and no `inventory` row was ever created -- checkout only ever
    // trusts `inventory.available_stock` (see order.controller.ts), so
    // every product created through this endpoint had real available_stock
    // of 0 forever, regardless of the stock quantity entered here, and
    // would fail checkout with "Insufficient stock" immediately.
    const client = await getClient()
    let product: any
    try {
      await client.query('BEGIN')

      const result = await client.query(
        `INSERT INTO products (
          sku, name, slug, description, short_description,
          brand_id, category_id, base_price, sale_price, cost_price,
          tax_rate, stock_quantity, weight, weight_unit, length, width, height,
          dimensions_unit, is_active, is_digital, is_featured,
          is_backorder_allowed, min_order_quantity, max_order_quantity,
          meta_title, meta_description, delivery_template_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
        RETURNING *`,
        [
          sku,
          name,
          slug,
          description,
          shortDescription,
          brandId,
          categoryId,
          basePrice,
          salePrice,
          costPrice,
          taxRate,
          stockQuantity,
          weight,
          weightUnit,
          length,
          width,
          height,
          dimensionsUnit,
          isActive,
          isDigital,
          isFeatured,
          isBackorderAllowed,
          minOrderQuantity,
          maxOrderQuantity,
          metaTitle,
          metaDescription,
          deliveryTemplateId,
        ],
      )

      product = result.rows[0]

      await client.query(
        `INSERT INTO inventory (product_id, current_stock, reserved_stock)
         VALUES ($1, $2, 0)`,
        [product.id, stockQuantity],
      )

      const parsedAttributeValues = parseAttributeValues(attributeValues)
      if (parsedAttributeValues) {
        for (const [attributeId, value] of Object.entries(parsedAttributeValues)) {
          if (value === undefined || value === null || value === '') continue
          await client.query(
            `INSERT INTO product_attribute_values (product_id, attribute_id, value)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, attribute_id) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [product.id, attributeId, String(value)],
          )
        }
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error('Create product error (transaction rolled back):', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to create product',
      })
    } finally {
      client.release()
    }

    const productId = product.id

    // Process uploaded media files if any
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined
    const uploadedMedia: any[] = []

    try {
      // Process images
      if (files?.images && files.images.length > 0) {
        const imageDescArray = imageDescriptions
          ? JSON.parse(imageDescriptions)
          : []

        for (let i = 0; i < files.images.length; i++) {
          const file = files.images[i]

          // Validate file
          const validation = validateImageFile(file)
          if (!validation.valid) {
            throw new Error(`Image ${i + 1}: ${validation.error}`)
          }

          // Process and optimize image
          const processed = await processProductImage(file)

          // Prepare CDN URLs object with all optimized sizes
          const cdnUrls = {
            original: processed.original.url,
            thumbnail: processed.optimized.thumbnail?.url || '',
            small: processed.optimized.small?.url || '',
            medium: processed.optimized.medium?.url || '',
            large: processed.optimized.large?.url || '',
          }

          // Save to database
          const mediaResult = await query(
            `INSERT INTO product_media (
              product_id, type, url, cdn_urls, 
              file_size, alt_text, title, position, is_primary, format
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *`,
            [
              productId,
              'image',
              processed.original.url,
              JSON.stringify(cdnUrls),
              processed.original.fileSize,
              `${name} - Image ${i + 1}`,
              imageDescArray[i]?.title || `${name} - Image ${i + 1}`,
              i, // position based on upload order
              i === 0, // first image is primary by default
              file.mimetype?.split('/')[1] || 'jpg',
            ],
          )

          uploadedMedia.push(mediaResult.rows[0])
        }
      }

      // Process videos
      if (files?.videos && files.videos.length > 0) {
        for (let i = 0; i < files.videos.length; i++) {
          const file = files.videos[i]

          // Validate file
          const validation = validateVideoFile(file)
          if (!validation.valid) {
            throw new Error(`Video ${i + 1}: ${validation.error}`)
          }

          // Process video
          const processed = await processVideo(file, 'product')

          // Prepare CDN URLs object with video and thumbnail
          const cdnUrls = {
            url: processed.url,
            thumbnailUrl: processed.thumbnailUrl,
          }

          // Save to database
          const mediaResult = await query(
            `INSERT INTO product_media (
              product_id, type, url, cdn_urls, 
              file_size, title, position, format, duration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *`,
            [
              productId,
              'video',
              processed.url,
              JSON.stringify(cdnUrls),
              processed.fileSize,
              videoTitle || `${name} - Video`,
              files.images ? files.images.length + i : i, // position after images
              file.mimetype?.split('/')[1] || 'mp4',
              null, // duration not implemented yet in processVideo
            ],
          )

          uploadedMedia.push(mediaResult.rows[0])
        }
      }
    } catch (mediaError) {
      logger.error(
        'Media processing error during product creation:',
        mediaError,
      )
      // Product is already created, just log the media error
      // Admin can add media later through the media endpoint
    }

    logger.info('Product created:', {
      productId: product.id,
      name: product.name,
      mediaCount: uploadedMedia.length,
      createdBy: req.user?.userId,
    })

    // Fetch complete product with media
    const completeProduct = await query(
      `SELECT p.*, 
        (SELECT json_agg(pm ORDER BY pm.position) 
         FROM product_media pm 
         WHERE pm.product_id = p.id) as media
       FROM products p 
       WHERE p.id = $1`,
      [productId],
    )

    res.status(201).json({
      success: true,
      data: {
        product: completeProduct.rows[0],
      },
      message:
        uploadedMedia.length > 0
          ? `Product created successfully with ${uploadedMedia.length} media file(s)`
          : 'Product created successfully',
    })
  } catch (error) {
    logger.error('Create product error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
    })
  }
}

// Additional controller methods would follow the same pattern...
// For brevity, I'm showing the pattern but you should implement:
// updateProduct, deleteProduct, getProductVariations, etc.

export const searchProducts = async (req: Request, res: Response) => {
  try {
    const { q, page = 1, limit = 20 } = req.query

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long',
      })
    }

    const offset = (Number(page) - 1) * Number(limit)
    const rawTerm = q.trim()
    const searchTerm = `%${rawTerm}%`

    // Get total count -- $2 is the raw (unwrapped) term for the pg_trgm
    // similarity() fallback, same typo-tolerance fix as getProducts.
    const countResult = await query(
      `SELECT COUNT(*) FROM products p
       WHERE p.is_active = true
         AND p.deleted_at IS NULL
         AND (p.name ILIKE $1 OR p.description ILIKE $1 OR p.sku ILIKE $1 OR similarity(p.name, $2) > 0.3)`,
      [searchTerm, rawTerm],
    )
    const total = parseInt(countResult.rows[0].count)

    // Search products
    const result = await query(
      `SELECT 
        p.*,
        c.name as category_name,
        b.name as brand_name,
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
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.is_active = true
         AND p.deleted_at IS NULL
         AND (p.name ILIKE $1 OR p.description ILIKE $1 OR p.sku ILIKE $1 OR similarity(p.name, $2) > 0.3)
       ORDER BY
         CASE
           WHEN p.name ILIKE $1 THEN 1
           WHEN p.sku ILIKE $1 THEN 2
           WHEN similarity(p.name, $2) > 0.3 THEN 3
           ELSE 4
         END,
         similarity(p.name, $2) DESC,
         p.created_at DESC
       LIMIT $3 OFFSET $4`,
      [searchTerm, rawTerm, limit, offset],
    )

    res.json({
      success: true,
      data: {
        products: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Search products error:', error)
    res.status(500).json({
      success: false,
      error: 'Search failed',
    })
  }
}

// Get related products by category and brand
export const getRelatedProducts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { limit = 8 } = req.query

    // First get the product to find its category and brand
    const productResult = await query(
      'SELECT id, category_id, brand_id FROM products WHERE id = $1 AND deleted_at IS NULL',
      [id],
    )

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      })
    }

    const product = productResult.rows[0]

    // Get related products by same category or brand, excluding current product
    const result = await query(
      `SELECT 
        p.id,
        p.name,
        p.slug,
        p.base_price,
        p.sale_price,
        p.is_featured,
        c.name as category_name,
        c.slug as category_slug,
        b.name as brand_name,
        b.slug as brand_slug,
        (
          SELECT json_agg(
            json_build_object(
              'id', pm.id,
              'url', pm.url,
              'image_url', pm.url,
              'alt_text', pm.alt_text,
              'is_primary', pm.is_primary
            ) ORDER BY pm.is_primary DESC, pm.position
          )
          FROM product_media pm
          WHERE pm.product_id = p.id AND pm.type = 'image'
          LIMIT 3
        ) as images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = true 
        AND p.deleted_at IS NULL
        AND p.id != $1
        AND (p.category_id = $2 OR p.brand_id = $3)
      ORDER BY 
        CASE WHEN p.category_id = $2 AND p.brand_id = $3 THEN 1
             WHEN p.category_id = $2 THEN 2
             WHEN p.brand_id = $3 THEN 3
             ELSE 4
        END,
        p.is_featured DESC,
        p.created_at DESC
      LIMIT $4`,
      [id, product.category_id, product.brand_id, limit],
    )

    res.json({
      success: true,
      data: {
        products: result.rows.map((row) => ({
          ...row,
          images: row.images || [],
        })),
      },
    })
  } catch (error) {
    logger.error('Get related products error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch related products',
    })
  }
}

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const productId = req.params.productId

    // Check if product exists
    const existingProduct = await query(
      'SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL',
      [productId],
    )

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      })
    }

    const {
      sku,
      name,
      slug,
      description,
      shortDescription,
      brandId,
      categoryId,
      basePrice,
      salePrice,
      costPrice,
      taxRate,
      stockQuantity,
      weight,
      weightUnit,
      length,
      width,
      height,
      dimensionsUnit,
      isActive,
      isDigital,
      isFeatured,
      isBackorderAllowed,
      minOrderQuantity,
      maxOrderQuantity,
      metaTitle,
      metaDescription,
      deliveryTemplateId,
      attributeValues,
    } = req.body

    // Check if SKU is being changed and if new SKU exists
    if (sku && sku !== existingProduct.rows[0].sku) {
      const existingSku = await query(
        'SELECT id FROM products WHERE sku = $1 AND id != $2',
        [sku, productId],
      )
      if (existingSku.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Product with this SKU already exists',
        })
      }
    }

    // Check if slug is being changed and if new slug exists
    if (slug && slug !== existingProduct.rows[0].slug) {
      const existingSlug = await query(
        'SELECT id FROM products WHERE slug = $1 AND id != $2',
        [slug, productId],
      )
      if (existingSlug.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Product with this slug already exists',
        })
      }
    }

    // Build dynamic update query
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const fieldsToUpdate: { [key: string]: any } = {
      sku,
      name,
      slug,
      description,
      short_description: shortDescription,
      brand_id: brandId,
      category_id: categoryId,
      base_price: basePrice,
      sale_price: salePrice,
      cost_price: costPrice,
      tax_rate: taxRate,
      stock_quantity: stockQuantity,
      weight,
      weight_unit: weightUnit,
      length,
      width,
      height,
      dimensions_unit: dimensionsUnit,
      is_active: isActive,
      is_digital: isDigital,
      is_featured: isFeatured,
      is_backorder_allowed: isBackorderAllowed,
      min_order_quantity: minOrderQuantity,
      max_order_quantity: maxOrderQuantity,
      meta_title: metaTitle,
      meta_description: metaDescription,
      delivery_template_id: deliveryTemplateId,
    }

    for (const [field, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    // Always update updated_at
    updateFields.push(`updated_at = NOW()`)

    if (updateFields.length === 1) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      })
    }

    values.push(productId)

    const result = await query(
      `UPDATE products SET ${updateFields.join(
        ', ',
      )} WHERE id = $${paramIndex} RETURNING *`,
      values,
    )

    // The Products list page's stock badge reads SUM(inventory.available_stock),
    // not products.stock_quantity -- a genuinely separate column that this
    // endpoint used to leave untouched, so editing "Stock Quantity" here and
    // saving never moved the badge (confirmed via a live test, 2026-08-24).
    // Keep them in sync: update every inventory row for this product, or
    // seed one if none exists yet (e.g. a product committed via the
    // sourcing importer, which always starts with a single current_stock=0 row).
    if (stockQuantity !== undefined) {
      const inventoryUpdate = await query(
        `UPDATE inventory SET current_stock = $2, updated_at = NOW() WHERE product_id = $1`,
        [productId, stockQuantity],
      )
      if (inventoryUpdate.rowCount === 0) {
        await query(`INSERT INTO inventory (product_id, current_stock) VALUES ($1, $2)`, [productId, stockQuantity])
      }
    }

    const parsedAttributeValues = parseAttributeValues(attributeValues)
    if (parsedAttributeValues) {
      for (const [attributeId, value] of Object.entries(parsedAttributeValues)) {
        if (value === undefined || value === null || value === '') {
          await query(
            'DELETE FROM product_attribute_values WHERE product_id = $1 AND attribute_id = $2',
            [productId, attributeId],
          )
          continue
        }
        await query(
          `INSERT INTO product_attribute_values (product_id, attribute_id, value)
           VALUES ($1, $2, $3)
           ON CONFLICT (product_id, attribute_id) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [productId, attributeId, String(value)],
        )
      }
    }

    // Process uploaded media files if any
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined
    const uploadedMedia: any[] = []

    if (files) {
      const { imageDescriptions, videoTitle, videoDescription, videoPurpose } =
        req.body

      try {
        // Process images
        if (files.images && files.images.length > 0) {
          const imageDescArray = imageDescriptions
            ? JSON.parse(imageDescriptions)
            : []

          // Get current max position
          const maxPosResult = await query(
            'SELECT COALESCE(MAX(position), -1) as max_pos FROM product_media WHERE product_id = $1',
            [productId],
          )
          let position = maxPosResult.rows[0].max_pos + 1

          for (let i = 0; i < files.images.length; i++) {
            const file = files.images[i]

            const validation = validateImageFile(file)
            if (!validation.valid) {
              throw new Error(`Image ${i + 1}: ${validation.error}`)
            }

            const processed = await processProductImage(file)

            const cdnUrls = {
              original: processed.original.url,
              thumbnail: processed.optimized.thumbnail?.url || '',
              small: processed.optimized.small?.url || '',
              medium: processed.optimized.medium?.url || '',
              large: processed.optimized.large?.url || '',
            }

            const mediaResult = await query(
              `INSERT INTO product_media (
                product_id, type, url, cdn_urls, 
                file_size, alt_text, title, position, is_primary, format
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
              RETURNING *`,
              [
                productId,
                'image',
                processed.original.url,
                JSON.stringify(cdnUrls),
                processed.original.fileSize,
                `${name || existingProduct.rows[0].name} - Image ${
                  position + 1
                }`,
                imageDescArray[i]?.title ||
                  `${name || existingProduct.rows[0].name} - Image ${
                    position + 1
                  }`,
                position,
                false, // Don't override primary on update
                file.mimetype?.split('/')[1] || 'jpg',
              ],
            )

            uploadedMedia.push(mediaResult.rows[0])
            position++
          }
        }

        // Process videos
        if (files.videos && files.videos.length > 0) {
          const maxPosResult = await query(
            'SELECT COALESCE(MAX(position), -1) as max_pos FROM product_media WHERE product_id = $1',
            [productId],
          )
          let position = maxPosResult.rows[0].max_pos + 1

          for (let i = 0; i < files.videos.length; i++) {
            const file = files.videos[i]

            const validation = validateVideoFile(file)
            if (!validation.valid) {
              throw new Error(`Video ${i + 1}: ${validation.error}`)
            }

            const processed = await processVideo(file, 'product')

            const cdnUrls = {
              url: processed.url,
              thumbnailUrl: processed.thumbnailUrl,
            }

            const mediaResult = await query(
              `INSERT INTO product_media (
                product_id, type, url, cdn_urls, 
                file_size, title, position, format, duration
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
              RETURNING *`,
              [
                productId,
                'video',
                processed.url,
                JSON.stringify(cdnUrls),
                processed.fileSize,
                videoTitle || `${name || existingProduct.rows[0].name} - Video`,
                position,
                file.mimetype?.split('/')[1] || 'mp4',
                null, // duration
              ],
            )

            uploadedMedia.push(mediaResult.rows[0])
            position++
          }
        }
      } catch (mediaError) {
        logger.error(
          'Media processing error during product update:',
          mediaError,
        )
      }
    }

    // Fetch complete product with media
    const completeProduct = await query(
      `SELECT p.*, 
        c.name as category_name,
        b.name as brand_name,
        (SELECT json_agg(pm ORDER BY pm.position) 
         FROM product_media pm 
         WHERE pm.product_id = p.id) as media
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.id = $1`,
      [productId],
    )

    logger.info('Product updated:', {
      productId,
      updatedBy: req.user?.userId,
      mediaAdded: uploadedMedia.length,
    })

    if (req.user?.userId) {
      const before = existingProduct.rows[0]
      const after = completeProduct.rows[0]
      recordAdminActivity({
        actorUserId: req.user.userId,
        action: 'product_updated',
        resourceType: 'products',
        resourceId: productId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          priceChanged: basePrice !== undefined || salePrice !== undefined,
          stockChanged: stockQuantity !== undefined,
          before: {
            basePrice: before.base_price,
            salePrice: before.sale_price,
            stockQuantity: before.stock_quantity,
          },
          after: {
            basePrice: after.base_price,
            salePrice: after.sale_price,
            stockQuantity: after.stock_quantity,
          },
        },
      })
    }

    res.json({
      success: true,
      data: {
        product: completeProduct.rows[0],
      },
      message:
        uploadedMedia.length > 0
          ? `Product updated successfully with ${uploadedMedia.length} new media file(s)`
          : 'Product updated successfully',
    })
  } catch (error) {
    logger.error('Update product error:', error)
    res.status(500).json({
      success: false,
      error: 'Update failed',
    })
  }
}

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const productId = req.params.productId
    const { permanent = false } = req.query

    // Check if product exists
    const existingProduct = await query(
      'SELECT * FROM products WHERE id = $1',
      [productId],
    )

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      })
    }

    const product = existingProduct.rows[0]

    if (permanent === 'true') {
      // Hard delete - remove all related data first
      await query('DELETE FROM product_media WHERE product_id = $1', [
        productId,
      ])
      await query('DELETE FROM product_specifications WHERE product_id = $1', [
        productId,
      ])
      await query('DELETE FROM product_variations WHERE product_id = $1', [
        productId,
      ])
      await query('DELETE FROM inventory WHERE product_id = $1', [productId])
      await query('DELETE FROM products WHERE id = $1', [productId])

      logger.info('Product permanently deleted:', {
        productId,
        name: product.name,
        deletedBy: req.user?.userId,
      })

      res.json({
        success: true,
        message: 'Product permanently deleted',
      })
    } else {
      // Soft delete - set deleted_at timestamp
      await query(
        'UPDATE products SET deleted_at = NOW(), is_active = false, updated_at = NOW() WHERE id = $1',
        [productId],
      )

      logger.info('Product soft deleted:', {
        productId,
        name: product.name,
        deletedBy: req.user?.userId,
      })

      res.json({
        success: true,
        message: 'Product deleted successfully',
        data: {
          productId,
          deletedAt: new Date().toISOString(),
        },
      })
    }
  } catch (error) {
    logger.error('Delete product error:', error)
    res.status(500).json({
      success: false,
      error: 'Delete failed',
    })
  }
}

// Restore a soft-deleted product
export const restoreProduct = async (req: AuthRequest, res: Response) => {
  try {
    const productId = req.params.productId

    // Check if product exists and is deleted
    const existingProduct = await query(
      'SELECT * FROM products WHERE id = $1 AND deleted_at IS NOT NULL',
      [productId],
    )

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deleted product not found',
      })
    }

    await query(
      'UPDATE products SET deleted_at = NULL, updated_at = NOW() WHERE id = $1',
      [productId],
    )

    // Fetch restored product
    const restoredProduct = await query(
      `SELECT p.*, 
        c.name as category_name,
        b.name as brand_name
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.id = $1`,
      [productId],
    )

    logger.info('Product restored:', {
      productId,
      restoredBy: req.user?.userId,
    })

    res.json({
      success: true,
      message: 'Product restored successfully',
      data: {
        product: restoredProduct.rows[0],
      },
    })
  } catch (error) {
    logger.error('Restore product error:', error)
    res.status(500).json({
      success: false,
      error: 'Restore failed',
    })
  }
}

// Bulk operations
export const bulkDeleteProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { productIds, permanent = false } = req.body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product IDs are required',
      })
    }

    if (permanent) {
      // Hard delete
      for (const productId of productIds) {
        await query('DELETE FROM product_media WHERE product_id = $1', [
          productId,
        ])
        await query(
          'DELETE FROM product_specifications WHERE product_id = $1',
          [productId],
        )
        await query('DELETE FROM product_variations WHERE product_id = $1', [
          productId,
        ])
        await query('DELETE FROM inventory WHERE product_id = $1', [productId])
      }

      await query('DELETE FROM products WHERE id = ANY($1)', [productIds])

      logger.info('Products permanently deleted:', {
        count: productIds.length,
        deletedBy: req.user?.userId,
      })

      res.json({
        success: true,
        message: `${productIds.length} products permanently deleted`,
      })
    } else {
      // Soft delete
      await query(
        'UPDATE products SET deleted_at = NOW(), is_active = false, updated_at = NOW() WHERE id = ANY($1)',
        [productIds],
      )

      logger.info('Products bulk soft deleted:', {
        count: productIds.length,
        deletedBy: req.user?.userId,
      })

      res.json({
        success: true,
        message: `${productIds.length} products deleted successfully`,
      })
    }
  } catch (error) {
    logger.error('Bulk delete products error:', error)
    res.status(500).json({
      success: false,
      error: 'Bulk delete failed',
    })
  }
}

export const bulkUpdateProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { productIds, updates } = req.body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product IDs are required',
      })
    }

    const allowedBulkFields = [
      'is_active',
      'is_featured',
      'category_id',
      'brand_id',
      'tax_rate',
    ]
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const [field, value] of Object.entries(updates)) {
      const snakeField = field.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      )
      if (allowedBulkFields.includes(snakeField) && value !== undefined) {
        updateFields.push(`${snakeField} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      })
    }

    updateFields.push(`updated_at = NOW()`)
    values.push(productIds)

    await query(
      `UPDATE products SET ${updateFields.join(
        ', ',
      )} WHERE id = ANY($${paramIndex})`,
      values,
    )

    logger.info('Products bulk updated:', {
      count: productIds.length,
      fields: Object.keys(updates),
      updatedBy: req.user?.userId,
    })

    res.json({
      success: true,
      message: `${productIds.length} products updated successfully`,
    })
  } catch (error) {
    logger.error('Bulk update products error:', error)
    res.status(500).json({
      success: false,
      error: 'Bulk update failed',
    })
  }
}

export const getProductVariations = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId

    res.json({
      success: true,
      message: 'Get product variations - Not yet implemented',
      data: { productId, variations: [] },
    })
  } catch (error) {
    logger.error('Get variations error:', error)
    res.status(500).json({
      success: false,
      error: 'Get variations failed',
    })
  }
}

export const addProductVariation = async (req: AuthRequest, res: Response) => {
  try {
    const productId = req.params.productId
    const variation = req.body

    res.json({
      success: true,
      message: 'Add product variation - Not yet implemented',
      data: { productId, variation },
    })
  } catch (error) {
    logger.error('Add variation error:', error)
    res.status(500).json({
      success: false,
      error: 'Add variation failed',
    })
  }
}

export const updateProductVariation = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { productId, variationId } = req.params
    const updates = req.body

    res.json({
      success: true,
      message: 'Update product variation - Not yet implemented',
      data: { productId, variationId, updates },
    })
  } catch (error) {
    logger.error('Update variation error:', error)
    res.status(500).json({
      success: false,
      error: 'Update variation failed',
    })
  }
}

export const deleteProductVariation = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { productId, variationId } = req.params

    res.json({
      success: true,
      message: 'Delete product variation - Not yet implemented',
      data: { productId, variationId },
    })
  } catch (error) {
    logger.error('Delete variation error:', error)
    res.status(500).json({
      success: false,
      error: 'Delete variation failed',
    })
  }
}
