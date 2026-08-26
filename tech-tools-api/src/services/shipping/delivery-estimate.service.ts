/**
 * Delivery ESTIMATE resolution (admin-configurable date-range templates --
 * marketing copy, not live carrier rates -- see 052_shipping_delivery_templates.sql
 * for the full precedence rule this implements).
 */
import { query } from '../../database/connection'

export type DeliveryTemplateScope = 'global' | 'location' | 'category'
export type DeliveryScopeMatched = 'product_override' | 'category' | 'location' | 'global'

export interface DeliveryTemplateRow {
  id: string
  name: string
  scope_type: DeliveryTemplateScope
  processing_days_min: number
  processing_days_max: number
  transit_days_min: number
  transit_days_max: number
  express_transit_days_min: number | null
  express_transit_days_max: number | null
  skip_weekends: boolean
  standard_label: string
  express_label: string
}

export interface ResolvedDeliveryTemplate {
  template: DeliveryTemplateRow
  scopeMatched: DeliveryScopeMatched
}

export class ProductNotFoundError extends Error {
  constructor() {
    super('PRODUCT_NOT_FOUND')
  }
}

const TEMPLATE_COLUMNS =
  'id, name, scope_type, processing_days_min, processing_days_max, transit_days_min, transit_days_max, express_transit_days_min, express_transit_days_max, skip_weekends, standard_label, express_label'

/**
 * Should never actually be returned in practice -- the migration seeds a
 * default row and the service layer refuses to delete/deactivate the last
 * one -- but keeps the public estimate endpoint from ever 500ing if that
 * invariant is somehow violated (e.g. a manual DB edit).
 */
const FALLBACK_TEMPLATE: DeliveryTemplateRow = {
  id: 'fallback',
  name: 'Standard delivery (fallback)',
  scope_type: 'global',
  processing_days_min: 1,
  processing_days_max: 2,
  transit_days_min: 3,
  transit_days_max: 5,
  express_transit_days_min: null,
  express_transit_days_max: null,
  skip_weekends: true,
  standard_label: 'FREE Delivery',
  express_label: 'Or fastest delivery',
}

/** Adds `days` to `start`, optionally skipping Saturdays/Sundays. Pure, no I/O. */
export function addBusinessDays(start: Date, days: number, skipWeekends: boolean): Date {
  const result = new Date(start)
  if (days <= 0) return result

  if (!skipWeekends) {
    result.setDate(result.getDate() + days)
    return result
  }

  let remaining = days
  while (remaining > 0) {
    result.setDate(result.getDate() + 1)
    const day = result.getDay()
    if (day !== 0 && day !== 6) remaining--
  }
  return result
}

/**
 * Resolves the applicable delivery template for one product, optionally
 * narrowed by the shopper's country. Always resolves to something (falls
 * through product override -> category -> location -> global, never errors
 * once past the initial product lookup).
 */
export async function resolveDeliveryTemplate(
  productId: string,
  countryCode: string | null,
): Promise<ResolvedDeliveryTemplate> {
  const productResult = await query(
    `SELECT category_id, delivery_template_id FROM products WHERE id = $1 AND deleted_at IS NULL`,
    [productId],
  )
  const product = productResult.rows[0]
  if (!product) {
    throw new ProductNotFoundError()
  }

  // Tier 1: per-product override -- any active template, any scope.
  if (product.delivery_template_id) {
    const overrideResult = await query(
      `SELECT ${TEMPLATE_COLUMNS} FROM shipping_delivery_templates WHERE id = $1 AND is_active = true`,
      [product.delivery_template_id],
    )
    if (overrideResult.rows[0]) {
      return { template: overrideResult.rows[0], scopeMatched: 'product_override' }
    }
    // Stale FK to a now-inactive template -- fall through, don't error.
  }

  // Tier 2: category assignment (each category maps to at most one template).
  if (product.category_id) {
    const categoryResult = await query(
      `SELECT t.id, t.name, t.scope_type, t.processing_days_min, t.processing_days_max,
              t.transit_days_min, t.transit_days_max, t.express_transit_days_min, t.express_transit_days_max,
              t.skip_weekends, t.standard_label, t.express_label
       FROM shipping_delivery_template_categories tc
       JOIN shipping_delivery_templates t ON t.id = tc.template_id
       WHERE tc.category_id = $1 AND t.is_active = true`,
      [product.category_id],
    )
    if (categoryResult.rows[0]) {
      return { template: categoryResult.rows[0], scopeMatched: 'category' }
    }
  }

  // Tier 3: location match. Deterministic tie-break (most specific / most
  // recently updated) is defense-in-depth against overlapping country lists
  // -- the write path also rejects overlaps up front.
  if (countryCode) {
    const locationResult = await query(
      `SELECT ${TEMPLATE_COLUMNS} FROM shipping_delivery_templates
       WHERE scope_type = 'location' AND is_active = true AND $1 = ANY(countries)
       ORDER BY array_length(countries, 1) ASC, updated_at DESC
       LIMIT 1`,
      [countryCode],
    )
    if (locationResult.rows[0]) {
      return { template: locationResult.rows[0], scopeMatched: 'location' }
    }
  }

  // Tier 4: the one global default.
  const globalResult = await query(
    `SELECT ${TEMPLATE_COLUMNS} FROM shipping_delivery_templates WHERE is_default = true AND is_active = true LIMIT 1`,
  )
  if (globalResult.rows[0]) {
    return { template: globalResult.rows[0], scopeMatched: 'global' }
  }

  return { template: FALLBACK_TEMPLATE, scopeMatched: 'global' }
}
