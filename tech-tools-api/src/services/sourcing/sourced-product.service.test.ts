import {
  captureProduct,
  commitSourcedProduct,
  updateReviewFields,
  discardSourcedProduct,
} from './sourced-product.service'
import { query, getClient } from '../../database/connection'
import { convertToEur } from './sourcing-fx.service'
import { applyPricingSuggestion } from './sourcing-pricing.service'

jest.mock('../../database/connection', () => ({ query: jest.fn(), getClient: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('./sourcing-fx.service', () => ({ convertToEur: jest.fn() }))
jest.mock('./sourcing-pricing.service', () => ({ applyPricingSuggestion: jest.fn() }))

const mockQuery = query as jest.Mock
const mockGetClient = getClient as jest.Mock
const mockConvertToEur = convertToEur as jest.Mock
const mockApplyPricingSuggestion = applyPricingSuggestion as jest.Mock

const SAMPLE_PAYLOAD = {
  sourcePlatform: 'alibaba' as const,
  sourceUrl: 'https://www.alibaba.com/product-detail/example.html',
  sourceProductId: '160123456',
  title: 'Cross-border Aluminum Alloy Cabinet Door Tool',
  descriptionHtml: '<p>A useful tool.</p>',
  images: [{ url: 'https://cdn.alibaba.com/a.jpg', position: 0 }],
  priceTiers: [
    { minQty: 1, maxQty: 99, price: 6.98, currency: 'USD' },
    { minQty: 100, maxQty: 499, price: 6.11, currency: 'USD' },
  ],
  specs: { Material: 'Aluminum alloy' },
  currency: 'USD',
}

describe('captureProduct', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a payload with no title', async () => {
    await expect(captureProduct({ ...SAMPLE_PAYLOAD, title: '' }, 'user-1', null)).rejects.toThrow(/no title/i)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a payload with an unrecognized source platform', async () => {
    await expect(captureProduct({ ...SAMPLE_PAYLOAD, sourcePlatform: 'ebay' as any }, 'user-1', null)).rejects.toThrow(/platform/i)
  })

  it('uses the lowest-quantity price tier as the captured cost, converts it to EUR, and applies a pricing suggestion', async () => {
    mockConvertToEur.mockResolvedValue({ amountEur: 6.0, rate: 0.86, source: 'frankfurter.dev' })
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1' }] })
    mockApplyPricingSuggestion.mockResolvedValue({ suggestedSalePrice: 10, suggestedMarginPercent: 40, ruleId: 'rule-1' })

    const result = await captureProduct(SAMPLE_PAYLOAD, 'user-1', 'token-1')

    expect(result.id).toBe('sp-1')
    expect(mockConvertToEur).toHaveBeenCalledWith(6.98, 'USD') // lowest tier (minQty 1), not the 100+ tier
    const insertParams = mockQuery.mock.calls[0][1]
    expect(insertParams).toContain(6.98) // captured_cost_price_original
    expect(insertParams).toContain(6.0) // captured_cost_price_eur
    expect(mockApplyPricingSuggestion).toHaveBeenCalledWith('sp-1')
  })

  it('still captures the product even when FX conversion fails -- captured_cost_price_eur stays NULL, never a guessed value', async () => {
    mockConvertToEur.mockResolvedValue(null)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-2' }] })

    const result = await captureProduct(SAMPLE_PAYLOAD, 'user-1', null)

    expect(result.id).toBe('sp-2')
    const insertParams = mockQuery.mock.calls[0][1]
    expect(insertParams[12]).toBeNull() // captured_cost_price_eur param position
    expect(mockApplyPricingSuggestion).not.toHaveBeenCalled() // no cost in EUR yet -- nothing to price
  })

  it('a pricing-suggestion failure never fails the capture itself', async () => {
    mockConvertToEur.mockResolvedValue({ amountEur: 6.0, rate: 0.86, source: 'frankfurter.dev' })
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-3' }] })
    mockApplyPricingSuggestion.mockRejectedValue(new Error('pricing rule lookup failed'))

    await expect(captureProduct(SAMPLE_PAYLOAD, 'user-1', null)).resolves.toEqual({ id: 'sp-3' })
  })

  it('captures a product with no price tiers at all (e.g. malformed page) without crashing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-4' }] })
    const result = await captureProduct({ ...SAMPLE_PAYLOAD, priceTiers: [] }, 'user-1', null)
    expect(result.id).toBe('sp-4')
    expect(mockConvertToEur).not.toHaveBeenCalled()
  })
})

describe('updateReviewFields', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws if the sourced product does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(updateReviewFields('sp-missing', { reviewTitle: 'New title' }, 'user-1')).rejects.toThrow(/not found/i)
  })

  it('rejects editing an already-committed sourced product', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1', status: 'committed' }] })
    await expect(updateReviewFields('sp-1', { reviewTitle: 'x' }, 'user-1')).rejects.toThrow(/committed/i)
  })

  it('sets status to review_edited on a successful edit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1', status: 'ready_for_review' }] }).mockResolvedValueOnce({ rows: [] })
    await updateReviewFields('sp-1', { reviewTitle: 'Better title' }, 'user-1')
    expect(mockQuery.mock.calls[1][0]).toContain("status = 'review_edited'")
  })
})

describe('discardSourcedProduct', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects discarding an already-committed sourced product', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1', status: 'committed' }] })
    await expect(discardSourcedProduct('sp-1', 'duplicate', 'user-1')).rejects.toThrow(/already been committed/i)
  })

  it('discards a non-committed row with a reason', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1', status: 'captured' }] }).mockResolvedValueOnce({ rows: [] })
    await discardSourcedProduct('sp-1', 'duplicate listing', 'user-1')
    expect(mockQuery.mock.calls[1][1]).toEqual(['sp-1', 'duplicate listing'])
  })
})

