import { Request, Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { AuthRequest } from '../../../middleware/auth'

// Get all brands
export const getBrands = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, search, isActive } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (search) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`,
      )
      values.push(`%${search}%`)
      paramIndex++
    }

    if (isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex}`)
      values.push(isActive === 'true')
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM brands ${whereClause}`,
      values,
    )
    const total = parseInt(countResult.rows[0].count)

    // Get brands
    const result = await query(
      `SELECT * FROM brands ${whereClause}
       ORDER BY name ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset],
    )

    res.json({
      success: true,
      data: {
        brands: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get brands error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brands',
    })
  }
}

// Get single brand
export const getBrandById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await query('SELECT * FROM brands WHERE id = $1', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found',
      })
    }

    res.json({
      success: true,
      data: {
        brand: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Get brand by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brand',
    })
  }
}

// Create brand
export const createBrand = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      slug,
      description,
      logoUrl,
      websiteUrl,
      isActive = true,
    } = req.body

    // Check if brand name or slug exists
    const existingBrand = await query(
      'SELECT id FROM brands WHERE name = $1 OR slug = $2',
      [name, slug],
    )

    if (existingBrand.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Brand with this name or slug already exists',
      })
    }

    const result = await query(
      `INSERT INTO brands (name, slug, description, logo_url, website_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, slug, description, logoUrl, websiteUrl, isActive],
    )

    logger.info('Brand created:', { brandId: result.rows[0].id, name })

    res.status(201).json({
      success: true,
      data: {
        brand: result.rows[0],
      },
      message: 'Brand created successfully',
    })
  } catch (error) {
    logger.error('Create brand error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create brand',
    })
  }
}

// Update brand
export const updateBrand = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, slug, description, logoUrl, websiteUrl, isActive } = req.body

    // Check if brand exists
    const existingBrand = await query('SELECT * FROM brands WHERE id = $1', [
      id,
    ])

    if (existingBrand.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found',
      })
    }

    // Check for duplicate name/slug if changed
    if (
      name !== existingBrand.rows[0].name ||
      slug !== existingBrand.rows[0].slug
    ) {
      const duplicateCheck = await query(
        'SELECT id FROM brands WHERE (name = $1 OR slug = $2) AND id != $3',
        [name, slug, id],
      )
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Brand with this name or slug already exists',
        })
      }
    }

    const result = await query(
      `UPDATE brands SET 
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        description = COALESCE($3, description),
        logo_url = COALESCE($4, logo_url),
        website_url = COALESCE($5, website_url),
        is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [name, slug, description, logoUrl, websiteUrl, isActive, id],
    )

    logger.info('Brand updated:', { brandId: id })

    res.json({
      success: true,
      data: {
        brand: result.rows[0],
      },
      message: 'Brand updated successfully',
    })
  } catch (error) {
    logger.error('Update brand error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update brand',
    })
  }
}

// Delete brand
export const deleteBrand = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Check if brand exists
    const existingBrand = await query('SELECT * FROM brands WHERE id = $1', [
      id,
    ])

    if (existingBrand.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found',
      })
    }

    // Check if brand is used by products
    const productsUsingBrand = await query(
      'SELECT COUNT(*) FROM products WHERE brand_id = $1',
      [id],
    )

    if (parseInt(productsUsingBrand.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete brand. It is used by ${productsUsingBrand.rows[0].count} product(s).`,
      })
    }

    await query('DELETE FROM brands WHERE id = $1', [id])

    logger.info('Brand deleted:', { brandId: id })

    res.json({
      success: true,
      message: 'Brand deleted successfully',
    })
  } catch (error) {
    logger.error('Delete brand error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete brand',
    })
  }
}

// Bulk update brands
export const bulkUpdateBrands = async (req: AuthRequest, res: Response) => {
  try {
    const { ids, data } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Brand IDs array is required',
      })
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Update data is required',
      })
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`)
      values.push(data.is_active)
      paramIndex++
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid update fields provided',
      })
    }

    const placeholders = ids.map((_, i) => `$${paramIndex + i}`).join(', ')
    values.push(...ids)

    const result = await query(
      `UPDATE brands SET ${updates.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      values
    )

    logger.info('Bulk update brands:', { count: result.rowCount, ids })

    res.json({
      success: true,
      data: {
        updated: result.rowCount,
      },
      message: `${result.rowCount} brand(s) updated successfully`,
    })
  } catch (error) {
    logger.error('Bulk update brands error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update brands',
    })
  }
}

// Bulk delete brands
export const bulkDeleteBrands = async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Brand IDs array is required',
      })
    }

    // Check if any brands are used by products
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const productsCheck = await query(
      `SELECT brand_id, COUNT(*) as count FROM products WHERE brand_id IN (${placeholders}) GROUP BY brand_id`,
      ids
    )

    if (productsCheck.rows.length > 0) {
      const brandsInUse = productsCheck.rows.map((r: any) => r.brand_id)
      return res.status(400).json({
        success: false,
        error: `Cannot delete brands that are used by products. Brands in use: ${brandsInUse.length}`,
      })
    }

    const result = await query(
      `DELETE FROM brands WHERE id IN (${placeholders}) RETURNING id`,
      ids
    )

    logger.info('Bulk delete brands:', { count: result.rowCount, ids })

    res.json({
      success: true,
      data: {
        deleted: result.rowCount,
      },
      message: `${result.rowCount} brand(s) deleted successfully`,
    })
  } catch (error) {
    logger.error('Bulk delete brands error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete brands',
    })
  }
}
