import { Response } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { AuthRequest } from '../../../middleware/auth'
import { query, getClient } from '../../../database/connection'
import logger from '../../../utils/logger'
import { StaffAuthRequest, isCountryInScope } from '../../../middleware/staff'
import { recordStaffAuditEvent } from '../../../services/staff-audit.service'

// v1 supports a fixed CSV header format only. Flexible column-mapping is a future improvement.
const REQUIRED_COLUMNS = ['sku', 'product_name', 'cost_price', 'stock_quantity', 'lead_time_days']

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')
    if (isCsv) {
      cb(null, true)
    } else {
      cb(new Error('Only .csv files are supported in this version'))
    }
  },
})

// Helper to generate slug from name (matches the pattern used elsewhere, e.g. category.controller.ts)
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}


//
interface ParsedRow {
  rowNumber: number
  sku: string
  productName: string
  costPrice: number
  stockQuantity: number
  leadTimeDays: number | null
  currencyCode: string
  action: 'create' | 'update'
  existingProductId?: string
}

interface RowError {
  rowNumber: number
  reason: string
}

function parseAndValidateCsv(buffer: Buffer): {
  validRows: ParsedRow[]
  errors: RowError[]
} {
  const records: Record<string, string>[] = parse(buffer, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
  })

  if (records.length > 0) {
    const missingColumns = REQUIRED_COLUMNS.filter((col) => !(col in records[0]))
    if (missingColumns.length > 0) {
      throw new Error(
        `CSV is missing required column(s): ${missingColumns.join(', ')}. Expected headers: ${REQUIRED_COLUMNS.join(', ')}, currency_code (optional)`,
      )
    }
  }

  const errors: RowError[] = []
  const validRows: ParsedRow[] = []
  const seenSkus = new Set<string>()

  records.forEach((record, index) => {
    const rowNumber = index + 2 // +1 for zero-index, +1 for header row
    const sku = (record.sku || '').trim()
    const productName = (record.product_name || '').trim()
    const costPriceRaw = (record.cost_price || '').trim()
    const stockQuantityRaw = (record.stock_quantity || '').trim()
    const leadTimeDaysRaw = (record.lead_time_days || '').trim()
    const currencyCode = (record.currency_code || 'EUR').trim().toUpperCase() || 'EUR'

    if (!sku) {
      errors.push({ rowNumber, reason: 'Missing sku' })
      return
    }
    if (seenSkus.has(sku)) {
      errors.push({ rowNumber, reason: `Duplicate sku "${sku}" within this file` })
      return
    }
    if (!productName) {
      errors.push({ rowNumber, reason: 'Missing product_name' })
      return
    }

    const costPrice = Number(costPriceRaw)
    if (!costPriceRaw || Number.isNaN(costPrice) || costPrice < 0) {
      errors.push({ rowNumber, reason: `Invalid cost_price "${costPriceRaw}"` })
      return
    }

    const stockQuantity = stockQuantityRaw === '' ? 0 : Number(stockQuantityRaw)
    if (Number.isNaN(stockQuantity) || stockQuantity < 0) {
      errors.push({ rowNumber, reason: `Invalid stock_quantity "${stockQuantityRaw}"` })
      return
    }

    const leadTimeDays = leadTimeDaysRaw === '' ? null : Number(leadTimeDaysRaw)
    if (leadTimeDays !== null && (Number.isNaN(leadTimeDays) || leadTimeDays < 0)) {
      errors.push({ rowNumber, reason: `Invalid lead_time_days "${leadTimeDaysRaw}"` })
      return
    }

    seenSkus.add(sku)
    validRows.push({
      rowNumber,
      sku,
      productName,
      costPrice,
      stockQuantity,
      leadTimeDays,
      currencyCode,
      action: 'create',
    })
  })

  return { validRows, errors }
}

