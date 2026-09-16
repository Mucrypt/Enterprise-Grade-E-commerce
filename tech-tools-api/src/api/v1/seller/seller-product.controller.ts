import { Response } from 'express'
import { query, getClient } from '../../../database/connection'
import { SellerAuthRequest } from '../../../middleware/seller-auth'
import { processProductImage, validateImageFile } from '../../../utils/media'
import logger from '../../../utils/logger'

// =====================================================
// Seller-owned products -- mirrors product.controller.ts's createProduct/
// updateProduct shape closely (same INSERT columns, same real
// inventory-row requirement) but scoped to a seller's own catalog via
// products.seller_profile_id, a column that existed since migration 034
// but nothing wrote to until now. Every seller-created/edited product is
// forced pending review (is_active=false) -- the same real trust/safety
// gate already used for seller-authored Discover posts, since a bad
// physical-product listing carries real money/shipping/liability risk.
//
// Images only for v1 (no product video upload here) -- matches the
// same scope cut made for the mobile/web seller UI, kept consistent
// across the whole feature rather than supporting video on one platform
// and not another.
// =====================================================

const SELLER_PRODUCT_SELECT_FIELDS = `
  p.*,
  c.name as category_name,
  c.slug as category_slug,
  b.name as brand_name,
  (
    SELECT COALESCE(json_agg(pm ORDER BY pm.position), '[]'::json)
    FROM product_media pm
    WHERE pm.product_id = p.id AND pm.type = 'image'
  ) as images,
  (
    SELECT COALESCE(SUM(i.available_stock), 0)
    FROM inventory i
    WHERE i.product_id = p.id
  ) as total_stock
`

async function getSellerTierLimits(sellerProfileId: string) {
  const result = await query(
    `SELECT sp.tier, stc.max_active_listings, stc.max_product_price
     FROM seller_profiles sp
     LEFT JOIN seller_tier_config stc ON stc.tier = sp.tier
     WHERE sp.id = $1`,
    [sellerProfileId],
  )
  return result.rows[0] || null
}

// Sellers may only touch their own products; admins are unrestricted.
// Same null-on-success / {status,message}-on-failure shape as
// discover.controller.ts's assertOwnsPostOrIsAdmin (this codebase runs
// with strictNullChecks off, which makes discriminated-union narrowing
// unreliable -- see that file's comment for the full explanation).
async function assertOwnsProductOrIsAdmin(
  req: SellerAuthRequest,
  productId: string,
): Promise<{ status: number; message: string } | null> {
  const result = await query('SELECT seller_profile_id FROM products WHERE id = $1 AND deleted_at IS NULL', [
    productId,
  ])
  if (result.rows.length === 0) {
    return { status: 404, message: 'Product not found' }
  }
  if (req.sellerProfileId && result.rows[0].seller_profile_id !== req.sellerProfileId) {
    return { status: 403, message: 'You can only manage your own products' }
  }
  return null
}

