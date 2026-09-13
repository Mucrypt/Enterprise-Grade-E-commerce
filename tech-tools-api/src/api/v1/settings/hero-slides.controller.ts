import { Request, Response } from 'express'
import { query as dbQuery, getClient } from '../../../database/connection'
import { AuthRequest } from '../../../middleware/auth'
import { processHeroSlideImage, validateImageFile } from '../../../utils/media'
import logger from '../../../utils/logger'

// Same shape/formulas as product-collections.controller.ts's
// PRODUCT_SELECT_FIELDS -- every product this module ever returns (a
// 'product' slide, or a 'product_grid' slide's items) must carry real
// images/total_stock, not the raw `p.*` columns.
const PRODUCT_SELECT_FIELDS = `
  p.*,
  c.name as category_name,
  c.slug as category_slug,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', pm.id,
          'url', pm.url,
          'image_url', pm.url,
          'alt_text', pm.alt_text,
          'is_primary', pm.is_primary,
          'display_order', pm.position,
          'cdn_urls', pm.cdn_urls
        ) ORDER BY pm.is_primary DESC, pm.position
      ),
      '[]'::json
    )
    FROM (
      SELECT id, url, alt_text, is_primary, position, cdn_urls
      FROM product_media
      WHERE product_id = p.id AND type = 'image'
      ORDER BY is_primary DESC, position
      LIMIT 5
    ) pm
  ) as images,
  (
    SELECT COALESCE(SUM(i.available_stock), 0)
    FROM inventory i
    WHERE i.product_id = p.id
  ) as total_stock
`

const MAX_PUBLIC_HERO_SLIDES = 10
const MAX_GRID_ITEMS = 4

async function resolveHeroSlideImage(
  req: Request,
  bodyImageUrl?: string,
): Promise<string | undefined> {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined
  const imageFile = files?.image?.[0]

  if (!imageFile) return bodyImageUrl

  const validation = validateImageFile(imageFile)
  if (!validation.valid) throw new Error(`Image: ${validation.error}`)

  const processed = await processHeroSlideImage(imageFile)
  return processed.optimized.large?.url || processed.original.url
}

const SLIDE_UPDATE_FIELD_MAP: Record<string, string> = {
  slideType: 'slide_type',
  slide_type: 'slide_type',
  eyebrow: 'eyebrow',
  title: 'title',
  description: 'description',
  imageUrl: 'image_url',
  image_url: 'image_url',
  ctaLabel: 'cta_label',
  cta_label: 'cta_label',
  ctaLink: 'cta_link',
  cta_link: 'cta_link',
  secondaryCtaLabel: 'secondary_cta_label',
  secondary_cta_label: 'secondary_cta_label',
  secondaryCtaLink: 'secondary_cta_link',
  secondary_cta_link: 'secondary_cta_link',
  productId: 'product_id',
  product_id: 'product_id',
  categoryId: 'category_id',
  category_id: 'category_id',
  productCollectionId: 'product_collection_id',
  product_collection_id: 'product_collection_id',
  categoryCollectionId: 'category_collection_id',
  category_collection_id: 'category_collection_id',
  isActive: 'is_active',
  is_active: 'is_active',
  position: 'position',
  platform: 'platform',
  startsAt: 'starts_at',
  starts_at: 'starts_at',
  endsAt: 'ends_at',
  ends_at: 'ends_at',
}

// =====================================================
// ADMIN: GET ALL HERO SLIDES
// =====================================================

export const getAdminHeroSlides = async (_req: Request, res: Response) => {
  try {
    const result = await dbQuery(
      `SELECT * FROM hero_slides ORDER BY position ASC, created_at DESC`,
    )
    res.json({ success: true, data: result.rows })
  } catch (error: any) {
    logger.error('Error fetching hero slides:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch hero slides', error: error.message })
  }
}

// =====================================================
// CREATE HERO SLIDE
// =====================================================

