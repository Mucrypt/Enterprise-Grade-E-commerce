import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

export const getSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    const result = await query(
      'SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY name ASC LIMIT $1 OFFSET $2',
      [limit, offset],
    )

    const countResult = await query(
      'SELECT COUNT(*) FROM suppliers WHERE deleted_at IS NULL',
      [],
    )

    const total = parseInt(countResult.rows[0].count)

    res.json({
      success: true,
      data: {
        suppliers: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get suppliers error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get suppliers',
    })
  }
}

export const getSupplierById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'SELECT * FROM suppliers WHERE id = $1 AND deleted_at IS NULL',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
      })
    }

    res.json({
      success: true,
      data: {
        supplier: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Get supplier error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get supplier',
    })
  }
}

export const createSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { name, contactPerson, email, phone, address } = req.body

    res.status(201).json({
      success: true,
      message: 'Create supplier - Not yet fully implemented',
      data: {
        name,
        contactPerson,
        email,
        phone,
        address,
      },
    })
  } catch (error) {
    logger.error('Create supplier error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create supplier',
    })
  }
}

export const updateSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const updates = req.body

    res.json({
      success: true,
      message: 'Update supplier - Not yet fully implemented',
      data: {
        supplierId: id,
        updates,
      },
    })
  } catch (error) {
    logger.error('Update supplier error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update supplier',
    })
  }
}

export const deleteSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    res.json({
      success: true,
      message: 'Delete supplier - Not yet fully implemented',
      data: {
        supplierId: id,
      },
    })
  } catch (error) {
    logger.error('Delete supplier error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete supplier',
    })
  }
}

export const syncSupplierProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    res.json({
      success: true,
      message: 'Sync supplier products - Not yet implemented',
      data: {
        supplierId: id,
      },
    })
  } catch (error) {
    logger.error('Sync supplier products error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to sync supplier products',
    })
  }
}

export const getSupplierProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    res.json({
      success: true,
      data: {
        supplierId: id,
        products: [],
      },
    })
  } catch (error) {
    logger.error('Get supplier products error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get supplier products',
    })
  }
}