export const getMySellerProducts = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only approved sellers have a product catalog here' })
    }

    const result = await query(
      `SELECT ${SELLER_PRODUCT_SELECT_FIELDS}
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.seller_profile_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
      [req.sellerProfileId],
    )
    res.json({ success: true, data: result.rows })
  } catch (error: any) {
    logger.error('Error fetching seller products:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch your products', error: error.message })
  }
}

// Admin-only pending-review queue -- a dedicated listing rather than
// retrofitting the public getProducts (product.controller.ts), which
// hardcodes `is_active = true` for the storefront and is too
// heavily-relied-on to safely change here.
export const getPendingSellerProducts = async (_req: SellerAuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT ${SELLER_PRODUCT_SELECT_FIELDS},
              sp.display_name as seller_display_name,
              sp.handle as seller_handle
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN seller_profiles sp ON p.seller_profile_id = sp.id
       WHERE p.is_active = FALSE AND p.seller_profile_id IS NOT NULL AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
    )
    res.json({ success: true, data: result.rows })
  } catch (error: any) {
    logger.error('Error fetching pending seller products:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch pending products', error: error.message })
  }
}

export const createSellerProduct = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only approved sellers can list products here' })
    }

    const {
      sku,
      name,
      slug,
      description,
      shortDescription,
      brandId,
      categoryId,
      basePrice,
      salePrice,
      stockQuantity = 0,
    } = req.body

    const limits = await getSellerTierLimits(req.sellerProfileId)
    if (!limits) {
      return res.status(500).json({ success: false, message: 'Could not resolve your seller tier' })
    }

    const activeCountResult = await query(
      'SELECT COUNT(*) as count FROM products WHERE seller_profile_id = $1 AND deleted_at IS NULL',
      [req.sellerProfileId],
    )
    const activeCount = parseInt(activeCountResult.rows[0].count, 10)
    if (activeCount >= limits.max_active_listings) {
      return res.status(400).json({
        success: false,
        message: `Your ${limits.tier} plan allows up to ${limits.max_active_listings} listings. Upgrade your seller tier to list more.`,
      })
    }

    if (limits.max_product_price !== null && Number(basePrice) > Number(limits.max_product_price)) {
      return res.status(400).json({
        success: false,
        message: `Your ${limits.tier} plan caps product price at ${limits.max_product_price}. Upgrade your seller tier to list higher-priced products.`,
      })
    }

    const existingSku = await query('SELECT id FROM products WHERE sku = $1', [sku])
    if (existingSku.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'A product with this SKU already exists' })
    }
    const existingSlug = await query('SELECT id FROM products WHERE slug = $1', [slug])
    if (existingSlug.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'A product with this slug already exists' })
    }

    const client = await getClient()
    let product: any
    try {
      await client.query('BEGIN')

      const result = await client.query(
        `INSERT INTO products (
          sku, name, slug, description, short_description,
          brand_id, category_id, base_price, sale_price, stock_quantity,
          is_active, seller_profile_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11)
        RETURNING *`,
        [
          sku,
          name,
          slug,
          description || '',
          shortDescription || null,
          brandId || null,
          categoryId,
          basePrice,
          salePrice || null,
          stockQuantity,
          req.sellerProfileId,
        ],
      )
      product = result.rows[0]

      // Same real inventory-row requirement as admin's createProduct --
      // checkout only ever trusts inventory.available_stock, never
      // products.stock_quantity directly.
      await client.query(
        `INSERT INTO inventory (product_id, current_stock, reserved_stock) VALUES ($1, $2, 0)`,
        [product.id, stockQuantity],
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
    const imageFiles = files?.images || []
    if (imageFiles.length > 0) {
      try {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i]
          const validation = validateImageFile(file)
          if (!validation.valid) continue
          const processed = await processProductImage(file)
          const cdnUrls = {
            original: processed.original.url,
            thumbnail: processed.optimized.thumbnail?.url || '',
            small: processed.optimized.small?.url || '',
            medium: processed.optimized.medium?.url || '',
            large: processed.optimized.large?.url || '',
          }
          await query(
            `INSERT INTO product_media (product_id, type, url, cdn_urls, file_size, alt_text, title, position, is_primary, format)
             VALUES ($1, 'image', $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              product.id,
              processed.original.url,
              JSON.stringify(cdnUrls),
              processed.original.fileSize,
              `${name} - Image ${i + 1}`,
              `${name} - Image ${i + 1}`,
              i,
              i === 0,
              file.mimetype?.split('/')[1] || 'jpg',
            ],
          )
        }
      } catch (mediaError) {
        // Same as admin's createProduct -- the product itself is already
        // created; a media hiccup shouldn't undo it. Log and move on.
        logger.error('Media processing error during seller product creation:', mediaError)
      }
    }

    res.status(201).json({
      success: true,
      message: 'Product submitted -- it will be visible to shoppers once an admin approves it.',
      data: product,
    })
  } catch (error: any) {
    logger.error('Error creating seller product:', error)
    res.status(500).json({ success: false, message: 'Failed to create product', error: error.message })
  }
}

