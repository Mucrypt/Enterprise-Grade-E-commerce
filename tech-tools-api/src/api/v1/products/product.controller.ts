import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  processProductImage,
  processVideo,
  validateImageFile,
  validateVideoFile,
} from '../../../utils/media'
import fs from 'fs/promises'

export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      categoryId,
      brandId,
      minPrice,
      maxPrice,
      sortBy = 'created_at',
      sortOrder = 'desc',
      featured,
      inStock,
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    let whereClause = 'WHERE p.is_active = true AND p.deleted_at IS NULL'
    const queryParams: any[] = []
    let paramCount = 1

    // Build filters
    if (categoryId) {
      whereClause += ` AND p.category_id = $${paramCount}`
      queryParams.push(categoryId)
      paramCount++
    }

    if (brandId) {
      whereClause += ` AND p.brand_id = $${paramCount}`
      queryParams.push(brandId)
      paramCount++
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

    // Validate sort column
    const validSortColumns = [
      'created_at',
      'updated_at',
      'base_price',
      'sale_price',
      'name',
    ]
    const safeSortBy = validSortColumns.includes(sortBy as string)
      ? sortBy
      : 'created_at'

    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM products p ${whereClause}`,
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
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', pi.id,
                'image_url', pi.image_url,
                'alt_text', pi.alt_text,
                'is_primary', pi.is_primary,
                'display_order', pi.display_order
              ) ORDER BY pi.is_primary DESC, pi.display_order
            ),
            '[]'::json
          )
          FROM (
            SELECT id, image_url, alt_text, is_primary, display_order
            FROM product_images
            WHERE product_id = p.id
            ORDER BY is_primary DESC, display_order
            LIMIT 5
          ) pi
        ) as images,
        (
          SELECT COALESCE(SUM(i.available_stock), 0)
          FROM inventory i
          WHERE i.product_id = p.id
        ) as total_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       ${whereClause}
       ORDER BY p.${safeSortBy} ${safeSortOrder}
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...queryParams, limit, offset],
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

    const result = await query(
      `SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        b.name as brand_name,
        b.slug as brand_slug,
        (
          SELECT json_agg(json_build_object(
            'id', pi.id,
            'image_url', pi.image_url,
            'alt_text', pi.alt_text,
            'is_primary', pi.is_primary,
            'display_order', pi.display_order
          ) ORDER BY pi.is_primary DESC, pi.display_order)
          FROM product_images pi
          WHERE pi.product_id = p.id
        ) as images,
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
          SELECT COALESCE(AVG(r.rating), 0)
          FROM reviews r
          WHERE r.product_id = p.id AND r.is_approved = true
        ) as average_rating,
        (
          SELECT COUNT(*)
          FROM reviews r
          WHERE r.product_id = p.id AND r.is_approved = true
        ) as review_count
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.id = $1 AND p.is_active = true AND p.deleted_at IS NULL`,
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      })
    }

    // Get variations if any
    const variationsResult = await query(
      `SELECT * FROM product_variations 
       WHERE product_id = $1 AND is_active = true
       ORDER BY created_at`,
      [id],
    )

    const product = result.rows[0]
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

    // Create the product first
    const result = await query(
      `INSERT INTO products (
        sku, name, slug, description, short_description,
        brand_id, category_id, base_price, sale_price, cost_price,
        tax_rate, weight, weight_unit, length, width, height,
        dimensions_unit, is_active, is_digital, is_featured,
        is_backorder_allowed, min_order_quantity, max_order_quantity,
        meta_title, meta_description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
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
      ],
    )

    const product = result.rows[0]
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
              product_id, media_type, file_path, cdn_urls, 
              file_size, mime_type, alt_text, title, description, position, is_primary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING *`,
            [
              productId,
              'image',
              processed.original.url,
              JSON.stringify(cdnUrls),
              processed.original.fileSize,
              file.mimetype,
              `${name} - Image ${i + 1}`,
              imageDescArray[i]?.title || `${name} - Image ${i + 1}`,
              imageDescArray[i]?.description || '',
              i, // position based on upload order
              i === 0, // first image is primary by default
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
              product_id, media_type, file_path, cdn_urls, 
              file_size, mime_type, title, description, 
              video_duration, position
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *`,
            [
              productId,
              'video',
              processed.url,
              JSON.stringify(cdnUrls),
              processed.fileSize,
              file.mimetype,
              videoTitle || `${name} - Video`,
              videoDescription || videoPurpose || '',
              null, // duration not implemented yet in processVideo
              files.images ? files.images.length + i : i, // position after images
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
    const searchTerm = `%${q.trim()}%`

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM products p
       WHERE p.is_active = true 
         AND p.deleted_at IS NULL
         AND (p.name ILIKE $1 OR p.description ILIKE $1 OR p.sku ILIKE $1)`,
      [searchTerm],
    )
    const total = parseInt(countResult.rows[0].count)

    // Search products
    const result = await query(
      `SELECT 
        p.*,
        c.name as category_name,
        b.name as brand_name,
        (
          SELECT image_url 
          FROM product_images pi 
          WHERE pi.product_id = p.id AND pi.is_primary = true 
          LIMIT 1
        ) as primary_image
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.is_active = true 
         AND p.deleted_at IS NULL
         AND (p.name ILIKE $1 OR p.description ILIKE $1 OR p.sku ILIKE $1)
       ORDER BY 
         CASE 
           WHEN p.name ILIKE $1 THEN 1
           WHEN p.sku ILIKE $1 THEN 2
           ELSE 3
         END,
         p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [searchTerm, limit, offset],
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

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const productId = req.params.productId
    const updates = req.body

    res.json({
      success: true,
      message: 'Update product - Not yet implemented',
      data: { productId, updates },
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

    res.json({
      success: true,
      message: 'Delete product - Not yet implemented',
      data: { productId },
    })
  } catch (error) {
    logger.error('Delete product error:', error)
    res.status(500).json({
      success: false,
      error: 'Delete failed',
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
