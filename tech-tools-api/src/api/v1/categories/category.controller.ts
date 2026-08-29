import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  processCategoryImage,
  processVideo,
  validateImageFile,
  validateVideoFile,
} from '../../../utils/media'
import fs from 'fs/promises'

// Helper to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Get all categories (admin - includes inactive)
export const getAllCategories = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      isActive,
      parentId,
      sortBy = 'display_order',
      sortOrder = 'asc',
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (search) {
      conditions.push(
        `(c.name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`,
      )
      values.push(`%${search}%`)
      paramIndex++
    }

    if (isActive !== undefined) {
      conditions.push(`c.is_active = $${paramIndex}`)
      values.push(isActive === 'true')
      paramIndex++
    }

    if (parentId === 'null') {
      conditions.push('c.parent_id IS NULL')
    } else if (parentId) {
      conditions.push(`c.parent_id = $${paramIndex}`)
      values.push(parentId)
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Validate sort column
    const validSortColumns = [
      'name',
      'display_order',
      'created_at',
      'updated_at',
    ]
    const sortColumn = validSortColumns.includes(sortBy as string)
      ? sortBy
      : 'display_order'
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC'

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM categories c ${whereClause}`,
      values,
    )
    const total = parseInt(countResult.rows[0].count)

    // Get categories with parent info and media
    const result = await query(
      `SELECT c.*, 
        p.name as parent_name,
        (SELECT COUNT(*) FROM products WHERE category_id = c.id AND deleted_at IS NULL) as product_count,
        (SELECT json_agg(cm ORDER BY cm.position) 
         FROM category_media cm 
         WHERE cm.category_id = c.id) as media
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       ${whereClause}
       ORDER BY c.${sortColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset],
    )

    res.json({
      success: true,
      data: {
        categories: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get all categories error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    })
  }
}

interface CategoryTreeNode {
  id: string
  parent_id: string | null
  [key: string]: unknown
  children?: CategoryTreeNode[]
}

