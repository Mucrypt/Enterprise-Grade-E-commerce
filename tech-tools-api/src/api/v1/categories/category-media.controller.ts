import { Request, Response } from 'express'
import { query as dbQuery } from '../../../database/connection'
import {
  upload,
  processCategoryImage,
  processVideo,
  validateImageFile,
  validateVideoFile,
  deleteMediaFile,
  generateCdnUrls,
} from '../../../utils/media'

// =====================================================
// UPLOAD CATEGORY MEDIA (Image or Video)
// =====================================================

export const uploadCategoryMedia = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params
    const {
      altText,
      title,
      position = 0,
      mediaPurpose = 'thumbnail',
    } = req.body
    const file = req.file

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      })
    }

    // Verify category exists
    const categoryCheck = await dbQuery(
      'SELECT id FROM categories WHERE id = $1',
      [categoryId],
    )

    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      })
    }

    // Validate mediaPurpose
    const validPurposes = ['thumbnail', 'banner', 'icon', 'video']
    if (!validPurposes.includes(mediaPurpose)) {
      return res.status(400).json({
        success: false,
        message: `Invalid media purpose. Must be one of: ${validPurposes.join(
          ', ',
        )}`,
      })
    }

    // Determine if it's an image or video
    const isImage = file.mimetype.startsWith('image/')
    const isVideo = file.mimetype.startsWith('video/')

    let mediaData: any = {}

    if (isImage) {
      // Validate image
      const validation = validateImageFile(file)
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        })
      }

      // Process image (optimize and create multiple sizes)
      const processed = await processCategoryImage(file)

      mediaData = {
        type: 'image',
        url: processed.original.url,
        thumbnailUrl: processed.optimized.thumbnail.url,
        width: processed.original.width,
        height: processed.original.height,
        fileSize: processed.original.fileSize,
        format: 'webp',
        cdnUrls: generateCdnUrls(processed.original.url, processed.optimized),
      }
    } else if (isVideo) {
      // Validate video
      const validation = validateVideoFile(file)
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        })
      }

      // Process video
      const processed = await processVideo(file, 'category')

      mediaData = {
        type: 'video',
        url: processed.url,
        thumbnailUrl: processed.thumbnailUrl,
        fileSize: processed.fileSize,
        format: processed.format,
        cdnUrls: generateCdnUrls(processed.url),
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type',
      })
    }

    // Insert into database
    const result = await dbQuery(
      `INSERT INTO category_media 
       (category_id, type, media_purpose, url, thumbnail_url, alt_text, title, position,
        file_size, width, height, format, cdn_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        categoryId,
        mediaData.type,
        mediaPurpose,
        mediaData.url,
        mediaData.thumbnailUrl,
        altText || null,
        title || null,
        position,
        mediaData.fileSize,
        mediaData.width || null,
        mediaData.height || null,
        mediaData.format,
        JSON.stringify(mediaData.cdnUrls),
      ],
    )

    res.status(201).json({
      success: true,
      message: 'Media uploaded successfully',
      data: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error uploading category media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: error.message,
    })
  }
}

// =====================================================
// GET ALL CATEGORY MEDIA
// =====================================================

export const getCategoryMedia = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params
    const { type, purpose } = req.query // Optional filters

    let query = 'SELECT * FROM category_media WHERE category_id = $1'
    const params: any[] = [categoryId]
    let paramCount = 2

    if (type && (type === 'image' || type === 'video')) {
      query += ` AND type = $${paramCount++}`
      params.push(type)
    }

    if (
      purpose &&
      ['thumbnail', 'banner', 'icon', 'video'].includes(purpose as string)
    ) {
      query += ` AND media_purpose = $${paramCount++}`
      params.push(purpose)
    }

    query += ' ORDER BY position ASC, created_at ASC'

    const result = await dbQuery(query, params)

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    })
  } catch (error: any) {
    console.error('Error fetching category media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media',
      error: error.message,
    })
  }
}

// =====================================================
// GET SINGLE MEDIA ITEM
// =====================================================

export const getMediaById = async (req: Request, res: Response) => {
  try {
    const { categoryId, mediaId } = req.params

    const result = await dbQuery(
      'SELECT * FROM category_media WHERE id = $1 AND category_id = $2',
      [mediaId, categoryId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      })
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error fetching media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media',
      error: error.message,
    })
  }
}

// =====================================================
// UPDATE CATEGORY MEDIA
// =====================================================

export const updateCategoryMedia = async (req: Request, res: Response) => {
  try {
    const { categoryId, mediaId } = req.params
    const { altText, title, position, mediaPurpose } = req.body

    // Check if media exists
    const mediaCheck = await dbQuery(
      'SELECT * FROM category_media WHERE id = $1 AND category_id = $2',
      [mediaId, categoryId],
    )

    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      })
    }

    // Validate mediaPurpose if provided
    if (mediaPurpose) {
      const validPurposes = ['thumbnail', 'banner', 'icon', 'video']
      if (!validPurposes.includes(mediaPurpose)) {
        return res.status(400).json({
          success: false,
          message: `Invalid media purpose. Must be one of: ${validPurposes.join(
            ', ',
          )}`,
        })
      }
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (altText !== undefined) {
      updates.push(`alt_text = $${paramCount++}`)
      values.push(altText)
    }

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`)
      values.push(title)
    }

    if (position !== undefined) {
      updates.push(`position = $${paramCount++}`)
      values.push(position)
    }

    if (mediaPurpose !== undefined) {
      updates.push(`media_purpose = $${paramCount++}`)
      values.push(mediaPurpose)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      })
    }

    values.push(mediaId, categoryId)

    const result = await dbQuery(
      `UPDATE category_media 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount} AND category_id = $${paramCount + 1}
       RETURNING *`,
      values,
    )

    res.status(200).json({
      success: true,
      message: 'Media updated successfully',
      data: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error updating category media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update media',
      error: error.message,
    })
  }
}

// =====================================================
// DELETE CATEGORY MEDIA
// =====================================================

export const deleteCategoryMedia = async (req: Request, res: Response) => {
  try {
    const { categoryId, mediaId } = req.params

    // Get media details
    const mediaCheck = await dbQuery(
      'SELECT * FROM category_media WHERE id = $1 AND category_id = $2',
      [mediaId, categoryId],
    )

    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      })
    }

    const media = mediaCheck.rows[0]

    // Delete from database
    await dbQuery('DELETE FROM category_media WHERE id = $1', [mediaId])

    // Delete physical files
    await deleteMediaFile(media.url)
    if (media.thumbnail_url) {
      await deleteMediaFile(media.thumbnail_url)
    }

    res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting category media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message,
    })
  }
}
