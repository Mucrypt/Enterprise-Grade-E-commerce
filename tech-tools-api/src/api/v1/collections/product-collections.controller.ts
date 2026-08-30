import { Request, Response } from 'express'
import { query as dbQuery, getClient } from '../../../database/connection'
import { AuthRequest } from '../../../middleware/auth'
import { processCollectionImage, validateImageFile } from '../../../utils/media'

// Real image/banner upload -- multer (product-collections.routes.ts) has
// already parsed any multipart request into req.files by the time this
// runs; a plain JSON request (no files) leaves req.files undefined and
// this resolves to whatever imageUrl/bannerUrl came in the body, same as
// before. An uploaded file always wins over a same-request body URL.
async function resolveCollectionImages(
  req: Request,
  bodyImageUrl?: string,
  bodyBannerUrl?: string,
): Promise<{ imageUrl?: string; bannerUrl?: string }> {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined

  let imageUrl = bodyImageUrl
  let bannerUrl = bodyBannerUrl

  if (files?.image?.[0]) {
    const file = files.image[0]
    const validation = validateImageFile(file)
    if (!validation.valid) throw new Error(`Image: ${validation.error}`)
    const processed = await processCollectionImage(file)
    imageUrl = processed.optimized.large?.url || processed.original.url
  }

  if (files?.banner?.[0]) {
    const file = files.banner[0]
    const validation = validateImageFile(file)
    if (!validation.valid) throw new Error(`Banner: ${validation.error}`)
    const processed = await processCollectionImage(file)
    bannerUrl = processed.optimized.large?.url || processed.original.url
  }

  return { imageUrl, bannerUrl }
}

const COLLECTION_UPDATE_FIELD_MAP: Record<string, string> = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  shortDescription: 'short_description',
  short_description: 'short_description',
  imageUrl: 'image_url',
  image_url: 'image_url',
  bannerUrl: 'banner_url',
  banner_url: 'banner_url',
  isActive: 'is_active',
  is_active: 'is_active',
  isFeatured: 'is_featured',
  is_featured: 'is_featured',
  visibility: 'visibility',
  position: 'position',
  displayOrder: 'display_order',
  display_order: 'display_order',
  metaTitle: 'meta_title',
  meta_title: 'meta_title',
  metaDescription: 'meta_description',
  meta_description: 'meta_description',
  metaKeywords: 'meta_keywords',
  meta_keywords: 'meta_keywords',
  startsAt: 'starts_at',
  starts_at: 'starts_at',
  endsAt: 'ends_at',
  ends_at: 'ends_at',
}

const isAdminRequest = (req: Request): boolean => {
  const userType = (req as AuthRequest).user?.userType
  return userType === 'admin' || userType === 'super_admin'
}

// =====================================================
// CREATE PRODUCT COLLECTION
// =====================================================

