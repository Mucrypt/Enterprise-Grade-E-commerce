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

export const getCategories = async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM categories WHERE is_active = true ORDER BY name ASC',
      [],
    )

    res.json({
      success: true,
      data: {
        categories: result.rows,
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
      description,
      parentId,
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

    // Create the category first
    const result = await query(
      'INSERT INTO categories (name, description, parent_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, parentId || null],
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
    const { name, description, parentId } = req.body

    const result = await query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), parent_id = COALESCE($3, parent_id), updated_at = NOW() WHERE id = $4 AND is_active = true RETURNING *',
      [name, description, parentId, id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      })
    }

    logger.info('Category updated:', { categoryId: id })

    res.json({
      success: true,
      data: {
        category: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Update category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
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
