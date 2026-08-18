import { computeSuggestedPrice, applyPricingSuggestion, SourcingPricingRule } from './sourcing-pricing.service'
import { query } from '../../database/connection'

jest.mock('../../database/connection', () => ({ query: jest.fn() }))

const mockQuery = query as jest.Mock

function makeRule(overrides: Partial<SourcingPricingRule> = {}): SourcingPricingRule {
  return {
    id: 'rule-1',
    rule_type: 'margin_percent',
    margin_percent: 40,
    fixed_markup: null,
    rounding_mode: 'none',
    ...overrides,
  }
}

describe('computeSuggestedPrice -- margin_percent rule', () => {
  it('computes a true margin, not a markup: cost / (1 - margin/100)', () => {
    const result = computeSuggestedPrice(10, makeRule({ margin_percent: 40 }))
    // 10 / 0.6 = 16.666...
    expect(result.suggestedSalePrice).toBeCloseTo(16.67, 1)
  })

  it('recomputes margin_percent from the actual rounded sale price, not just echoing the rule', () => {
    const result = computeSuggestedPrice(10, makeRule({ margin_percent: 40, rounding_mode: 'nearest_1' }))
    // rounded sale = 17, margin = (17-10)/17 = 41.17...%
    expect(result.suggestedSalePrice).toBe(17)
    expect(result.suggestedMarginPercent).toBeCloseTo(41.18, 1)
  })

  it('falls back to cost price for an invalid margin (<=0 or >=100) rather than dividing by zero or negative', () => {
    expect(computeSuggestedPrice(10, makeRule({ margin_percent: 0 })).suggestedSalePrice).toBe(10)
    expect(computeSuggestedPrice(10, makeRule({ margin_percent: 100 })).suggestedSalePrice).toBe(10)
  })
})

describe('computeSuggestedPrice -- cost_plus_fixed rule', () => {
  it('adds the fixed markup directly to cost', () => {
    const result = computeSuggestedPrice(10, makeRule({ rule_type: 'cost_plus_fixed', fixed_markup: 8 }))
    expect(result.suggestedSalePrice).toBe(18)
  })
})

describe('computeSuggestedPrice -- rounding modes', () => {
  it('"none" leaves the raw computed price as-is (2 decimal places)', () => {
    const result = computeSuggestedPrice(10, makeRule({ rule_type: 'cost_plus_fixed', fixed_markup: 5.555, rounding_mode: 'none' }))
    expect(result.suggestedSalePrice).toBe(15.56)
  })

  it('"nearest_1" rounds to the nearest whole currency unit', () => {
    const result = computeSuggestedPrice(10, makeRule({ rule_type: 'cost_plus_fixed', fixed_markup: 5.4, rounding_mode: 'nearest_1' }))
    expect(result.suggestedSalePrice).toBe(15)
  })

  it('"charm" rounds up to the next x.99, never down below the raw price (never erodes the configured margin)', () => {
    const result = computeSuggestedPrice(10, makeRule({ rule_type: 'cost_plus_fixed', fixed_markup: 6.5, rounding_mode: 'charm' }))
    // raw = 16.5 -> charm should land at 16.99, not 15.99
    expect(result.suggestedSalePrice).toBe(16.99)
    expect(result.suggestedSalePrice).toBeGreaterThanOrEqual(16.5)
  })

  it('"charm" on an already-whole raw price still lands on x.99 above it', () => {
    const result = computeSuggestedPrice(10, makeRule({ rule_type: 'cost_plus_fixed', fixed_markup: 7, rounding_mode: 'charm' }))
    // raw = 17.0 -> ceil(17.0) - 0.01 = 16.99, which is BELOW the raw
    // price, so the charm branch must fall back to the whole unit (17)
    // rather than erode the margin.
    expect(result.suggestedSalePrice).toBe(17)
  })
})

describe('applyPricingSuggestion', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns null when the sourced product has no captured cost price yet', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ captured_cost_price_eur: null }] })
    const result = await applyPricingSuggestion('sp-1')
    expect(result).toBeNull()
  })

  it('returns null when no pricing rule can be resolved (no default configured)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ captured_cost_price_eur: 10 }] }).mockResolvedValueOnce({ rows: [] })
    const result = await applyPricingSuggestion('sp-1')
    expect(result).toBeNull()
  })

  it('writes suggested_sale_price/suggested_margin_percent and seeds final_* via COALESCE (never overwrites an existing founder edit)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ captured_cost_price_eur: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'rule-1', rule_type: 'margin_percent', margin_percent: 40, fixed_markup: null, rounding_mode: 'none' }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await applyPricingSuggestion('sp-1')

    expect(result).not.toBeNull()
    const updateCall = mockQuery.mock.calls[2]
    expect(updateCall[0]).toContain('COALESCE(final_cost_price')
    expect(updateCall[0]).toContain('COALESCE(final_sale_price')
  })
})