export const previewSupplierImport = async (req: AuthRequest, res: Response) => {
  try {
    const { id: supplierId } = req.params
    const file = req.file

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Attach a .csv file as "file".',
      })
    }

    const supplierResult = await query(
      'SELECT id, country_code FROM suppliers WHERE id = $1 AND deleted_at IS NULL',
      [supplierId],
    )
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' })
    }
    const supplierCountry = supplierResult.rows[0].country_code
    if (!isCountryInScope(req as StaffAuthRequest, supplierCountry)) {
      recordStaffAuditEvent({
        action: 'PERMISSION_DENIED',
        actorUserId: (req as StaffAuthRequest).user?.userId,
        metadata: {
          check: 'market_scope',
          resourceType: 'supplier',
          resourceId: supplierId,
          requestedCountry: supplierCountry || null,
        },
      })
      return res.status(404).json({ success: false, error: 'Supplier not found' })
    }

    let validRows: ParsedRow[]
    let errors: RowError[]
    try {
      const parsed = parseAndValidateCsv(file.buffer)
      validRows = parsed.validRows
      errors = parsed.errors
    } catch (parseError: any) {
      return res.status(400).json({ success: false, error: parseError.message })
    }

    if (validRows.length > 0) {
      const skus = validRows.map((row) => row.sku)
      const existingResult = await query(
        'SELECT id, sku FROM products WHERE sku = ANY($1::text[])',
        [skus],
      )
      const existingBySku = new Map<string, string>(
        existingResult.rows.map((row: any) => [row.sku, row.id]),
      )
      for (const row of validRows) {
        const existingId = existingBySku.get(row.sku)
        if (existingId) {
          row.action = 'update'
          row.existingProductId = existingId
        }
      }
    }

    const createCount = validRows.filter((r) => r.action === 'create').length
    const updateCount = validRows.filter((r) => r.action === 'update').length

    const batchResult = await query(
      `INSERT INTO supplier_import_batches
        (supplier_id, filename, status, total_rows, created_count, updated_count, failed_count, parsed_rows, error_report, created_by)
       VALUES ($1, $2, 'preview', $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
       RETURNING id, supplier_id, filename, status, total_rows, created_count, updated_count, failed_count, created_at`,
      [
        supplierId,
        file.originalname,
        validRows.length + errors.length,
        createCount,
        updateCount,
        errors.length,
        JSON.stringify(validRows),
        JSON.stringify(errors),
        req.user?.id || null,
      ],
    )

    res.status(201).json({
      success: true,
      message:
        'Import preview generated. Review the rows below, then commit to apply changes. New products are created as inactive drafts and must be reviewed before they appear on the storefront.',
      data: {
        batch: batchResult.rows[0],
        rowsToCreate: validRows.filter((r) => r.action === 'create'),
        rowsToUpdate: validRows.filter((r) => r.action === 'update'),
        errors,
      },
    })
  } catch (error) {
    logger.error('Preview supplier import error:', error)
    res.status(500).json({ success: false, error: 'Failed to preview supplier import' })
  }
}