// Builds a nested tree from the flat parent_id rows in memory -- the
// catalog is small enough (dozens, not millions, of categories) that a
// recursive SQL query would be overkill for what's really just a couple
// levels of grouping.
function buildCategoryTree(rows: CategoryTreeNode[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>()
  for (const row of rows) byId.set(row.id, { ...row, children: [] })

  const roots: CategoryTreeNode[] = []
  for (const row of rows) {
    const node = byId.get(row.id)!
    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export const getCategories = async (req: Request, res: Response) => {
  try {
    // Joins category_media (thumbnail/banner/icon) the same way
    // getAllCategories (admin) already does -- previously this public
    // endpoint only ever returned the legacy categories.image_url column,
    // so anything an admin uploaded via CategoryForm's Media tab was
    // invisible to the storefront.
    //
    // Also joins any real, currently-active category_collections linked to
    // this category (same visibility/is_active/starts_at/ends_at gating as
    // category-collections.controller.ts's own public reads) so the mega
    // menu can show a genuine promo tile without a second request per
    // hover -- absent entirely, never a placeholder, when nothing real is
    // running for that category.
    const result = await query(
      `SELECT c.*,
        (SELECT json_agg(cm ORDER BY cm.position)
         FROM category_media cm
         WHERE cm.category_id = c.id) as media,
        (SELECT json_agg(json_build_object(
            'id', cc.id, 'name', cc.name, 'slug', cc.slug,
            'banner_url', cc.banner_url, 'image_url', cc.image_url
          ) ORDER BY cci.position)
         FROM category_collection_items cci
         JOIN category_collections cc ON cc.id = cci.collection_id
         WHERE cci.category_id = c.id
           AND cc.is_active = true
           AND cc.visibility = 'public'
           AND (cc.starts_at IS NULL OR cc.starts_at <= CURRENT_TIMESTAMP)
           AND (cc.ends_at IS NULL OR cc.ends_at > CURRENT_TIMESTAMP)
        ) as active_collections
       FROM categories c
       WHERE c.is_active = true
       ORDER BY c.display_order ASC, c.name ASC`,
      [],
    )

    const categories =
      req.query.tree === 'true' ? buildCategoryTree(result.rows) : result.rows

    res.json({
      success: true,
      data: {
        categories,
      },
    })
  } catch (error) {
    logger.error('Get categories error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get categories',
    })
  }
}

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'SELECT * FROM categories WHERE id = $1 AND is_active = true',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      })
    }

    res.json({
      success: true,
      data: {
        category: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Get category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get category',
    })
  }
}

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      slug: customSlug,
      description,
      parentId,
      metaTitle,
      metaDescription,
      displayOrder = 0,
      isActive = true,
      showInNavigation = false,
      // Media-related fields
      thumbnailTitle,
      thumbnailAlt,
      bannerTitle,
      bannerAlt,
      iconTitle,
      iconAlt,
      videoTitle,
      videoDescription,
    } = req.body

    // Generate slug from name if not provided
    let slug = customSlug || generateSlug(name)

    // Check if slug exists, if so append a number
    const existingSlug = await query(
      'SELECT id FROM categories WHERE slug = $1',
      [slug],
    )
    if (existingSlug.rows.length > 0) {
      slug = `${slug}-${Date.now()}`
    }

    // Create the category first
    const result = await query(
      `INSERT INTO categories (name, slug, description, parent_id, meta_title, meta_description, display_order, is_active, show_in_nav)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        name,
        slug,
        description,
        parentId || null,
        metaTitle || name,
        metaDescription || description,
        displayOrder,
        isActive,
        showInNavigation,
      ],
    )

    const category = result.rows[0]
    const categoryId = category.id

    // Process uploaded media files if any
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined
    const uploadedMedia: any[] = []

    try {
      // Process thumbnail image
      if (files?.thumbnail && files.thumbnail.length > 0) {
        const file = files.thumbnail[0]

        const validation = validateImageFile(file)
        if (!validation.valid) {
          throw new Error(`Thumbnail: ${validation.error}`)
        }

        const processed = await processCategoryImage(file)

        const cdnUrls = {
          original: processed.original.url,
          thumbnail: processed.optimized.thumbnail?.url || '',
          small: processed.optimized.small?.url || '',
          medium: processed.optimized.medium?.url || '',
          large: processed.optimized.large?.url || '',
        }

        const mediaResult = await query(
          `INSERT INTO category_media (
            category_id, media_type, media_purpose, file_path, cdn_urls, 
            file_size, mime_type, alt_text, title, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
          RETURNING *`,
          [
            categoryId,
            'image',
            'thumbnail',
            processed.original.url,
            JSON.stringify(cdnUrls),
            processed.original.fileSize,
            file.mimetype,
            thumbnailAlt || `${name} thumbnail`,
            thumbnailTitle || `${name} Thumbnail`,
            0,
          ],
        )

        uploadedMedia.push(mediaResult.rows[0])
        await fs.unlink(file.path).catch(() => {})
      }

      // Process banner image
      if (files?.banner && files.banner.length > 0) {
        const file = files.banner[0]

        const validation = validateImageFile(file)
        if (!validation.valid) {
          throw new Error(`Banner: ${validation.error}`)
        }

        const processed = await processCategoryImage(file)

        const cdnUrls = {
          original: processed.original.url,
          thumbnail: processed.optimized.thumbnail?.url || '',
          small: processed.optimized.small?.url || '',
          medium: processed.optimized.medium?.url || '',
          large: processed.optimized.large?.url || '',
        }

        const mediaResult = await query(
          `INSERT INTO category_media (
            category_id, media_type, media_purpose, file_path, cdn_urls, 
            file_size, mime_type, alt_text, title, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
          RETURNING *`,
          [
            categoryId,
            'image',
            'banner',
            processed.original.url,
            JSON.stringify(cdnUrls),
            processed.original.fileSize,
            file.mimetype,
            bannerAlt || `${name} banner`,
            bannerTitle || `${name} Banner`,
            1,
          ],
        )

        uploadedMedia.push(mediaResult.rows[0])
        await fs.unlink(file.path).catch(() => {})
      }

      // Process icon image
      if (files?.icon && files.icon.length > 0) {
        const file = files.icon[0]

        const validation = validateImageFile(file)
        if (!validation.valid) {
          throw new Error(`Icon: ${validation.error}`)
        }

        const processed = await processCategoryImage(file)

        const cdnUrls = {
          original: processed.original.url,
          thumbnail: processed.optimized.thumbnail?.url || '',
          small: processed.optimized.small?.url || '',
          medium: processed.optimized.medium?.url || '',
          large: processed.optimized.large?.url || '',
        }

        const mediaResult = await query(
          `INSERT INTO category_media (
            category_id, media_type, media_purpose, file_path, cdn_urls, 
            file_size, mime_type, alt_text, title, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
          RETURNING *`,
          [
            categoryId,
            'image',
            'icon',
            processed.original.url,
            JSON.stringify(cdnUrls),
            processed.original.fileSize,
            file.mimetype,
            iconAlt || `${name} icon`,
            iconTitle || `${name} Icon`,
            2,
          ],
        )

        uploadedMedia.push(mediaResult.rows[0])
        await fs.unlink(file.path).catch(() => {})
      }

      // Process video
      if (files?.video && files.video.length > 0) {
        const file = files.video[0]

        const validation = validateVideoFile(file)
        if (!validation.valid) {
          throw new Error(`Video: ${validation.error}`)
        }

        const processed = await processVideo(file, 'category')

        const cdnUrls = {
          url: processed.url,
          thumbnailUrl: processed.thumbnailUrl,
        }

        const mediaResult = await query(
          `INSERT INTO category_media (
            category_id, media_type, media_purpose, file_path, cdn_urls, 
            file_size, mime_type, title, description, video_duration, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
          RETURNING *`,
          [
            categoryId,
            'video',
            'video',
            processed.url,
            JSON.stringify(cdnUrls),
            processed.fileSize,
            file.mimetype,
            videoTitle || `${name} Video`,
            videoDescription || '',
            null,
            3,
          ],
        )

        uploadedMedia.push(mediaResult.rows[0])
        await fs.unlink(file.path).catch(() => {})
      }
    } catch (mediaError) {
      logger.error(
        'Media processing error during category creation:',
        mediaError,
      )
      // Category is already created, just log the media error
    }

    logger.info('Category created:', {
      categoryId: category.id,
      mediaCount: uploadedMedia.length,
    })

    // Fetch complete category with media
    const completeCategory = await query(
      `SELECT c.*, 
        (SELECT json_agg(cm ORDER BY cm.position) 
         FROM category_media cm 
         WHERE cm.category_id = c.id) as media
       FROM categories c 
       WHERE c.id = $1`,
      [categoryId],
    )

    res.status(201).json({
      success: true,
      data: {
        category: completeCategory.rows[0],
      },
      message:
        uploadedMedia.length > 0
          ? `Category created successfully with ${uploadedMedia.length} media file(s)`
          : 'Category created successfully',
    })
  } catch (error) {
    logger.error('Create category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
    })
  }
}

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const {
      name,
      slug: customSlug,
      description,
      parentId,
      metaTitle,
      metaDescription,
      displayOrder,
      isActive,
      showInNavigation,
      // Media-related fields
      thumbnailTitle,
      thumbnailAlt,
      bannerTitle,
      bannerAlt,
      iconTitle,
      iconAlt,
      videoTitle,
      videoDescription,
    } = req.body

    // Check if category exists
    const existingCategory = await query(
      'SELECT * FROM categories WHERE id = $1',
      [id],
    )
    if (existingCategory.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      })
    }

    const current = existingCategory.rows[0]

    // Generate new slug if name changed
    let slug = customSlug
    if (name && name !== current.name && !customSlug) {
      slug = generateSlug(name)
      // Check if new slug exists
      const existingSlug = await query(
        'SELECT id FROM categories WHERE slug = $1 AND id != $2',
        [slug, id],
      )
      if (existingSlug.rows.length > 0) {
        slug = `${slug}-${Date.now()}`
      }
    }

    // Prevent setting parent to self or descendant
    if (parentId && parentId !== current.parent_id) {
      if (parentId === id) {
        return res.status(400).json({
          success: false,
          error: 'Category cannot be its own parent',
        })
      }
      // Check if parentId is a descendant of this category
      const descendants = await query(
        `WITH RECURSIVE cat_tree AS (
          SELECT id FROM categories WHERE parent_id = $1
          UNION ALL
          SELECT c.id FROM categories c
          INNER JOIN cat_tree ct ON c.parent_id = ct.id
        ) SELECT id FROM cat_tree WHERE id = $2`,
        [id, parentId],
      )
      if (descendants.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot set parent to a descendant category',
        })
      }
    }

    const result = await query(
      `UPDATE categories SET 
        name = COALESCE($1, name), 
        slug = COALESCE($2, slug),
        description = COALESCE($3, description), 
        parent_id = $4,
        meta_title = COALESCE($5, meta_title),
        meta_description = COALESCE($6, meta_description),
        display_order = COALESCE($7, display_order),
        is_active = COALESCE($8, is_active),
        show_in_nav = COALESCE($9, show_in_nav),
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        name,
        slug,
        description,
        parentId === '' || parentId === 'null'
          ? null
          : parentId || current.parent_id,
        metaTitle,
        metaDescription,
        displayOrder,
        isActive,
        showInNavigation,
        id,
      ],
    )

    // Process uploaded media files if any
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined
    const uploadedMedia: any[] = []

    if (files) {
      const updatedName = result.rows[0].name

      try {
        // Process thumbnail image
        if (files.thumbnail && files.thumbnail.length > 0) {
          const file = files.thumbnail[0]
          const validation = validateImageFile(file)
          if (validation.valid) {
            // Delete existing thumbnail
            await query(
              `DELETE FROM category_media WHERE category_id = $1 AND media_purpose = 'thumbnail'`,
              [id],
            )

            const processed = await processCategoryImage(file)
            const cdnUrls = {
              original: processed.original.url,
              thumbnail: processed.optimized.thumbnail?.url || '',
              small: processed.optimized.small?.url || '',
              medium: processed.optimized.medium?.url || '',
              large: processed.optimized.large?.url || '',
            }

            const mediaResult = await query(
              `INSERT INTO category_media (
                category_id, media_type, media_purpose, file_path, cdn_urls, 
                file_size, mime_type, alt_text, title, position
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
              RETURNING *`,
              [
                id,
                'image',
                'thumbnail',
                processed.original.url,
                JSON.stringify(cdnUrls),
                processed.original.fileSize,
                file.mimetype,
                thumbnailAlt || `${updatedName} thumbnail`,
                thumbnailTitle || `${updatedName} Thumbnail`,
                0,
              ],
            )
            uploadedMedia.push(mediaResult.rows[0])
            await fs.unlink(file.path).catch(() => {})
          }
        }

        // Process banner image
        if (files.banner && files.banner.length > 0) {
          const file = files.banner[0]
          const validation = validateImageFile(file)
          if (validation.valid) {
            await query(
              `DELETE FROM category_media WHERE category_id = $1 AND media_purpose = 'banner'`,
              [id],
            )

            const processed = await processCategoryImage(file)
            const cdnUrls = {
              original: processed.original.url,
              thumbnail: processed.optimized.thumbnail?.url || '',
              small: processed.optimized.small?.url || '',
              medium: processed.optimized.medium?.url || '',
              large: processed.optimized.large?.url || '',
            }

            const mediaResult = await query(
              `INSERT INTO category_media (
                category_id, media_type, media_purpose, file_path, cdn_urls, 
                file_size, mime_type, alt_text, title, position
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
              RETURNING *`,
              [
                id,
                'image',
                'banner',
                processed.original.url,
                JSON.stringify(cdnUrls),
                processed.original.fileSize,
                file.mimetype,
                bannerAlt || `${updatedName} banner`,
                bannerTitle || `${updatedName} Banner`,
                1,
              ],
            )
            uploadedMedia.push(mediaResult.rows[0])
            await fs.unlink(file.path).catch(() => {})
          }
        }

        // Process icon image
        if (files.icon && files.icon.length > 0) {
          const file = files.icon[0]
          const validation = validateImageFile(file)
          if (validation.valid) {
            await query(
              `DELETE FROM category_media WHERE category_id = $1 AND media_purpose = 'icon'`,
              [id],
            )

            const processed = await processCategoryImage(file)
            const cdnUrls = {
              original: processed.original.url,
              thumbnail: processed.optimized.thumbnail?.url || '',
              small: processed.optimized.small?.url || '',
              medium: processed.optimized.medium?.url || '',
              large: processed.optimized.large?.url || '',
            }

            const mediaResult = await query(
              `INSERT INTO category_media (
                category_id, media_type, media_purpose, file_path, cdn_urls, 
                file_size, mime_type, alt_text, title, position
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
              RETURNING *`,
              [
                id,
                'image',
                'icon',
                processed.original.url,
                JSON.stringify(cdnUrls),
                processed.original.fileSize,
                file.mimetype,
                iconAlt || `${updatedName} icon`,
                iconTitle || `${updatedName} Icon`,
                2,
              ],
            )
            uploadedMedia.push(mediaResult.rows[0])
            await fs.unlink(file.path).catch(() => {})
          }
        }

        // Process video
        if (files.video && files.video.length > 0) {
          const file = files.video[0]
          const validation = validateVideoFile(file)
          if (validation.valid) {
            await query(
              `DELETE FROM category_media WHERE category_id = $1 AND media_purpose = 'video'`,
              [id],
            )

            const processed = await processVideo(file, 'category')
            const cdnUrls = {
              url: processed.url,
              thumbnailUrl: processed.thumbnailUrl,
            }

            const mediaResult = await query(
              `INSERT INTO category_media (
                category_id, media_type, media_purpose, file_path, cdn_urls, 
                file_size, mime_type, title, description, video_duration, position
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
              RETURNING *`,
              [
                id,
                'video',
                'video',
                processed.url,
                JSON.stringify(cdnUrls),
                processed.fileSize,
                file.mimetype,
                videoTitle || `${updatedName} Video`,
                videoDescription || '',
                null,
                3,
              ],
            )
            uploadedMedia.push(mediaResult.rows[0])
            await fs.unlink(file.path).catch(() => {})
          }
        }
      } catch (mediaError) {
        logger.error(
          'Media processing error during category update:',
          mediaError,
        )
      }
    }

    // Fetch complete category with media
    const completeCategory = await query(
      `SELECT c.*, 
        p.name as parent_name,
        (SELECT json_agg(cm ORDER BY cm.position) 
         FROM category_media cm 
         WHERE cm.category_id = c.id) as media
       FROM categories c 
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE c.id = $1`,
      [id],
    )

    logger.info('Category updated:', {
      categoryId: id,
      mediaCount: uploadedMedia.length,
    })

    res.json({
      success: true,
      data: {
        category: completeCategory.rows[0],
      },
      message:
        uploadedMedia.length > 0
          ? `Category updated with ${uploadedMedia.length} media file(s)`
          : 'Category updated successfully',
    })
  } catch (error) {
    logger.error('Update category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
    })
  }
}

