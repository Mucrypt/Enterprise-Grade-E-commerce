/** Admin CRUD for shipping_delivery_templates (delivery-estimate scheduling) -- gated shipping.manage throughout. */
import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query, getClient } from '../../../database/connection'
import logger from '../../../utils/logger'

const SCOPE_TYPES = ['global', 'location', 'category'] as const
type ScopeType = (typeof SCOPE_TYPES)[number]

const LIST_COLUMNS = `
  t.id, t.name, t.scope_type, t.countries,
  t.processing_days_min, t.processing_days_max,
  t.transit_days_min, t.transit_days_max,
  t.express_transit_days_min, t.express_transit_days_max,
  t.skip_weekends, t.standard_label, t.express_label,
  t.is_active, t.is_default, t.created_at, t.updated_at,
  COALESCE(
    (SELECT array_agg(c.id) FROM shipping_delivery_template_categories tc
     JOIN categories c ON c.id = tc.category_id WHERE tc.template_id = t.id),
    '{}'
  ) AS category_ids
`

export const listDeliveryTemplates = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT ${LIST_COLUMNS} FROM shipping_delivery_templates t ORDER BY t.is_default DESC, t.scope_type ASC, t.name ASC`,
    )
    res.json({ success: true, templates: result.rows })
  } catch (error) {
    logger.error('Error listing delivery templates:', error)
    res.status(500).json({ success: false, error: 'Failed to list delivery templates' })
  }
}

/** Rejects a location-scope country list that overlaps an existing active location template. */
async function findOverlappingCountry(countries: string[], excludeId?: string): Promise<string | null> {
  if (countries.length === 0) return null
  const result = await query(
    `SELECT countries FROM shipping_delivery_templates
     WHERE scope_type = 'location' AND is_active = true ${excludeId ? 'AND id != $2' : ''}
     AND countries && $1::text[]`,
    excludeId ? [countries, excludeId] : [countries],
  )
  for (const row of result.rows) {
    const overlap = (row.countries as string[]).find((c) => countries.includes(c))
    if (overlap) return overlap
  }
  return null
}

function validateScopePayload(scopeType: ScopeType, countries: string[], categoryIds: string[]): string | null {
  if (!SCOPE_TYPES.includes(scopeType)) return `"scopeType" must be one of ${SCOPE_TYPES.join(', ')}`
  if (scopeType === 'location' && countries.length === 0) return 'At least one country is required for a location-scoped template'
  if (scopeType === 'category' && categoryIds.length === 0) return 'At least one category is required for a category-scoped template'
  return null
}

export const createDeliveryTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await getClient()
  try {
    const {
      name,
      scopeType,
      countries = [],
      categoryIds = [],
      processingDaysMin,
      processingDaysMax,
      transitDaysMin,
      transitDaysMax,
      expressTransitDaysMin,
      expressTransitDaysMax,
      skipWeekends,
      standardLabel,
      expressLabel,
      isDefault,
    } = req.body

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: '"name" is required' })
      return
    }
    const validationError = validateScopePayload(scopeType, countries, categoryIds)
    if (validationError) {
      res.status(400).json({ success: false, error: validationError })
      return
    }
    if (scopeType === 'location') {
      const overlap = await findOverlappingCountry(countries)
      if (overlap) {
        res.status(400).json({ success: false, error: `Country "${overlap}" is already assigned to another active location template` })
        return
      }
    }
    // A global template is always the default; a location/category template
    // is never a fallback -- prevents ending up with a non-global default
    // that would silently break the "most-specific-wins" resolution model.
    const willBeDefault = scopeType === 'global' ? true : false
    if (isDefault && scopeType !== 'global') {
      res.status(400).json({ success: false, error: 'Only a global-scope template can be the default' })
      return
    }
    if (scopeType === 'global') {
      const existingGlobal = await query(`SELECT id FROM shipping_delivery_templates WHERE scope_type = 'global' LIMIT 1`)
      if (existingGlobal.rows[0]) {
        res.status(400).json({ success: false, error: 'A global template already exists -- edit it instead of creating another' })
        return
      }
    }

    await client.query('BEGIN')

    if (willBeDefault) {
      await client.query(`UPDATE shipping_delivery_templates SET is_default = false WHERE is_default = true`)
    }

    const result = await client.query(
      `INSERT INTO shipping_delivery_templates (
        name, scope_type, countries, processing_days_min, processing_days_max,
        transit_days_min, transit_days_max, express_transit_days_min, express_transit_days_max,
        skip_weekends, standard_label, express_label, is_default, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id`,
      [
        name,
        scopeType,
        scopeType === 'location' ? countries : [],
        processingDaysMin ?? 1,
        processingDaysMax ?? 2,
        transitDaysMin ?? 2,
        transitDaysMax ?? 4,
        expressTransitDaysMin ?? null,
        expressTransitDaysMax ?? null,
        skipWeekends ?? true,
        standardLabel || 'FREE Delivery',
        expressLabel || 'Or fastest delivery',
        willBeDefault,
        req.user!.userId,
      ],
    )
    const templateId = result.rows[0].id

    if (scopeType === 'category' && categoryIds.length > 0) {
      for (const categoryId of categoryIds) {
        await client.query(
          `INSERT INTO shipping_delivery_template_categories (template_id, category_id) VALUES ($1, $2)
           ON CONFLICT (category_id) DO UPDATE SET template_id = EXCLUDED.template_id`,
          [templateId, categoryId],
        )
      }
    }

    await client.query('COMMIT')
    res.status(201).json({ success: true, data: { id: templateId } })
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Error creating delivery template:', error)
    res.status(500).json({ success: false, error: 'Failed to create delivery template' })
  } finally {
    client.release()
  }
}

export const updateDeliveryTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await getClient()
  try {
    const { id } = req.params
    const existingResult = await query(`SELECT scope_type, is_default FROM shipping_delivery_templates WHERE id = $1`, [id])
    const existing = existingResult.rows[0]
    if (!existing) {
      res.status(404).json({ success: false, error: 'Delivery template not found' })
      return
    }

    const {
      name,
      countries,
      categoryIds,
      processingDaysMin,
      processingDaysMax,
      transitDaysMin,
      transitDaysMax,
      expressTransitDaysMin,
      expressTransitDaysMax,
      skipWeekends,
      standardLabel,
      expressLabel,
      isActive,
      isDefault,
    } = req.body

    // The one required global fallback can never be deleted or switched
    // off -- both would leave tier-4 resolution with nothing to return.
    if (existing.is_default && (isActive === false || isDefault === false)) {
      res.status(400).json({ success: false, error: 'Reassign the default to another global template before deactivating this one' })
      return
    }
    if (isDefault && existing.scope_type !== 'global') {
      res.status(400).json({ success: false, error: 'Only a global-scope template can be the default' })
      return
    }
    if (existing.scope_type === 'location' && Array.isArray(countries)) {
      const overlap = await findOverlappingCountry(countries, id)
      if (overlap) {
        res.status(400).json({ success: false, error: `Country "${overlap}" is already assigned to another active location template` })
        return
      }
    }

    await client.query('BEGIN')

    if (isDefault === true && !existing.is_default) {
      await client.query(`UPDATE shipping_delivery_templates SET is_default = false WHERE is_default = true AND id != $1`, [id])
    }

    await client.query(
      `UPDATE shipping_delivery_templates SET
        name = COALESCE($2, name),
        countries = CASE WHEN $3::text[] IS NOT NULL THEN $3 ELSE countries END,
        processing_days_min = COALESCE($4, processing_days_min),
        processing_days_max = COALESCE($5, processing_days_max),
        transit_days_min = COALESCE($6, transit_days_min),
        transit_days_max = COALESCE($7, transit_days_max),
        express_transit_days_min = $8,
        express_transit_days_max = $9,
        skip_weekends = COALESCE($10, skip_weekends),
        standard_label = COALESCE($11, standard_label),
        express_label = COALESCE($12, express_label),
        is_active = COALESCE($13, is_active),
        is_default = COALESCE($14, is_default),
        updated_at = now()
       WHERE id = $1`,
      [
        id,
        name ?? null,
        countries ?? null,
        processingDaysMin ?? null,
        processingDaysMax ?? null,
        transitDaysMin ?? null,
        transitDaysMax ?? null,
        expressTransitDaysMin === undefined ? null : expressTransitDaysMin,
        expressTransitDaysMax === undefined ? null : expressTransitDaysMax,
        skipWeekends ?? null,
        standardLabel ?? null,
        expressLabel ?? null,
        isActive ?? null,
        isDefault ?? null,
      ],
    )

    if (existing.scope_type === 'category' && Array.isArray(categoryIds)) {
      await client.query(`DELETE FROM shipping_delivery_template_categories WHERE template_id = $1`, [id])
      for (const categoryId of categoryIds) {
        await client.query(
          `INSERT INTO shipping_delivery_template_categories (template_id, category_id) VALUES ($1, $2)
           ON CONFLICT (category_id) DO UPDATE SET template_id = EXCLUDED.template_id`,
          [id, categoryId],
        )
      }
    }

    await client.query('COMMIT')
    res.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Error updating delivery template:', error)
    res.status(500).json({ success: false, error: 'Failed to update delivery template' })
  } finally {
    client.release()
  }
}

export const deleteDeliveryTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const existingResult = await query(`SELECT is_default FROM shipping_delivery_templates WHERE id = $1`, [id])
    const existing = existingResult.rows[0]
    if (!existing) {
      res.status(404).json({ success: false, error: 'Delivery template not found' })
      return
    }
    if (existing.is_default) {
      res.status(400).json({ success: false, error: 'Reassign the default to another global template before deleting this one' })
      return
    }
    await query(`DELETE FROM shipping_delivery_templates WHERE id = $1`, [id])
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting delivery template:', error)
    res.status(500).json({ success: false, error: 'Failed to delete delivery template' })
  }
}