export const commitSupplierImport = async (req: AuthRequest, res: Response) => {
  const { id: supplierId, batchId } = req.params

  const supplierResult = await query(
    'SELECT id, country_code FROM suppliers WHERE id = $1 AND deleted_at IS NULL',
    [supplierId],
  )
  if (supplierResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Supplier not found' })
  }
  const supplierCountry = supplierResult.rows[0].country_code
  if (!isCountryInScope(req as StaffAuthRequest, supplierCountry)) {
    recordStaffAuditEvent({
      action: 'PERMISSION_DENIED',
      actorUserId: (req as StaffAuthRequest).user?.userId,
      metadata: {
        check: 'market_scope',
        resourceType: 'supplier',
        resourceId: supplierId,
        requestedCountry: supplierCountry || null,
      },
    })
    return res.status(404).json({ success: false, error: 'Supplier not found' })
  }

  const batchResult = await query(
    'SELECT * FROM supplier_import_batches WHERE id = $1 AND supplier_id = $2',
    [batchId, supplierId],
  )

  if (batchResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Import batch not found for this supplier',
    })
  }

  const batch = batchResult.rows[0]

  if (batch.status !== 'preview') {
    return res.status(400).json({
      success: false,
      error: `This import batch is already "${batch.status}" and cannot be committed again.`,
    })
  }

  const rows: ParsedRow[] = batch.parsed_rows || []
  const client = await getClient()
  let createdCount = 0
  let updatedCount = 0

  try {
    await client.query('BEGIN')

    for (const row of rows) {
      let productId = row.existingProductId

      if (row.action === 'create' && !productId) {
        const slug = `${generateSlug(row.productName)}-${generateSlug(row.sku)}`
        // No retail price exists in a supplier cost feed: new products land as inactive
        // drafts with base_price temporarily equal to cost_price. An admin must set the
        // real retail price and activate the product before it is sold.
        const productInsert = await client.query(
          `INSERT INTO products
            (sku, name, slug, base_price, cost_price, stock_quantity, is_active, product_kind, publication_status)
           VALUES ($1, $2, $3, $4, $4, $5, false, 'physical', 'draft')
           ON CONFLICT (sku) DO NOTHING
           RETURNING id`,
          [row.sku, row.productName, slug, row.costPrice, row.stockQuantity],
        )
        if (productInsert.rows.length > 0) {
          productId = productInsert.rows[0].id
        } else {
          const existing = await client.query('SELECT id FROM products WHERE sku = $1', [
            row.sku,
          ])
          productId = existing.rows[0]?.id
        }
        createdCount++
      } else {
        updatedCount++
      }

      if (!productId) continue

      // Ensure an inventory row exists for this product. Checkout only ever
      // trusts inventory.available_stock, never products.stock_quantity, so
      // without this a newly-imported (or previously supplier-linked but
      // never-stocked) product would show a stock_quantity from the CSV but
      // have real available_stock of 0 and fail checkout immediately.
      // `inventory` has no unique constraint on product_id (it supports
      // multiple per-warehouse rows per product), so this uses an explicit
      // existence check rather than ON CONFLICT, which would fail with no
      // matching constraint. If a row already exists (e.g. tracked from
      // another source), it is left untouched -- a single supplier's
      // offered quantity is not necessarily the whole operational stock
      // picture for a product multiple suppliers or channels contribute to.
      await client.query(
        `INSERT INTO inventory (product_id, current_stock, reserved_stock)
         SELECT $1, $2, 0
         WHERE NOT EXISTS (
           SELECT 1 FROM inventory WHERE product_id = $1
         )`,
        [productId, row.stockQuantity],
      )

      await client.query(
        `INSERT INTO supplier_products
          (supplier_id, product_id, supplier_sku, cost_price, currency_code, stock_quantity, lead_time_days, is_available, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP)
         ON CONFLICT (supplier_id, product_id)
         DO UPDATE SET
           supplier_sku = EXCLUDED.supplier_sku,
           cost_price = EXCLUDED.cost_price,
           currency_code = EXCLUDED.currency_code,
           stock_quantity = EXCLUDED.stock_quantity,
           lead_time_days = EXCLUDED.lead_time_days,
           is_available = true,
           last_updated = CURRENT_TIMESTAMP`,
        [
          supplierId,
          productId,
          row.sku,
          row.costPrice,
          row.currencyCode,
          row.stockQuantity,
          row.leadTimeDays,
        ],
      )
    }

    await client.query(
      `UPDATE supplier_import_batches
       SET status = 'committed', created_count = $2, updated_count = $3, committed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [batchId, createdCount, updatedCount],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Commit supplier import error:', error)
    return res.status(500).json({ success: false, error: 'Failed to commit supplier import' })
  } finally {
    client.release()
  }

  res.json({
    success: true,
    message: `Import committed: ${createdCount} product(s) created (as inactive drafts), ${updatedCount} offer(s) updated.`,
    data: { batchId, createdCount, updatedCount },
  })
}
