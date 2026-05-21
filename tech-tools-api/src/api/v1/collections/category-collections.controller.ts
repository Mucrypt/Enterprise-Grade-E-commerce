import { Request, Response } from 'express'
import { query as dbQuery, getClient } from '../../../database/connection'
import { AuthRequest } from '../../../middleware/auth'

const CATEGORY_COLLECTION_UPDATE_FIELD_MAP: Record<string, string> = {
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
// CREATE CATEGORY COLLECTION
// =====================================================

export const createCategoryCollection = async (req: Request, res: Response) => {
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
      'SELECT id FROM category_collections WHERE slug = $1',
      [slug],
    )

    if (slugCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Collection with this slug already exists',
      })
    }

    // Insert collection
    const result = await dbQuery(
      `INSERT INTO category_collections 
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
        imageUrl || null,
        bannerUrl || null,
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
      message: 'Category collection created successfully',
      data: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error creating category collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create collection',
      error: error.message,
    })
  }
}

// =====================================================
// GET ALL CATEGORY COLLECTIONS
// =====================================================

export const getAllCategoryCollections = async (
  req: Request,
  res: Response,
) => {
  try {
    const {
      page = 1,
      limit = 10,
      visibility,
      isActive,
      isFeatured,
      active,
      featured,
      search,
    } = req.query
    const adminRequest = isAdminRequest(req)

    const offset = (Number(page) - 1) * Number(limit)

    let query = 'SELECT * FROM category_collections WHERE 1=1'
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
      query += ' AND is_active = true'
    }

    const featuredFilter = isFeatured ?? featured
    if (featuredFilter !== undefined) {
      query += ` AND is_featured = $${paramCount++}`
      params.push(featuredFilter === 'true')
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
    console.error('Error fetching category collections:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: error.message,
    })
  }
}

// =====================================================
// GET SINGLE CATEGORY COLLECTION
// =====================================================

export const getCategoryCollectionById = async (
  req: Request,
  res: Response,
) => {
  try {
    const { collectionId } = req.params
    const { includeCategories = 'true' } = req.query
    const adminRequest = isAdminRequest(req)

    // Get collection details
    const collectionResult = await dbQuery(
      'SELECT * FROM category_collections WHERE id = $1',
      [collectionId],
    )

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

    // Get categories if requested
    if (includeCategories === 'true') {
      const categoriesResult = await dbQuery(
        `SELECT c.*, cci.position as collection_position, cci.is_featured as is_featured_in_collection
         FROM categories c
         JOIN category_collection_items cci ON c.id = cci.category_id
         WHERE cci.collection_id = $1
         ORDER BY cci.position ASC`,
        [collectionId],
      )

      collection.categories = categoriesResult.rows
    }

    res.status(200).json({
      success: true,
      data: collection,
    })
  } catch (error: any) {
    console.error('Error fetching category collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collection',
      error: error.message,
    })
  }
}

// =====================================================
// UPDATE CATEGORY COLLECTION
// =====================================================

export const updateCategoryCollection = async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params
    const updates = req.body

    // Check if collection exists
    const collectionCheck = await dbQuery(
      'SELECT id FROM category_collections WHERE id = $1',
      [collectionId],
    )

    if (collectionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      })
    }

    // Build update query dynamically
    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1

    const appliedFields = new Set<string>()

    for (const [inputField, dbField] of Object.entries(
      CATEGORY_COLLECTION_UPDATE_FIELD_MAP,
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
      `UPDATE category_collections 
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
    console.error('Error updating category collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update collection',
      error: error.message,
    })
  }
}

// =====================================================
// DELETE CATEGORY COLLECTION
// =====================================================

export const deleteCategoryCollection = async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params

    // Check if collection exists
    const collectionCheck = await dbQuery(
      'SELECT id FROM category_collections WHERE id = $1',
      [collectionId],
    )

    if (collectionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      })
    }

    // Delete collection (cascade will delete items)
    await dbQuery('DELETE FROM category_collections WHERE id = $1', [
      collectionId,
    ])

    res.status(200).json({
      success: true,
      message: 'Collection deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting category collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete collection',
      error: error.message,
    })
  }
}

// =====================================================
// ADD CATEGORIES TO COLLECTION
// =====================================================

export const addCategoriesToCollection = async (
  req: Request,
  res: Response,
) => {
  try {
    const { collectionId } = req.params
    const { categoryIds, isFeatured = false } = req.body

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category IDs array is required',
      })
    }

    // Check if collection exists
    const collectionCheck = await dbQuery(
      'SELECT id FROM category_collections WHERE id = $1',
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
        'SELECT COALESCE(MAX(position), -1) as max_pos FROM category_collection_items WHERE collection_id = $1',
        [collectionId],
      )
      let currentPosition = maxPosResult.rows[0].max_pos + 1

      // Insert categories
      for (const categoryId of categoryIds) {
        // Check if category exists
        const categoryCheck = await client.query(
          'SELECT id FROM categories WHERE id = $1',
          [categoryId],
        )

        if (categoryCheck.rows.length === 0) {
          throw new Error(`Category ${categoryId} not found`)
        }

        // Insert or update
        await client.query(
          `INSERT INTO category_collection_items 
           (collection_id, category_id, position, is_featured, added_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (collection_id, category_id) 
           DO UPDATE SET is_featured = $4`,
          [collectionId, categoryId, currentPosition++, isFeatured, userId],
        )
      }

      await client.query('COMMIT')

      // Fetch updated collection with categories
      const result = await dbQuery(
        `SELECT c.*, cci.position as collection_position, cci.is_featured as is_featured_in_collection
         FROM categories c
         JOIN category_collection_items cci ON c.id = cci.category_id
         WHERE cci.collection_id = $1
         ORDER BY cci.position ASC`,
        [collectionId],
      )

      res.status(200).json({
        success: true,
        message: 'Categories added to collection successfully',
        data: result.rows,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error adding categories to collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to add categories to collection',
      error: error.message,
    })
  }
}

// =====================================================
// REMOVE CATEGORY FROM COLLECTION
// =====================================================

export const removeCategoryFromCollection = async (
  req: Request,
  res: Response,
) => {
  try {
    const { collectionId, categoryId } = req.params

    const result = await dbQuery(
      'DELETE FROM category_collection_items WHERE collection_id = $1 AND category_id = $2 RETURNING *',
      [collectionId, categoryId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found in collection',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Category removed from collection successfully',
    })
  } catch (error: any) {
    console.error('Error removing category from collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to remove category from collection',
      error: error.message,
    })
  }
}

// =====================================================
// REORDER CATEGORIES IN COLLECTION
// =====================================================

export const reorderCategoriesInCollection = async (
  req: Request,
  res: Response,
) => {
  try {
    const { collectionId } = req.params
    const categoryOrder = req.body.categoryOrder || req.body.items

    if (!Array.isArray(categoryOrder) || categoryOrder.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category order data',
      })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Update each category's position
      for (const item of categoryOrder) {
        await client.query(
          'UPDATE category_collection_items SET position = $1 WHERE collection_id = $2 AND category_id = $3',
          [item.position, collectionId, item.categoryId],
        )
      }

      await client.query('COMMIT')

      // Fetch updated collection
      const result = await dbQuery(
        `SELECT c.*, cci.position as collection_position
         FROM categories c
         JOIN category_collection_items cci ON c.id = cci.category_id
         WHERE cci.collection_id = $1
         ORDER BY cci.position ASC`,
        [collectionId],
      )

      res.status(200).json({
        success: true,
        message: 'Categories reordered successfully',
        data: result.rows,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error reordering categories in collection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reorder categories',
      error: error.message,
    })
  }
}