// Delete category media
export const deleteCategoryMedia = async (req: AuthRequest, res: Response) => {
  try {
    const { id, mediaId } = req.params

    const result = await query(
      'DELETE FROM category_media WHERE id = $1 AND category_id = $2 RETURNING *',
      [mediaId, id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Media not found',
      })
    }

    logger.info('Category media deleted:', { categoryId: id, mediaId })

    res.json({
      success: true,
      message: 'Media deleted successfully',
    })
  } catch (error) {
    logger.error('Delete category media error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete media',
    })
  }
}

// Restore deleted category
export const restoreCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'UPDATE categories SET is_active = true, updated_at = NOW() WHERE id = $1 AND is_active = false RETURNING *',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or already active',
      })
    }

    logger.info('Category restored:', { categoryId: id })

    res.json({
      success: true,
      data: {
        category: result.rows[0],
      },
      message: 'Category restored successfully',
    })
  } catch (error) {
    logger.error('Restore category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to restore category',
    })
  }
}

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1 AND is_active = true RETURNING id',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      })
    }

    logger.info('Category deleted:', { categoryId: id })

    res.json({
      success: true,
      message: 'Category deleted successfully',
    })
  } catch (error) {
    logger.error('Delete category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
    })
  }
}

export const getCategoryProducts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { page = 1, limit = 20 } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    const result = await query(
      'SELECT * FROM products WHERE category_id = $1 AND is_active = true AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [id, limit, offset],
    )

    const countResult = await query(
      'SELECT COUNT(*) FROM products WHERE category_id = $1 AND is_active = true AND deleted_at IS NULL',
      [id],
    )

    const total = parseInt(countResult.rows[0].count)

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
    logger.error('Get category products error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get category products',
    })
  }
}

