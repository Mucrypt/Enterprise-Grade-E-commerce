/**
 * Pricing-suggestion logic for the sourcing domain (SOURCING-1). Pure
 * arithmetic against a configurable sourcing_pricing_rules row -- no
 * external I/O beyond the one rule lookup. Reuses the existing
 * products.cost_price/sale_price + product_unit_economics tables at
 * commit time (sourced-product.service.ts) rather than inventing a
 * second, parallel economics table.
 */
import { query } from '../../database/connection'

export interface SourcingPricingRule {
  id: string
  rule_type: 'margin_percent' | 'cost_plus_fixed'
  margin_percent: number | null
  fixed_markup: number | null
  rounding_mode: 'none' | 'charm' | 'nearest_1'
}

export interface PricingSuggestion {
  suggestedSalePrice: number
  suggestedMarginPercent: number
  ruleId: string
}

/** margin_percent is a true margin (sale - cost) / sale, not a markup on cost. */
function computeRawSalePrice(costPrice: number, rule: SourcingPricingRule): number {
  if (rule.rule_type === 'margin_percent') {
    const margin = Number(rule.margin_percent ?? 0)
    if (margin <= 0 || margin >= 100) return costPrice
    return costPrice / (1 - margin / 100)
  }
  return costPrice + Number(rule.fixed_markup ?? 0)
}

function applyRounding(price: number, mode: SourcingPricingRule['rounding_mode']): number {
  if (mode === 'nearest_1') return Math.round(price)
  if (mode === 'charm') {
    // Round UP to the nearest whole unit, then price at x.99 -- never
    // rounds down below the raw computed price (would erode the margin
    // the rule was configured for).
    const wholeUnit = Math.ceil(price)
    const charmed = wholeUnit - 0.01
    return charmed >= price ? Math.round(charmed * 100) / 100 : wholeUnit
  }
  return Math.round(price * 100) / 100
}

export function computeSuggestedPrice(costPrice: number, rule: SourcingPricingRule): PricingSuggestion {
  const rawSalePrice = computeRawSalePrice(costPrice, rule)
  const suggestedSalePrice = applyRounding(rawSalePrice, rule.rounding_mode)
  const suggestedMarginPercent =
    suggestedSalePrice > 0 ? Math.round(((suggestedSalePrice - costPrice) / suggestedSalePrice) * 10000) / 100 : 0

  return { suggestedSalePrice, suggestedMarginPercent, ruleId: rule.id }
}

async function loadRule(ruleId?: string | null): Promise<SourcingPricingRule | null> {
  const result = ruleId
    ? await query(`SELECT id, rule_type, margin_percent, fixed_markup, rounding_mode FROM sourcing_pricing_rules WHERE id = $1`, [ruleId])
    : await query(`SELECT id, rule_type, margin_percent, fixed_markup, rounding_mode FROM sourcing_pricing_rules WHERE is_default = true`)
  return result.rows[0] ?? null
}

/**
 * Applies the active pricing rule (explicit ruleId, or whichever rule is
 * flagged is_default) to a captured EUR cost, writing
 * suggested_sale_price/suggested_margin_percent and seeding
 * final_cost_price/final_sale_price with the same values -- the founder
 * edits final_* from there; suggested_* is never silently recomputed over
 * an edit the founder already made.
 */
export async function applyPricingSuggestion(sourcedProductId: string, ruleId?: string | null): Promise<PricingSuggestion | null> {
  const productResult = await query(`SELECT captured_cost_price_eur FROM sourced_products WHERE id = $1`, [sourcedProductId])
  const costPrice: number | null = productResult.rows[0]?.captured_cost_price_eur
  if (costPrice === null || costPrice === undefined) return null

  const rule = await loadRule(ruleId)
  if (!rule) return null

  const suggestion = computeSuggestedPrice(Number(costPrice), rule)

  await query(
    `UPDATE sourced_products
     SET suggested_sale_price = $2, suggested_margin_percent = $3, pricing_rule_id = $4,
         final_cost_price = COALESCE(final_cost_price, $5), final_sale_price = COALESCE(final_sale_price, $2),
         updated_at = now()
     WHERE id = $1`,
    [sourcedProductId, suggestion.suggestedSalePrice, suggestion.suggestedMarginPercent, suggestion.ruleId, costPrice],
  )

  return suggestion
}