const SELLER_PRODUCT_UPDATE_FIELD_MAP: Record<string, string> = {
  name: 'name',
  description: 'description',
  shortDescription: 'short_description',
  brandId: 'brand_id',
  categoryId: 'category_id',
  basePrice: 'base_price',
  salePrice: 'sale_price',
}

export const updateSellerProduct = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const updates = req.body

    const ownershipError = await assertOwnsProductOrIsAdmin(req, id)
    if (ownershipError) {
      return res.status(ownershipError.status).json({ success: false, message: ownershipError.message })
    }

    // A seller editing their own product can't re-approve it themselves
    // -- an edit to an already-live listing drops it back to pending,
    // since the content just changed and hasn't been reviewed in its
    // new form. Admins are unrestricted (unchanged product.controller.ts
    // behavior for their own edits).
    if (req.sellerProfileId) {
      updates.isActive = false
    }

    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1

    for (const [inputField, dbField] of Object.entries(SELLER_PRODUCT_UPDATE_FIELD_MAP)) {
      if (updates[inputField] !== undefined) {
        fields.push(`${dbField} = $${paramCount++}`)
        values.push(updates[inputField])
      }
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramCount++}`)
      values.push(updates.isActive)
    }

    if (fields.length === 0 && updates.stockQuantity === undefined) {
      return res.status(400).json({ success: false, message: 'No fields to update' })
    }

    let product = null
    if (fields.length > 0) {
      fields.push('updated_at = NOW()')
      values.push(id)
      const result = await query(
        `UPDATE products SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values,
      )
      product = result.rows[0]
    }

    // Same real inventory-sync requirement as product.controller.ts's
    // updateProduct -- the stock badge everywhere reads
    // inventory.available_stock, not products.stock_quantity.
    if (updates.stockQuantity !== undefined) {
      const inventoryUpdate = await query(
        `UPDATE inventory SET current_stock = $2, updated_at = NOW() WHERE product_id = $1`,
        [id, updates.stockQuantity],
      )
      if (inventoryUpdate.rowCount === 0) {
        await query(`INSERT INTO inventory (product_id, current_stock) VALUES ($1, $2)`, [id, updates.stockQuantity])
      }
      if (!product) {
        const result = await query('SELECT * FROM products WHERE id = $1', [id])
        product = result.rows[0]
      }
    }

    res.json({ success: true, message: 'Product updated', data: product })
  } catch (error: any) {
    logger.error('Error updating seller product:', error)
    res.status(500).json({ success: false, message: 'Failed to update product', error: error.message })
  }
}

export const deleteSellerProduct = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const ownershipError = await assertOwnsProductOrIsAdmin(req, id)
    if (ownershipError) {
      return res.status(ownershipError.status).json({ success: false, message: ownershipError.message })
    }

    await query(
      'UPDATE products SET deleted_at = NOW(), is_active = false, updated_at = NOW() WHERE id = $1',
      [id],
    )
    res.json({ success: true, message: 'Product deleted' })
  } catch (error: any) {
    logger.error('Error deleting seller product:', error)
    res.status(500).json({ success: false, message: 'Failed to delete product', error: error.message })
  }
}

// Admin-only approval -- rejecting a pending product is just the
// existing admin delete above, no separate "rejected" state to invent
// (same reasoning as Discover posts' review endpoint).
export const reviewSellerProduct = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const result = await query(
      `UPDATE products SET is_active = TRUE, updated_at = NOW()
       WHERE id = $1 AND seller_profile_id IS NOT NULL AND deleted_at IS NULL
       RETURNING *`,
      [id],
    )
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending seller product not found (already reviewed, or not a seller-listed product)',
      })
    }
    res.json({ success: true, message: 'Product approved and published', data: result.rows[0] })
  } catch (error: any) {
    logger.error('Error approving seller product:', error)
    res.status(500).json({ success: false, message: 'Failed to approve product', error: error.message })
  }
}