export const createProductCollection = async (req: Request, res: Response) => {
  try {
    const {
      name,
      slug,
      description,
      shortDescription,
      imageUrl,
      bannerUrl,
      isActive = true,
      isFeatured = false,
      visibility = 'public',
      position = 0,
      displayOrder = 'manual',
      metaTitle,
      metaDescription,
      metaKeywords,
      startsAt,
      endsAt,
    } = req.body

    const userId = (req as any).user?.userId

    // Validate required fields
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Name and slug are required',
      })
    }

    // Check if slug already exists
    const slugCheck = await dbQuery(
      'SELECT id FROM product_collections WHERE slug = $1',
      [slug],
    )

    if (slugCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Collection with this slug already exists',
      })
    }

    const resolvedImages = await resolveCollectionImages(req, imageUrl, bannerUrl)

    // Insert collection
    const result = await dbQuery(
      `INSERT INTO product_collections
       (name, slug, description, short_description, image_url, banner_url, is_active, is_featured,
        visibility, position, display_order, meta_title, meta_description, meta_keywords,
        starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        name,
        slug,
        description || null,
        shortDescription || null,
        resolvedImages.imageUrl || null,
        resolvedImages.bannerUrl || null,
        isActive,
        isFeatured,
        visibility,
        position,
        displayOrder,
        metaTitle || null,
        metaDescription || null,
        metaKeywords || null,
        startsAt || null,
        endsAt || null,
        userId || null,
      ],
    )

    res.status(201).json({
      success: true,
      message: 'Collection created successfully',
      data: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error creating product collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create collection',
      error: error.message,
    })
  }
}

// =====================================================
// GET ALL PRODUCT COLLECTIONS
// =====================================================

export const getAllProductCollections = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      visibility,
      isActive,
      isFeatured,
      active,
      featured,
      slug,
      search,
    } = req.query
    const adminRequest = isAdminRequest(req)

    const offset = (Number(page) - 1) * Number(limit)

    let query = 'SELECT * FROM product_collections WHERE 1=1'
    const params: any[] = []
    let paramCount = 1

    // Apply filters
    if (visibility) {
      query += ` AND visibility = $${paramCount++}`
      params.push(visibility)
    } else if (!adminRequest) {
      query += ` AND visibility = $${paramCount++}`
      params.push('public')
    }

    const activeFilter = isActive ?? active
    if (activeFilter !== undefined) {
      query += ` AND is_active = $${paramCount++}`
      params.push(activeFilter === 'true')
    } else if (!adminRequest) {
      query += ` AND is_active = true`
    }

    const featuredFilter = isFeatured ?? featured
    if (featuredFilter !== undefined) {
      query += ` AND is_featured = $${paramCount++}`
      params.push(featuredFilter === 'true')
    }

    if (slug) {
      query += ` AND slug = $${paramCount++}`
      params.push(slug)
    }

    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`
      params.push(`%${search}%`)
      paramCount++
    }

    if (!adminRequest) {
      query += ' AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)'
      query += ' AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)'
    }

    // Get total count
    const countResult = await dbQuery(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params,
    )
    const totalItems = parseInt(countResult.rows[0].count)

    // Add ordering and pagination
    query += ' ORDER BY position ASC, created_at DESC'
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`
    params.push(Number(limit), offset)

    const result = await dbQuery(query, params)

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalItems,
        totalItems,
        totalPages: Math.ceil(totalItems / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error fetching product collections:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: error.message,
    })
  }
}

// =====================================================
// GET SINGLE PRODUCT COLLECTION
// =====================================================

export const getProductCollectionById = async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params
    const { includeProducts = 'true' } = req.query
    const adminRequest = isAdminRequest(req)

    // Determine if collectionId is a UUID or slug
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        collectionId,
      )

    // Get collection details - support both ID and slug lookup
    const collectionQuery = isUUID
      ? 'SELECT * FROM product_collections WHERE id = $1'
      : 'SELECT * FROM product_collections WHERE slug = $1'
    const collectionResult = await dbQuery(collectionQuery, [collectionId])

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      })
    }

    const collection = collectionResult.rows[0]

    if (
      !adminRequest &&
      (collection.visibility !== 'public' ||
        !collection.is_active ||
        (collection.starts_at && new Date(collection.starts_at) > new Date()) ||
        (collection.ends_at && new Date(collection.ends_at) <= new Date()))
    ) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      })
    }

    // Get products if requested
    if (includeProducts === 'true') {
      const productsResult = await dbQuery(
        `SELECT p.*, pci.position as collection_position, pci.is_featured as is_featured_in_collection
         FROM products p
         JOIN product_collection_items pci ON p.id = pci.product_id
         WHERE pci.collection_id = $1
           AND p.is_active = TRUE
           AND p.deleted_at IS NULL
         ORDER BY pci.position ASC`,
        [collection.id],
      )

      collection.products = productsResult.rows
    }

    res.status(200).json({
      success: true,
      data: collection,
    })
  } catch (error: any) {
    console.error('Error fetching product collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collection',
      error: error.message,
    })
  }
}

// =====================================================
// UPDATE PRODUCT COLLECTION
// =====================================================

export const updateProductCollection = async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params
    const updates = req.body

    // A cleared/never-set date field arrives as '' (the admin form's date
    // inputs default to an empty string, not undefined) -- '' is not a
    // valid TIMESTAMP literal, so Postgres rejects it outright. Only these
    // two fields need this: every other TEXT/VARCHAR column here is happy
    // to store an empty string.
    for (const dateField of ['startsAt', 'starts_at', 'endsAt', 'ends_at']) {
      if (updates[dateField] === '') updates[dateField] = null
    }

    // Check if collection exists
    const collectionCheck = await dbQuery(
      'SELECT id FROM product_collections WHERE id = $1',
      [collectionId],
    )

    if (collectionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      })
    }

    // An uploaded file (multipart) always wins over a same-request body
    // URL -- overwrite updates.imageUrl/bannerUrl in place before the
    // dynamic field map below reads them, so a real upload here needs no
    // separate code path.
    const resolvedImages = await resolveCollectionImages(
      req,
      updates.imageUrl ?? updates.image_url,
      updates.bannerUrl ?? updates.banner_url,
    )
    if (resolvedImages.imageUrl !== undefined) updates.imageUrl = resolvedImages.imageUrl
    if (resolvedImages.bannerUrl !== undefined) updates.bannerUrl = resolvedImages.bannerUrl

    // Build update query dynamically
    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1

    const appliedFields = new Set<string>()

    for (const [inputField, dbField] of Object.entries(
      COLLECTION_UPDATE_FIELD_MAP,
    )) {
      if (appliedFields.has(dbField)) {
        continue
      }

      if (updates[inputField] !== undefined) {
        fields.push(`${dbField} = $${paramCount++}`)
        values.push(updates[inputField])
        appliedFields.add(dbField)
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      })
    }

    values.push(collectionId)

    const result = await dbQuery(
      `UPDATE product_collections 
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount}
       RETURNING *`,
      values,
    )

    res.status(200).json({
      success: true,
      message: 'Collection updated successfully',
      data: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error updating product collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update collection',
      error: error.message,
    })
  }
}

// =====================================================
// DELETE PRODUCT COLLECTION
// =====================================================

export const deleteProductCollection = async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params

    // Check if collection exists
    const collectionCheck = await dbQuery(
      'SELECT id FROM product_collections WHERE id = $1',
      [collectionId],
    )

    if (collectionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      })
    }

    // Delete collection (cascade will delete items)
    await dbQuery('DELETE FROM product_collections WHERE id = $1', [
      collectionId,
    ])

    res.status(200).json({
      success: true,
      message: 'Collection deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting product collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete collection',
      error: error.message,
    })
  }
}

// =====================================================
// ADD PRODUCTS TO COLLECTION
// =====================================================

export const addProductsToCollection = async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params
    const { productIds, isFeatured = false } = req.body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required',
      })
    }

    // Check if collection exists
    const collectionCheck = await dbQuery(
      'SELECT id FROM product_collections WHERE id = $1',
      [collectionId],
    )

    if (collectionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      })
    }

    const userId = (req as any).user?.userId
    const client = await getClient()

    try {
      await client.query('BEGIN')

      // Get current max position
      const maxPosResult = await client.query(
        'SELECT COALESCE(MAX(position), -1) as max_pos FROM product_collection_items WHERE collection_id = $1',
        [collectionId],
      )
      let currentPosition = maxPosResult.rows[0].max_pos + 1

      // Insert products
      for (const productId of productIds) {
        // Check if product exists
        const productCheck = await client.query(
          'SELECT id FROM products WHERE id = $1',
          [productId],
        )

        if (productCheck.rows.length === 0) {
          throw new Error(`Product ${productId} not found`)
        }

        // Insert or update
        await client.query(
          `INSERT INTO product_collection_items 
           (collection_id, product_id, position, is_featured, added_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (collection_id, product_id) 
           DO UPDATE SET is_featured = $4`,
          [collectionId, productId, currentPosition++, isFeatured, userId],
        )
      }

      await client.query('COMMIT')

      // Fetch updated collection with products
      const result = await dbQuery(
        `SELECT p.*, pci.position as collection_position, pci.is_featured as is_featured_in_collection
         FROM products p
         JOIN product_collection_items pci ON p.id = pci.product_id
         WHERE pci.collection_id = $1
         ORDER BY pci.position ASC`,
        [collectionId],
      )

      res.status(200).json({
        success: true,
        message: 'Products added to collection successfully',
        data: result.rows,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error adding products to collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to add products to collection',
      error: error.message,
    })
  }
}

// =====================================================
// REMOVE PRODUCT FROM COLLECTION
// =====================================================

export const removeProductFromCollection = async (
  req: Request,
  res: Response,
) => {
  try {
    const { collectionId, productId } = req.params

    const result = await dbQuery(
      'DELETE FROM product_collection_items WHERE collection_id = $1 AND product_id = $2 RETURNING *',
      [collectionId, productId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in collection',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Product removed from collection successfully',
    })
  } catch (error: any) {
    console.error('Error removing product from collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to remove product from collection',
      error: error.message,
    })
  }
}

// =====================================================
// REORDER PRODUCTS IN COLLECTION
// =====================================================

export const reorderProductsInCollection = async (
  req: Request,
  res: Response,
) => {
  try {
    const { collectionId } = req.params
    const productOrder = req.body.productOrder || req.body.items

    if (!Array.isArray(productOrder) || productOrder.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product order data',
      })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Update each product's position
      for (const item of productOrder) {
        await client.query(
          'UPDATE product_collection_items SET position = $1 WHERE collection_id = $2 AND product_id = $3',
          [item.position, collectionId, item.productId],
        )
      }

      await client.query('COMMIT')

      // Fetch updated collection
      const result = await dbQuery(
        `SELECT p.*, pci.position as collection_position
         FROM products p
         JOIN product_collection_items pci ON p.id = pci.product_id
         WHERE pci.collection_id = $1
         ORDER BY pci.position ASC`,
        [collectionId],
      )

      res.status(200).json({
        success: true,
        message: 'Products reordered successfully',
        data: result.rows,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error reordering products in collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reorder products',
      error: error.message,
    })
  }
}
