import { Request, Response } from 'express'
import { query as dbQuery, getClient } from '../../../database/connection'
import {
  upload,
  processProductImage,
  processVideo,
  validateImageFile,
  validateVideoFile,
  deleteMediaFile,
  generateCdnUrls,
} from '../../../utils/media'

// =====================================================
// UPLOAD PRODUCT MEDIA (Image or Video)
// =====================================================

export const uploadProductMedia = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params
    const { altText, title, position = 0, isPrimary = false } = req.body
    const file = req.file

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      })
    }

    // Verify product exists
    const productCheck = await dbQuery(
      'SELECT id FROM products WHERE id = $1',
      [productId],
    )

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
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
      const processed = await processProductImage(file)

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
      const processed = await processVideo(file, 'product')

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
      `INSERT INTO product_media 
       (product_id, type, url, thumbnail_url, alt_text, title, position, is_primary, 
        file_size, width, height, format, cdn_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        productId,
        mediaData.type,
        mediaData.url,
        mediaData.thumbnailUrl,
        altText || null,
        title || null,
        position,
        isPrimary,
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
    console.error('Error uploading product media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: error.message,
    })
  }
}

// =====================================================
// GET ALL PRODUCT MEDIA
// =====================================================

export const getProductMedia = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params
    const { type } = req.query // Optional filter by type (image/video)

    let query = 'SELECT * FROM product_media WHERE product_id = $1'
    const params: any[] = [productId]

    if (type && (type === 'image' || type === 'video')) {
      query += ' AND type = $2'
      params.push(type)
    }

    query += ' ORDER BY position ASC, created_at ASC'

    const result = await dbQuery(query, params)

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    })
  } catch (error: any) {
    console.error('Error fetching product media:', error)
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
    const { productId, mediaId } = req.params

    const result = await dbQuery(
      'SELECT * FROM product_media WHERE id = $1 AND product_id = $2',
      [mediaId, productId],
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
// UPDATE PRODUCT MEDIA
// =====================================================

export const updateProductMedia = async (req: Request, res: Response) => {
  try {
    const { productId, mediaId } = req.params
    const { altText, title, position, isPrimary } = req.body

    // Check if media exists
    const mediaCheck = await dbQuery(
      'SELECT * FROM product_media WHERE id = $1 AND product_id = $2',
      [mediaId, productId],
    )

    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      })
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

    if (isPrimary !== undefined) {
      updates.push(`is_primary = $${paramCount++}`)
      values.push(isPrimary)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      })
    }

    values.push(mediaId, productId)

    const result = await dbQuery(
      `UPDATE product_media 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount} AND product_id = $${paramCount + 1}
       RETURNING *`,
      values,
    )

    res.status(200).json({
      success: true,
      message: 'Media updated successfully',
      data: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error updating product media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update media',
      error: error.message,
    })
  }
}

// =====================================================
// DELETE PRODUCT MEDIA
// =====================================================

export const deleteProductMedia = async (req: Request, res: Response) => {
  try {
    const { productId, mediaId } = req.params

    // Get media details
    const mediaCheck = await dbQuery(
      'SELECT * FROM product_media WHERE id = $1 AND product_id = $2',
      [mediaId, productId],
    )

    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      })
    }

    const media = mediaCheck.rows[0]

    // Delete from database
    await dbQuery('DELETE FROM product_media WHERE id = $1', [mediaId])

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
    console.error('Error deleting product media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message,
    })
  }
}

// =====================================================
// REORDER PRODUCT MEDIA
// =====================================================

export const reorderProductMedia = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params
    const { mediaOrder } = req.body // Array of { mediaId, position }

    if (!Array.isArray(mediaOrder) || mediaOrder.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media order data',
      })
    }

    // Start transaction
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Update each media item's position
      for (const item of mediaOrder) {
        await client.query(
          'UPDATE product_media SET position = $1 WHERE id = $2 AND product_id = $3',
          [item.position, item.mediaId, productId],
        )
      }

      await client.query('COMMIT')

      // Fetch updated media list
      const result = await dbQuery(
        'SELECT * FROM product_media WHERE product_id = $1 ORDER BY position ASC',
        [productId],
      )

      res.status(200).json({
        success: true,
        message: 'Media reordered successfully',
        data: result.rows,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error reordering product media:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reorder media',
      error: error.message,
    })
  }
}

// =====================================================
// SET PRIMARY IMAGE
// =====================================================

export const setPrimaryImage = async (req: Request, res: Response) => {
  try {
    const { productId, mediaId } = req.params

    // Check if media exists and is an image
    const mediaCheck = await dbQuery(
      'SELECT * FROM product_media WHERE id = $1 AND product_id = $2 AND type = $3',
      [mediaId, productId, 'image'],
    )

    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      })
    }

    // The trigger will automatically set other images to is_primary = false
    const result = await dbQuery(
      'UPDATE product_media SET is_primary = true WHERE id = $1 RETURNING *',
      [mediaId],
    )

    res.status(200).json({
      success: true,
      message: 'Primary image set successfully',
      data: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error setting primary image:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to set primary image',
      error: error.message,
    })
  }
}
