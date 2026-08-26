import {
  addBusinessDays,
  resolveDeliveryTemplate,
  ProductNotFoundError,
  DeliveryTemplateRow,
} from './delivery-estimate.service'
import { query } from '../../database/connection'

jest.mock('../../database/connection', () => ({ query: jest.fn() }))

const mockQuery = query as jest.Mock

function makeTemplate(overrides: Partial<DeliveryTemplateRow> = {}): DeliveryTemplateRow {
  return {
    id: 'tpl-1',
    name: 'Test template',
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
    ...overrides,
  }
}

describe('addBusinessDays', () => {
  it('adds calendar days directly when skipWeekends is false', () => {
    const start = new Date('2026-08-24T00:00:00Z') // Monday
    const result = addBusinessDays(start, 5, false)
    expect(result.toISOString().slice(0, 10)).toBe('2026-08-29')
  })

  it('skips Saturday/Sunday when adding across a weekend boundary', () => {
    const start = new Date('2026-08-27T00:00:00Z') // Thursday
    // +1 business day -> Friday 28th, +2 -> skip Sat/Sun -> Monday 31st
    const result = addBusinessDays(start, 2, true)
    expect(result.toISOString().slice(0, 10)).toBe('2026-08-31')
  })

  it('returns the same date unchanged for 0 days', () => {
    const start = new Date('2026-08-24T00:00:00Z')
    const result = addBusinessDays(start, 0, true)
    expect(result.toISOString().slice(0, 10)).toBe('2026-08-24')
  })
})

describe('resolveDeliveryTemplate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws ProductNotFoundError when the product does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(resolveDeliveryTemplate('missing', 'IT')).rejects.toThrow(ProductNotFoundError)
  })

  it('tier 1: uses the product-level override when it is active', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ category_id: 'cat-1', delivery_template_id: 'tpl-override' }] })
      .mockResolvedValueOnce({ rows: [makeTemplate({ id: 'tpl-override', scope_type: 'category' })] })

    const result = await resolveDeliveryTemplate('p1', 'IT')
    expect(result.scopeMatched).toBe('product_override')
    expect(result.template.id).toBe('tpl-override')
  })

  it('tier 1 falls through to tier 2 when the override FK points at a now-inactive template', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ category_id: 'cat-1', delivery_template_id: 'tpl-stale' }] })
      .mockResolvedValueOnce({ rows: [] }) // override lookup: is_active=true finds nothing
      .mockResolvedValueOnce({ rows: [makeTemplate({ id: 'tpl-category', scope_type: 'category' })] })

    const result = await resolveDeliveryTemplate('p1', 'IT')
    expect(result.scopeMatched).toBe('category')
    expect(result.template.id).toBe('tpl-category')
  })

  it('tier 2: uses the category-assigned template when no product override is set', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ category_id: 'cat-1', delivery_template_id: null }] })
      .mockResolvedValueOnce({ rows: [makeTemplate({ id: 'tpl-category', scope_type: 'category' })] })

    const result = await resolveDeliveryTemplate('p1', 'IT')
    expect(result.scopeMatched).toBe('category')
  })

  it('tier 2 falls through to tier 3 when the category has no template', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ category_id: 'cat-1', delivery_template_id: null }] })
      .mockResolvedValueOnce({ rows: [] }) // no category template
      .mockResolvedValueOnce({ rows: [makeTemplate({ id: 'tpl-location', scope_type: 'location' })] })

    const result = await resolveDeliveryTemplate('p1', 'IT')
    expect(result.scopeMatched).toBe('location')
  })

  it('tier 3: skips straight past location when no country was resolved', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ category_id: null, delivery_template_id: null }] })
      .mockResolvedValueOnce({ rows: [makeTemplate({ id: 'tpl-global', scope_type: 'global' })] })

    const result = await resolveDeliveryTemplate('p1', null)
    expect(result.scopeMatched).toBe('global')
    // Only 2 queries: product lookup + global lookup -- location tier
    // must never be queried when countryCode is null.
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('tier 4: falls back to the in-code default when the seeded global row is somehow missing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ category_id: null, delivery_template_id: null }] })
      .mockResolvedValueOnce({ rows: [] }) // no global default row found

    const result = await resolveDeliveryTemplate('p1', null)
    expect(result.scopeMatched).toBe('global')
    expect(result.template.id).toBe('fallback')
  })
})