export const createHeroSlide = async (req: Request, res: Response) => {
  try {
    const {
      slideType,
      eyebrow,
      title,
      description,
      imageUrl,
      ctaLabel,
      ctaLink,
      secondaryCtaLabel,
      secondaryCtaLink,
      productId,
      categoryId,
      productCollectionId,
      categoryCollectionId,
      isActive = true,
      position = 0,
      platform = 'both',
      startsAt,
      endsAt,
    } = req.body

    if (!slideType) {
      return res.status(400).json({ success: false, message: 'slideType is required' })
    }

    const resolvedImageUrl = await resolveHeroSlideImage(req, imageUrl)
    const userId = (req as AuthRequest).user?.id

    const result = await dbQuery(
      `INSERT INTO hero_slides
       (slide_type, eyebrow, title, description, image_url, cta_label, cta_link,
        secondary_cta_label, secondary_cta_link, product_id, category_id,
        product_collection_id, category_collection_id, is_active, position,
        platform, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        slideType,
        eyebrow || null,
        title || null,
        description || null,
        resolvedImageUrl || null,
        ctaLabel || null,
        ctaLink || null,
        secondaryCtaLabel || null,
        secondaryCtaLink || null,
        productId || null,
        categoryId || null,
        productCollectionId || null,
        categoryCollectionId || null,
        isActive,
        position,
        platform,
        startsAt || null,
        endsAt || null,
        userId || null,
      ],
    )

    res.status(201).json({ success: true, message: 'Hero slide created successfully', data: result.rows[0] })
  } catch (error: any) {
    logger.error('Error creating hero slide:', error)
    const status = /^Image:/.test(error.message) ? 400 : 500
    res.status(status).json({ success: false, message: 'Failed to create hero slide', error: error.message })
  }
}

// =====================================================
// UPDATE HERO SLIDE
// =====================================================

export const updateHeroSlide = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updates = req.body

    for (const dateField of ['startsAt', 'starts_at', 'endsAt', 'ends_at']) {
      if (updates[dateField] === '') updates[dateField] = null
    }

    const slideCheck = await dbQuery('SELECT id FROM hero_slides WHERE id = $1', [id])
    if (slideCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hero slide not found' })
    }

    const resolvedImageUrl = await resolveHeroSlideImage(req, updates.imageUrl ?? updates.image_url)
    if (resolvedImageUrl !== undefined) updates.imageUrl = resolvedImageUrl

    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1
    const appliedFields = new Set<string>()

    for (const [inputField, dbField] of Object.entries(SLIDE_UPDATE_FIELD_MAP)) {
      if (appliedFields.has(dbField)) continue
      if (updates[inputField] !== undefined) {
        fields.push(`${dbField} = $${paramCount++}`)
        values.push(updates[inputField])
        appliedFields.add(dbField)
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' })
    }

    values.push(id)

    const result = await dbQuery(
      `UPDATE hero_slides SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values,
    )

    res.json({ success: true, message: 'Hero slide updated successfully', data: result.rows[0] })
  } catch (error: any) {
    logger.error('Error updating hero slide:', error)
    const status = /^Image:/.test(error.message) ? 400 : 500
    res.status(status).json({ success: false, message: 'Failed to update hero slide', error: error.message })
  }
}

// =====================================================
// DELETE HERO SLIDE
// =====================================================

export const deleteHeroSlide = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await dbQuery('DELETE FROM hero_slides WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hero slide not found' })
    }
    res.json({ success: true, message: 'Hero slide deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting hero slide:', error)
    res.status(500).json({ success: false, message: 'Failed to delete hero slide', error: error.message })
  }
}

// =====================================================
// REORDER HERO SLIDES
// =====================================================

export const reorderHeroSlides = async (req: Request, res: Response) => {
  try {
    const order = req.body.order

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid order data' })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      for (const item of order) {
        await client.query('UPDATE hero_slides SET position = $1 WHERE id = $2', [item.position, item.id])
      }
      await client.query('COMMIT')

      const result = await dbQuery('SELECT * FROM hero_slides ORDER BY position ASC, created_at DESC')
      res.json({ success: true, message: 'Hero slides reordered successfully', data: result.rows })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    logger.error('Error reordering hero slides:', error)
    res.status(500).json({ success: false, message: 'Failed to reorder hero slides', error: error.message })
  }
}

// =====================================================
// PRODUCT_GRID ITEMS: ADD / REMOVE / REORDER
// (copies product-collections.controller.ts's add/remove/reorder
// transaction shape exactly, scoped to hero_slide_id instead of
// collection_id)
// =====================================================

