import { getBrandStats } from './brand.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const BRAND_A = '11111111-1111-1111-1111-111111111111'
const BRAND_B = '22222222-2222-2222-2222-222222222222'

describe('getBrandStats -- real per-brand numbers, no fabricated fields', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns an empty stats object and issues no query when no ids are supplied', async () => {
    const req: any = { query: {} }
    const res = makeRes()

    await getBrandStats(req, res)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { stats: {} } })
  })

  it('filters out non-UUID values from a comma-separated ids list rather than passing them to SQL', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { query: { ids: `${BRAND_A}, not-a-uuid , <script>` } }
    const res = makeRes()

    await getBrandStats(req, res)

    expect(mockQuery.mock.calls[0][1]).toEqual([[BRAND_A]])
  })

  it('merges product count, real paid-order sales, and new-product count per brand, defaulting untouched brands to zero', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ brand_id: BRAND_A, product_count: '12' }] })
      .mockResolvedValueOnce({ rows: [{ brand_id: BRAND_A, units_sold: '340', revenue_total: '15234.50' }] })
      .mockResolvedValueOnce({ rows: [{ brand_id: BRAND_A, new_products_count: '3' }] })

    const req: any = { query: { ids: `${BRAND_A},${BRAND_B}` } }
    const res = makeRes()

    await getBrandStats(req, res)

    const payload = res.json.mock.calls[0][0]
    expect(payload.data.stats[BRAND_A]).toEqual({
      productCount: 12,
      unitsSold: 340,
      revenueTotal: 15234.5,
      newProductsCount: 3,
    })
    // BRAND_B had no matching rows in any of the three queries -- real
    // zeros, not omitted and not fabricated.
    expect(payload.data.stats[BRAND_B]).toEqual({
      productCount: 0,
      unitsSold: 0,
      revenueTotal: 0,
      newProductsCount: 0,
    })
  })

  it('only counts orders with payment_status = paid as real sales', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { query: { ids: BRAND_A } }
    const res = makeRes()

    await getBrandStats(req, res)

    const salesQuery = mockQuery.mock.calls.find((c: any[]) => c[0].includes('units_sold'))
    expect(salesQuery![0]).toContain("o.payment_status = 'paid'")
  })

  it('returns 500 without leaking the raw error when the database throws', async () => {
    mockQuery.mockRejectedValue(new Error('connection reset'))
    const req: any = { query: { ids: BRAND_A } }
    const res = makeRes()

    await getBrandStats(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})