export const bulkDeleteCategories = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty ids array',
      })
    }

    // Soft delete categories
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const result = await query(
      `UPDATE categories SET deleted_at = NOW(), updated_at = NOW() WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      ids,
    )

    res.json({
      success: true,
      message: `${result.rowCount} categories deleted successfully`,
      data: { deletedCount: result.rowCount },
    })
  } catch (error) {
    logger.error('Bulk delete categories error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to bulk delete categories',
    })
  }
}

export const bulkUpdateCategories = async (req: Request, res: Response) => {
  try {
    const { ids, data } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty ids array',
      })
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Update data is required',
      })
    }

    // Build dynamic SET clause for allowed fields
    const allowedFields = ['is_active', 'display_order']
    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`)
        values.push(data[field])
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      })
    }

    updates.push(`updated_at = NOW()`)

    const placeholders = ids.map((_, i) => `$${paramIndex + i}`).join(', ')
    values.push(...ids)

    const result = await query(
      `UPDATE categories SET ${updates.join(
        ', ',
      )} WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      values,
    )

    res.json({
      success: true,
      message: `${result.rowCount} categories updated successfully`,
      data: { updatedCount: result.rowCount },
    })
  } catch (error) {
    logger.error('Bulk update categories error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update categories',
    })
  }
}