export const addHeroSlideItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { productIds } = req.body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Product IDs array is required' })
    }

    const slideCheck = await dbQuery('SELECT id FROM hero_slides WHERE id = $1', [id])
    if (slideCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hero slide not found' })
    }

    const existingCountResult = await dbQuery(
      'SELECT COUNT(*) as count FROM hero_slide_items WHERE hero_slide_id = $1',
      [id],
    )
    const existingCount = parseInt(existingCountResult.rows[0].count)
    if (existingCount + productIds.length > MAX_GRID_ITEMS) {
      return res.status(400).json({
        success: false,
        message: `A product_grid slide can hold at most ${MAX_GRID_ITEMS} products`,
      })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const maxPosResult = await client.query(
        'SELECT COALESCE(MAX(position), -1) as max_pos FROM hero_slide_items WHERE hero_slide_id = $1',
        [id],
      )
      let currentPosition = maxPosResult.rows[0].max_pos + 1

      for (const productId of productIds) {
        const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId])
        if (productCheck.rows.length === 0) {
          throw new Error(`Product ${productId} not found`)
        }

        await client.query(
          `INSERT INTO hero_slide_items (hero_slide_id, product_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (hero_slide_id, product_id) DO NOTHING`,
          [id, productId, currentPosition++],
        )
      }

      await client.query('COMMIT')

      const result = await dbQuery(
        `SELECT ${PRODUCT_SELECT_FIELDS}, hsi.position as item_position
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         JOIN hero_slide_items hsi ON p.id = hsi.product_id
         WHERE hsi.hero_slide_id = $1
         ORDER BY hsi.position ASC`,
        [id],
      )

      res.json({ success: true, message: 'Products added to hero slide successfully', data: result.rows })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    logger.error('Error adding items to hero slide:', error)
    res.status(500).json({ success: false, message: 'Failed to add products to hero slide', error: error.message })
  }
}

export const removeHeroSlideItem = async (req: Request, res: Response) => {
  try {
    const { id, productId } = req.params
    const result = await dbQuery(
      'DELETE FROM hero_slide_items WHERE hero_slide_id = $1 AND product_id = $2 RETURNING *',
      [id, productId],
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found in hero slide' })
    }
    res.json({ success: true, message: 'Product removed from hero slide successfully' })
  } catch (error: any) {
    logger.error('Error removing hero slide item:', error)
    res.status(500).json({ success: false, message: 'Failed to remove product from hero slide', error: error.message })
  }
}

export const reorderHeroSlideItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const productOrder = req.body.productOrder || req.body.items

    if (!Array.isArray(productOrder) || productOrder.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid product order data' })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      for (const item of productOrder) {
        await client.query(
          'UPDATE hero_slide_items SET position = $1 WHERE hero_slide_id = $2 AND product_id = $3',
          [item.position, id, item.productId],
        )
      }
      await client.query('COMMIT')

      const result = await dbQuery(
        `SELECT ${PRODUCT_SELECT_FIELDS}, hsi.position as item_position
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         JOIN hero_slide_items hsi ON p.id = hsi.product_id
         WHERE hsi.hero_slide_id = $1
         ORDER BY hsi.position ASC`,
        [id],
      )

      res.json({ success: true, message: 'Products reordered successfully', data: result.rows })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    logger.error('Error reordering hero slide items:', error)
    res.status(500).json({ success: false, message: 'Failed to reorder products', error: error.message })
  }
}

// =====================================================
// PUBLIC: RESOLVED HERO SLIDES
// The one endpoint both storefronts call -- returns a flat, fully
// resolved array (real product/category/collection data already joined
// in), so neither frontend needs to stitch multiple API calls together
// itself anymore.
// =====================================================

