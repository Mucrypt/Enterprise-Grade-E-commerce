import { Request, Response } from 'express'
import { StaffAuthRequest } from '../../../middleware/staff'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

// Public: list a category's filterable attribute definitions -- backs the
// storefront's FilterSidebar. Only 'select'-type attributes have a real
// controlled vocabulary (their own admin-defined `options` array), so
// text/number attributes are still returned (for PDP/card display) but the
// storefront only turns 'select' ones into filter checkboxes.
export const getCategoryAttributes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      `SELECT id, category_id, name, input_type, options, unit, display_order, is_filterable
       FROM category_attributes
       WHERE category_id = $1
       ORDER BY display_order ASC, name ASC`,
      [id],
    )

    res.json({
      success: true,
      data: { attributes: result.rows },
    })
  } catch (error) {
    logger.error('Get category attributes error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category attributes',
    })
  }
}

export const createCategoryAttribute = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { categoryId, name, inputType, options, unit, displayOrder, isFilterable } = req.body

    if (!categoryId || !name || !inputType) {
      return res.status(400).json({
        success: false,
        error: 'categoryId, name, and inputType are required',
      })
    }

    if (!['text', 'number', 'select'].includes(inputType)) {
      return res.status(400).json({
        success: false,
        error: "inputType must be 'text', 'number', or 'select'",
      })
    }

    const result = await query(
      `INSERT INTO category_attributes
        (category_id, name, input_type, options, unit, display_order, is_filterable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        categoryId,
        String(name).trim(),
        inputType,
        Array.isArray(options) ? options : null,
        unit || null,
        displayOrder ?? 0,
        isFilterable ?? true,
      ],
    )

    res.status(201).json({
      success: true,
      data: { attribute: result.rows[0] },
    })
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'This category already has an attribute with that name',
      })
    }
    logger.error('Create category attribute error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create category attribute',
    })
  }
}

export const updateCategoryAttribute = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, inputType, options, unit, displayOrder, isFilterable } = req.body

    if (inputType && !['text', 'number', 'select'].includes(inputType)) {
      return res.status(400).json({
        success: false,
        error: "inputType must be 'text', 'number', or 'select'",
      })
    }

    const result = await query(
      `UPDATE category_attributes
       SET name = COALESCE($2, name),
           input_type = COALESCE($3, input_type),
           options = COALESCE($4, options),
           unit = COALESCE($5, unit),
           display_order = COALESCE($6, display_order),
           is_filterable = COALESCE($7, is_filterable),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name ? String(name).trim() : null,
        inputType || null,
        Array.isArray(options) ? options : null,
        unit !== undefined ? unit : null,
        displayOrder !== undefined ? displayOrder : null,
        isFilterable !== undefined ? isFilterable : null,
      ],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Attribute not found' })
    }

    res.json({
      success: true,
      data: { attribute: result.rows[0] },
    })
  } catch (error) {
    logger.error('Update category attribute error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update category attribute',
    })
  }
}

export const deleteCategoryAttribute = async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    // ON DELETE CASCADE on product_attribute_values.attribute_id means
    // deleting a definition also removes every product's value for it --
    // an intentional, documented consequence, not a silent surprise.
    const result = await query('DELETE FROM category_attributes WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Attribute not found' })
    }

    res.json({ success: true, message: 'Attribute deleted' })
  } catch (error) {
    logger.error('Delete category attribute error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete category attribute',
    })
  }
}
