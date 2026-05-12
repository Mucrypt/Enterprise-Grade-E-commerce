import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

async function logAdminActivity(options: {
  req: AuthRequest
  action: string
  resourceType: string
  resourceId?: string | null
  details?: Record<string, unknown>
}) {
  try {
    const adminId = options.req.user?.id
    if (!adminId) return

    await query(
      `INSERT INTO admin_activity_logs
        (admin_id, action, resource_type, resource_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        adminId,
        options.action,
        options.resourceType,
        options.resourceId || null,
        options.req.ip || null,
        options.req.headers['user-agent'] || null,
        JSON.stringify(options.details || {}),
      ],
    )
  } catch (error) {
    logger.warn('Failed to write admin activity log', error)
  }
}

export const getSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, sourcePlatform, search } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    const filters: string[] = ['deleted_at IS NULL']
    const values: Array<string | number> = []

    if (status) {
      values.push(String(status))
      filters.push(`status = $${values.length}`)
    }

    if (sourcePlatform) {
      values.push(String(sourcePlatform))
      filters.push(`source_platform = $${values.length}`)
    }

    if (search) {
      values.push(`%${String(search).trim()}%`)
      filters.push(
        `(company_name ILIKE $${values.length} OR contact_name ILIKE $${values.length} OR email ILIKE $${values.length})`,
      )
    }

    values.push(Number(limit), offset)

    const result = await query(
      `SELECT *
       FROM suppliers
       WHERE ${filters.join(' AND ')}
       ORDER BY company_name ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )

    const countValues = values.slice(0, Math.max(values.length - 2, 0))
    const countResult = await query(
      `SELECT COUNT(*)
       FROM suppliers
       WHERE ${filters.join(' AND ')}`,
      countValues,
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
    const {
      companyName,
      contactName,
      email,
      phone,
      address,
      sourcePlatform,
      countryCode,
      status,
      paymentTerms,
      leadTimeDays,
    } = req.body

    if (!companyName || !email) {
      return res.status(400).json({
        success: false,
        error: 'companyName and email are required',
      })
    }

    const result = await query(
      `INSERT INTO suppliers
        (company_name, contact_name, email, phone, address, source_platform, country_code, status, payment_terms, lead_time_days)
       VALUES ($1, $2, LOWER($3), $4, $5::jsonb, $6, $7, COALESCE($8, 'active'), $9, COALESCE($10, 7))
       RETURNING *`,
      [
        String(companyName).trim(),
        contactName ? String(contactName).trim() : null,
        String(email).trim(),
        phone ? String(phone).trim() : null,
        address ? JSON.stringify(address) : null,
        sourcePlatform ? String(sourcePlatform) : 'other',
        countryCode ? String(countryCode).toUpperCase() : null,
        status ? String(status) : 'active',
        paymentTerms ? String(paymentTerms) : null,
        leadTimeDays ? Number(leadTimeDays) : 7,
      ],
    )

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: {
        supplier: result.rows[0],
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
    const {
      companyName,
      contactName,
      email,
      phone,
      address,
      sourcePlatform,
      countryCode,
      status,
      rating,
      onTimeRate,
      defectRate,
      refundRate,
      paymentTerms,
      leadTimeDays,
    } = req.body

    const previousResult = await query(
      `SELECT status
       FROM suppliers
       WHERE id = $1
         AND deleted_at IS NULL`,
      [id],
    )

    if (previousResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
      })
    }

    const previousStatus = previousResult.rows[0].status

    const result = await query(
      `UPDATE suppliers
       SET company_name = COALESCE($2, company_name),
           contact_name = COALESCE($3, contact_name),
           email = COALESCE(LOWER($4), email),
           phone = COALESCE($5, phone),
           address = COALESCE($6::jsonb, address),
           source_platform = COALESCE($7, source_platform),
           country_code = COALESCE($8, country_code),
           status = COALESCE($9, status),
           rating = COALESCE($10, rating),
           on_time_rate = COALESCE($11, on_time_rate),
           defect_rate = COALESCE($12, defect_rate),
           refund_rate = COALESCE($13, refund_rate),
           payment_terms = COALESCE($14, payment_terms),
           lead_time_days = COALESCE($15, lead_time_days),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING *`,
      [
        id,
        companyName ? String(companyName).trim() : null,
        contactName ? String(contactName).trim() : null,
        email ? String(email).trim() : null,
        phone ? String(phone).trim() : null,
        address ? JSON.stringify(address) : null,
        sourcePlatform ? String(sourcePlatform) : null,
        countryCode ? String(countryCode).toUpperCase() : null,
        status ? String(status) : null,
        rating !== undefined ? Number(rating) : null,
        onTimeRate !== undefined ? Number(onTimeRate) : null,
        defectRate !== undefined ? Number(defectRate) : null,
        refundRate !== undefined ? Number(refundRate) : null,
        paymentTerms ? String(paymentTerms) : null,
        leadTimeDays !== undefined ? Number(leadTimeDays) : null,
      ],
    )

    const updatedSupplier = result.rows[0]

    if (status && String(status) !== String(previousStatus || '')) {
      await logAdminActivity({
        req,
        action: 'update_supplier_status',
        resourceType: 'suppliers',
        resourceId: id,
        details: {
          from: previousStatus,
          to: updatedSupplier.status,
          supplierEmail: updatedSupplier.email,
        },
      })
    }

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: {
        supplier: updatedSupplier,
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

    const result = await query(
      `UPDATE suppliers
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id`,
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
      message: 'Supplier deleted successfully',
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

    const result = await query(
      `SELECT
         sp.id,
         sp.supplier_id,
         sp.product_id,
         p.name AS product_name,
         p.slug AS product_slug,
         p.sku AS product_sku,
         sp.supplier_product_id,
         sp.supplier_sku,
         sp.cost_price,
         sp.shipping_cost,
         sp.currency_code,
         sp.stock_quantity,
         sp.min_order_quantity,
         sp.lead_time_days,
         sp.estimated_delivery_days,
         sp.is_primary,
         sp.is_available,
         sp.supplier_url,
         sp.last_updated
       FROM supplier_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.supplier_id = $1
       ORDER BY sp.is_primary DESC, p.name ASC`,
      [id],
    )

    res.json({
      success: true,
      data: {
        supplierId: id,
        products: result.rows,
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

export const upsertSupplierProductOffer = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params
    const {
      productId,
      supplierProductId,
      supplierSku,
      costPrice,
      shippingCost,
      currencyCode,
      stockQuantity,
      minOrderQuantity,
      estimatedDeliveryDays,
      leadTimeDays,
      isAvailable,
      isPrimary,
      supplierUrl,
    } = req.body

    if (!productId || costPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: 'productId and costPrice are required',
      })
    }

    const result = await query(
      `INSERT INTO supplier_products
        (supplier_id, product_id, supplier_product_id, supplier_sku, cost_price, shipping_cost, currency_code, stock_quantity, min_order_quantity, estimated_delivery_days, lead_time_days, is_available, is_primary, supplier_url, last_updated)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), COALESCE($7, 'USD'), COALESCE($8, 0), COALESCE($9, 1), $10, $11, COALESCE($12, true), COALESCE($13, false), $14, CURRENT_TIMESTAMP)
       ON CONFLICT (supplier_id, product_id)
       DO UPDATE SET
         supplier_product_id = EXCLUDED.supplier_product_id,
         supplier_sku = EXCLUDED.supplier_sku,
         cost_price = EXCLUDED.cost_price,
         shipping_cost = EXCLUDED.shipping_cost,
         currency_code = EXCLUDED.currency_code,
         stock_quantity = EXCLUDED.stock_quantity,
         min_order_quantity = EXCLUDED.min_order_quantity,
         estimated_delivery_days = EXCLUDED.estimated_delivery_days,
         lead_time_days = EXCLUDED.lead_time_days,
         is_available = EXCLUDED.is_available,
         is_primary = EXCLUDED.is_primary,
         supplier_url = EXCLUDED.supplier_url,
         last_updated = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        id,
        productId,
        supplierProductId ? String(supplierProductId) : null,
        supplierSku ? String(supplierSku) : null,
        Number(costPrice),
        shippingCost !== undefined ? Number(shippingCost) : 0,
        currencyCode ? String(currencyCode).toUpperCase() : 'USD',
        stockQuantity !== undefined ? Number(stockQuantity) : 0,
        minOrderQuantity !== undefined ? Number(minOrderQuantity) : 1,
        estimatedDeliveryDays !== undefined ? Number(estimatedDeliveryDays) : null,
        leadTimeDays !== undefined ? Number(leadTimeDays) : null,
        isAvailable !== undefined ? Boolean(isAvailable) : true,
        isPrimary !== undefined ? Boolean(isPrimary) : false,
        supplierUrl ? String(supplierUrl) : null,
      ],
    )

    res.status(201).json({
      success: true,
      message: 'Supplier offer upserted successfully',
      data: {
        offer: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Upsert supplier offer error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to upsert supplier offer',
    })
  }
}

export const getProductEconomics = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params

    const result = await query(
      `SELECT
         pue.*, p.name AS product_name, p.slug AS product_slug
       FROM product_unit_economics pue
       JOIN products p ON p.id = pue.product_id
       WHERE pue.product_id = $1`,
      [productId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product economics not found',
      })
    }

    const flagsResult = await query(
      `SELECT auto_pause, pause_reason, is_publish_blocked, publish_block_reason, updated_at
       FROM product_operational_flags
       WHERE product_id = $1`,
      [productId],
    )

    res.json({
      success: true,
      data: {
        economics: result.rows[0],
        flags: flagsResult.rows[0] || null,
      },
    })
  } catch (error) {
    logger.error('Get product economics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get product economics',
    })
  }
}

export const recomputeProductEconomics = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { productId } = req.params
    const {
      adCostPerOrder = 0,
      paymentFee = 0,
      expectedRefundCost = 0,
      fallbackShippingCost = 0,
    } = req.body || {}

    const productResult = await query(
      `SELECT id, base_price, sale_price, cost_price
       FROM products
       WHERE id = $1
         AND deleted_at IS NULL`,
      [productId],
    )

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      })
    }

    const bestOfferResult = await query(
      `SELECT cost_price, shipping_cost
       FROM supplier_products
       WHERE product_id = $1
         AND is_available = true
       ORDER BY is_primary DESC, cost_price ASC, shipping_cost ASC
       LIMIT 1`,
      [productId],
    )

    const product = productResult.rows[0]
    const offer = bestOfferResult.rows[0]
    const sellPrice = Number(product.sale_price || product.base_price || 0)
    const unitCost = Number(offer?.cost_price ?? product.cost_price ?? 0)
    const shippingCost = Number(offer?.shipping_cost ?? fallbackShippingCost)
    const landedCost = unitCost + shippingCost
    const grossMargin = sellPrice - landedCost
    const contributionMargin =
      grossMargin - Number(paymentFee) - Number(adCostPerOrder) - Number(expectedRefundCost)
    const marginPercent = sellPrice > 0 ? (contributionMargin / sellPrice) * 100 : 0

    const upsert = await query(
      `INSERT INTO product_unit_economics
        (product_id, sell_price, landed_cost, payment_fee, ad_cost_per_order, expected_refund_cost, gross_margin, contribution_margin, margin_percent, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       ON CONFLICT (product_id)
       DO UPDATE SET
         sell_price = EXCLUDED.sell_price,
         landed_cost = EXCLUDED.landed_cost,
         payment_fee = EXCLUDED.payment_fee,
         ad_cost_per_order = EXCLUDED.ad_cost_per_order,
         expected_refund_cost = EXCLUDED.expected_refund_cost,
         gross_margin = EXCLUDED.gross_margin,
         contribution_margin = EXCLUDED.contribution_margin,
         margin_percent = EXCLUDED.margin_percent,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        productId,
        sellPrice,
        landedCost,
        Number(paymentFee),
        Number(adCostPerOrder),
        Number(expectedRefundCost),
        grossMargin,
        contributionMargin,
        marginPercent,
      ],
    )

    res.json({
      success: true,
      message: 'Product economics recomputed successfully',
      data: {
        economics: upsert.rows[0],
      },
    })
  } catch (error) {
    logger.error('Recompute product economics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to recompute product economics',
    })
  }
}

export const evaluateProductAutoPause = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { productId } = req.params
    const marginFloorPercent = Number(req.body?.marginFloorPercent ?? 10)

    const economicsResult = await query(
      `SELECT contribution_margin, margin_percent
       FROM product_unit_economics
       WHERE product_id = $1`,
      [productId],
    )

    if (economicsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Run economics recompute first for this product',
      })
    }

    const economics = economicsResult.rows[0]
    const marginPercent = Number(economics.margin_percent || 0)
    const contributionMargin = Number(economics.contribution_margin || 0)
    const shouldPause = contributionMargin <= 0 || marginPercent < marginFloorPercent
    const pauseReason = shouldPause
      ? `Contribution margin too low (margin ${marginPercent.toFixed(2)}%, floor ${marginFloorPercent.toFixed(2)}%)`
      : null

    const flagResult = await query(
      `INSERT INTO product_operational_flags
        (product_id, auto_pause, pause_reason, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (product_id)
       DO UPDATE SET
         auto_pause = EXCLUDED.auto_pause,
         pause_reason = EXCLUDED.pause_reason,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [productId, shouldPause, pauseReason],
    )

    await logAdminActivity({
      req,
      action: 'evaluate_product_auto_pause',
      resourceType: 'products',
      resourceId: productId,
      details: {
        shouldPause,
        marginFloorPercent,
        marginPercent,
        contributionMargin,
        pauseReason,
      },
    })

    res.json({
      success: true,
      data: {
        shouldPause,
        marginFloorPercent,
        economics: {
          marginPercent,
          contributionMargin,
        },
        flags: flagResult.rows[0],
      },
    })
  } catch (error) {
    logger.error('Evaluate auto pause error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate auto pause',
    })
  }
}

export const getAutoPausedProducts = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { limit = 20 } = req.query

    const result = await query(
      `SELECT
         p.id AS product_id,
         p.name AS product_name,
         p.slug AS product_slug,
         p.sku,
         pof.auto_pause,
         pof.pause_reason,
         pof.updated_at AS paused_at,
         pue.margin_percent,
         pue.contribution_margin,
         pue.sell_price,
         pue.landed_cost
       FROM product_operational_flags pof
       JOIN products p ON p.id = pof.product_id
       LEFT JOIN product_unit_economics pue ON pue.product_id = p.id
       WHERE pof.auto_pause = true
         AND p.deleted_at IS NULL
       ORDER BY pof.updated_at DESC
       LIMIT $1`,
      [Number(limit)],
    )

    res.json({
      success: true,
      data: {
        items: result.rows,
      },
    })
  } catch (error) {
    logger.error('Get auto paused products error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get auto paused products',
    })
  }
}