describe('commitSourcedProduct -- the one function that writes to products', () => {
  beforeEach(() => jest.clearAllMocks())

  const READY_SOURCED_ROW = {
    id: 'sp-1',
    status: 'ready_for_review',
    review_title: null,
    rewritten_title: 'Aluminum Cabinet Door Installation Tool',
    captured_title: 'Cross-border Aluminum Alloy Cabinet Door Tool',
    review_description_html: null,
    rewritten_description_html: '<p>Rewritten.</p>',
    captured_description_html: '<p>Original.</p>',
    review_images: null,
    captured_images: [{ url: 'https://cdn.alibaba.com/a.jpg', position: 0 }],
    final_cost_price: 6.0,
    captured_cost_price_eur: 6.0,
    final_sale_price: 10.0,
    suggested_sale_price: 10.0,
    captured_specs: { Material: 'Aluminum alloy' },
  }

  it('throws if the sourced product does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(commitSourcedProduct('sp-missing', 'user-1')).rejects.toThrow(/not found/i)
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('rejects re-committing an already-committed row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...READY_SOURCED_ROW, status: 'committed' }] })
    await expect(commitSourcedProduct('sp-1', 'user-1')).rejects.toThrow(/already been committed/i)
  })

  it('rejects committing a discarded row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...READY_SOURCED_ROW, status: 'discarded' }] })
    await expect(commitSourcedProduct('sp-1', 'user-1')).rejects.toThrow(/discarded/i)
  })

  it('rejects committing without at least one image', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...READY_SOURCED_ROW, review_images: [], captured_images: [] }] })
    await expect(commitSourcedProduct('sp-1', 'user-1')).rejects.toThrow(/image/i)
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('rejects committing without a cost or sale price', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...READY_SOURCED_ROW, final_cost_price: null, captured_cost_price_eur: null }] })
    await expect(commitSourcedProduct('sp-1', 'user-1')).rejects.toThrow(/cost price/i)
  })

  it('creates exactly one products row, one inventory row, one image row, one spec row, and upserts product_unit_economics, all inside one transaction', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [READY_SOURCED_ROW] })
    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO products')) return { rows: [{ id: 'product-1' }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await commitSourcedProduct('sp-1', 'user-1')

    expect(result.productId).toBe('product-1')
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')

    const calls = mockClient.query.mock.calls
    expect(calls.filter((c: any[]) => c[0].includes('INSERT INTO products')).length).toBe(1)
    expect(calls.filter((c: any[]) => c[0].includes('INSERT INTO inventory')).length).toBe(1)
    expect(calls.filter((c: any[]) => c[0].includes('INSERT INTO product_media')).length).toBe(1)
    expect(calls.filter((c: any[]) => c[0].includes('INSERT INTO product_specifications')).length).toBe(1)
    expect(calls.filter((c: any[]) => c[0].includes('INSERT INTO product_unit_economics')).length).toBe(1)
    // Never touches product_variations -- confirmed stub-only elsewhere in this codebase.
    expect(calls.some((c: any[]) => c[0].includes('product_variations'))).toBe(false)

    const productInsert = calls.find((c: any[]) => c[0].includes('INSERT INTO products'))!
    // is_active and is_backorder_allowed are the last two positional params.
    expect(productInsert[1].slice(-2)).toEqual([true, true]) // is_active = true, is_backorder_allowed = true
    expect(productInsert[1]).toContain(0) // stock_quantity = 0

    const finalUpdate = calls.find((c: any[]) => c[0].includes("UPDATE sourced_products SET status = 'committed'"))
    expect(finalUpdate![1]).toEqual(['sp-1', 'product-1', 'user-1'])
  })

  it('prefers review_title/review_description_html/review_images over the AI rewrite and raw capture', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          ...READY_SOURCED_ROW,
          review_title: 'Founder-edited title',
          review_description_html: '<p>Founder-edited description.</p>',
          review_images: [{ url: 'https://cdn.alibaba.com/founder-choice.jpg', position: 0 }],
        },
      ],
    })
    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => (sql.includes('INSERT INTO products') ? { rows: [{ id: 'product-1' }] } : { rows: [] })),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    await commitSourcedProduct('sp-1', 'user-1')

    const productInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO products'))!
    expect(productInsert[1]).toContain('Founder-edited title')
    expect(productInsert[1]).toContain('<p>Founder-edited description.</p>')
    const imageInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO product_media'))!
    expect(imageInsert[1]).toContain('https://cdn.alibaba.com/founder-choice.jpg')
  })

  it('rolls back and releases the client if any insert in the transaction fails', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [READY_SOURCED_ROW] })
    const mockClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO products')) throw new Error('sku collision')
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    await expect(commitSourcedProduct('sp-1', 'user-1')).rejects.toThrow('sku collision')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('computes gross_margin/margin_percent for product_unit_economics from the actual committed cost/sale prices', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [READY_SOURCED_ROW] }) // cost=6, sale=10
    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => (sql.includes('INSERT INTO products') ? { rows: [{ id: 'product-1' }] } : { rows: [] })),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    await commitSourcedProduct('sp-1', 'user-1')

    const economicsInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO product_unit_economics'))!
    // sell_price=10, landed_cost=6, gross_margin=4, margin_percent=(4/10)*100=40
    expect(economicsInsert[1]).toEqual(['product-1', 10, 6, 4, 40])
  })
})