export const getPublicHeroSlides = async (req: Request, res: Response) => {
  try {
    const platform = req.query.platform === 'mobile' ? 'mobile' : req.query.platform === 'web' ? 'web' : 'both'

    const slidesResult = await dbQuery(
      `SELECT * FROM hero_slides
       WHERE is_active = TRUE
         AND platform IN ('both', $1)
         AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
         AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
       ORDER BY position ASC
       LIMIT $2`,
      [platform, MAX_PUBLIC_HERO_SLIDES],
    )

    const resolved: any[] = []

    for (const slide of slidesResult.rows) {
      if (slide.slide_type === 'custom') {
        resolved.push({
          id: slide.id,
          slideType: 'custom',
          eyebrow: slide.eyebrow,
          title: slide.title,
          description: slide.description,
          imageUrl: slide.image_url,
          ctaLabel: slide.cta_label,
          ctaLink: slide.cta_link,
          secondaryCtaLabel: slide.secondary_cta_label,
          secondaryCtaLink: slide.secondary_cta_link,
        })
        continue
      }

      if (slide.slide_type === 'product') {
        const productResult = await dbQuery(
          `SELECT ${PRODUCT_SELECT_FIELDS}
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE p.id = $1 AND p.is_active = TRUE AND p.deleted_at IS NULL`,
          [slide.product_id],
        )
        const product = productResult.rows[0]
        // Admin-curated slide -- only dropped for a missing/deactivated
        // product, never for being out of stock (a deliberate curatorial
        // choice, unlike the old auto-generated slides' in-stock filter).
        if (!product) continue

        resolved.push({
          id: slide.id,
          slideType: 'product',
          eyebrow: slide.eyebrow,
          title: slide.title || product.name,
          description: slide.description,
          imageUrl: slide.image_url,
          ctaLabel: slide.cta_label,
          ctaLink: `/product/${product.slug}`,
          secondaryCtaLabel: slide.secondary_cta_label,
          secondaryCtaLink: slide.secondary_cta_link,
          product,
        })
        continue
      }

      if (slide.slide_type === 'category') {
        const categoryResult = await dbQuery(
          'SELECT * FROM categories WHERE id = $1 AND is_active = TRUE',
          [slide.category_id],
        )
        const category = categoryResult.rows[0]
        if (!category) continue

        resolved.push({
          id: slide.id,
          slideType: 'category',
          eyebrow: slide.eyebrow,
          title: slide.title || category.name,
          description: slide.description || category.description,
          imageUrl: slide.image_url || category.image_url,
          ctaLabel: slide.cta_label,
          ctaLink: `/category/${category.slug}`,
          secondaryCtaLabel: slide.secondary_cta_label,
          secondaryCtaLink: slide.secondary_cta_link,
        })
        continue
      }

      if (slide.slide_type === 'product_collection') {
        // Same public-visibility predicate getAllProductCollections uses
        // for non-admin requests -- a hero slide must never leak a
        // hidden/private or unscheduled collection to the storefront.
        const collectionResult = await dbQuery(
          `SELECT * FROM product_collections
           WHERE id = $1 AND visibility = 'public' AND is_active = TRUE
             AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
             AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)`,
          [slide.product_collection_id],
        )
        const collection = collectionResult.rows[0]
        if (!collection) continue

        resolved.push({
          id: slide.id,
          slideType: 'product_collection',
          eyebrow: slide.eyebrow,
          title: slide.title || collection.name,
          description: slide.description || collection.short_description || collection.description,
          imageUrl: slide.image_url || collection.banner_url || collection.image_url,
          ctaLabel: slide.cta_label,
          ctaLink: `/collections/${collection.slug}`,
          secondaryCtaLabel: slide.secondary_cta_label,
          secondaryCtaLink: slide.secondary_cta_link,
        })
        continue
      }

      if (slide.slide_type === 'category_collection') {
        const collectionResult = await dbQuery(
          `SELECT * FROM category_collections
           WHERE id = $1 AND visibility = 'public' AND is_active = TRUE
             AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
             AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)`,
          [slide.category_collection_id],
        )
        const collection = collectionResult.rows[0]
        if (!collection) continue

        resolved.push({
          id: slide.id,
          slideType: 'category_collection',
          eyebrow: slide.eyebrow,
          title: slide.title || collection.name,
          description: slide.description || collection.short_description || collection.description,
          imageUrl: slide.image_url || collection.banner_url || collection.image_url,
          ctaLabel: slide.cta_label,
          ctaLink: `/collections/${collection.slug}`,
          secondaryCtaLabel: slide.secondary_cta_label,
          secondaryCtaLink: slide.secondary_cta_link,
        })
        continue
      }

      if (slide.slide_type === 'product_grid') {
        const itemsResult = await dbQuery(
          `SELECT ${PRODUCT_SELECT_FIELDS}
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           JOIN hero_slide_items hsi ON p.id = hsi.product_id
           WHERE hsi.hero_slide_id = $1 AND p.is_active = TRUE AND p.deleted_at IS NULL
           ORDER BY hsi.position ASC
           LIMIT ${MAX_GRID_ITEMS}`,
          [slide.id],
        )
        // A grid slide with zero real, in-stock-or-not-but-active products
        // left has nothing to show -- drop it rather than render an empty grid.
        if (itemsResult.rows.length === 0) continue

        resolved.push({
          id: slide.id,
          slideType: 'product_grid',
          eyebrow: slide.eyebrow,
          title: slide.title,
          description: slide.description,
          ctaLabel: slide.cta_label,
          ctaLink: slide.cta_link,
          secondaryCtaLabel: slide.secondary_cta_label,
          secondaryCtaLink: slide.secondary_cta_link,
          products: itemsResult.rows,
        })
      }
    }

    res.json({ success: true, data: resolved })
  } catch (error: any) {
    logger.error('Error fetching public hero slides:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch hero slides', error: error.message })
  }
}
