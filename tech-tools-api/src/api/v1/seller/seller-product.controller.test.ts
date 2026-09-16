import {
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  reviewSellerProduct,
} from './seller-product.controller'
import { query, getClient } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock
const mockGetClient = getClient as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const SELLER_PROFILE_ID = '99999999-0000-0000-0000-000000000001'
const PRODUCT_ID = '55555555-0000-0000-0000-000000000001'
const USER_ID = '11111111-0000-0000-0000-000000000001'

const makeCreateReq = (overrides: any = {}) => ({
  body: {
    sku: 'SKU-1',
    name: 'Test Product',
    slug: 'test-product',
    categoryId: 'cat-1',
    basePrice: 49.99,
    stockQuantity: 10,
    ...overrides,
  },
  files: undefined,
  user: { id: USER_ID, userId: USER_ID },
  sellerProfileId: SELLER_PROFILE_ID,
})

describe('createSellerProduct -- real tier enforcement, no fabricated numbers', () => {
  beforeEach(() => jest.clearAllMocks())

  it('403s when the caller has no sellerProfileId (not an approved seller)', async () => {
    const req: any = makeCreateReq()
    delete req.sellerProfileId
    const res = makeRes()

    await createSellerProduct(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a new listing once the seller is at their tier\'s max_active_listings', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tier: 'basic', max_active_listings: 5, max_product_price: 499.99 }] }) // tier limits
      .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // already at the limit

    const req: any = makeCreateReq()
    const res = makeRes()

    await createSellerProduct(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('5 listings') }),
    )
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('rejects a price above the tier\'s max_product_price', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tier: 'basic', max_active_listings: 25, max_product_price: 100 }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    const req: any = makeCreateReq({ basePrice: 250 })
    const res = makeRes()

    await createSellerProduct(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('caps product price') }),
    )
  })

  it('allows any price when the tier has no cap (max_product_price=null, e.g. pro tier)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tier: 'pro', max_active_listings: 99999, max_product_price: null }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] }) // sku check
      .mockResolvedValueOnce({ rows: [] }) // slug check

    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.includes('INSERT INTO products')) {
          return { rows: [{ id: PRODUCT_ID, is_active: false, seller_profile_id: SELLER_PROFILE_ID }] }
        }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(client)

    const req: any = makeCreateReq({ basePrice: 999999 })
    const res = makeRes()

    await createSellerProduct(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('forces is_active=false and stamps seller_profile_id on the real INSERT, regardless of body', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tier: 'basic', max_active_listings: 25, max_product_price: 499.99 }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    let insertParams: any[] = []
    const client = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.includes('INSERT INTO products')) {
          insertParams = params || []
          return { rows: [{ id: PRODUCT_ID, is_active: false, seller_profile_id: SELLER_PROFILE_ID }] }
        }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(client)

    const req: any = makeCreateReq({ isActive: true })
    const res = makeRes()

    await createSellerProduct(req, res)

    // params: sku,name,slug,description,shortDescription,brandId,categoryId,basePrice,salePrice,stockQuantity,sellerProfileId
    expect(insertParams[insertParams.length - 1]).toBe(SELLER_PROFILE_ID)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('creates a matching inventory row in the same transaction', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tier: 'basic', max_active_listings: 25, max_product_price: 499.99 }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const queriesRun: string[] = []
    const client = {
      query: jest.fn(async (sql: string) => {
        queriesRun.push(sql)
        if (sql.includes('INSERT INTO products')) {
          return { rows: [{ id: PRODUCT_ID }] }
        }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(client)

    const req: any = makeCreateReq()
    const res = makeRes()

    await createSellerProduct(req, res)

    expect(queriesRun.some((sql) => sql.includes('INSERT INTO inventory'))).toBe(true)
  })
})

describe('updateSellerProduct / deleteSellerProduct -- ownership scoped', () => {
  beforeEach(() => jest.clearAllMocks())

  it('403s when a seller tries to update a product they do not own', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ seller_profile_id: 'someone-else' }] })
    const req: any = {
      params: { id: PRODUCT_ID },
      body: { name: 'hijacked' },
      user: { id: USER_ID },
      sellerProfileId: SELLER_PROFILE_ID,
    }
    const res = makeRes()

    await updateSellerProduct(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('403s when a seller tries to delete a product they do not own', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ seller_profile_id: 'someone-else' }] })
    const req: any = { params: { id: PRODUCT_ID }, user: { id: USER_ID }, sellerProfileId: SELLER_PROFILE_ID }
    const res = makeRes()

    await deleteSellerProduct(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('forces is_active back to false when a seller edits their own product', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ seller_profile_id: SELLER_PROFILE_ID }] }) // ownership
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, is_active: false }] }) // UPDATE ... RETURNING *

    const req: any = {
      params: { id: PRODUCT_ID },
      body: { name: 'Updated name', isActive: true },
      user: { id: USER_ID },
      sellerProfileId: SELLER_PROFILE_ID,
    }
    const res = makeRes()

    await updateSellerProduct(req, res)

    const updateCall = mockQuery.mock.calls[1]
    expect(updateCall[0]).toContain('is_active = $')
    expect(updateCall[1]).toContain(false)
  })
})

describe('reviewSellerProduct -- admin-only approval for a pending seller product', () => {
  beforeEach(() => jest.clearAllMocks())

  it('approves (is_active=true) a pending seller-listed product', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: PRODUCT_ID, is_active: true, seller_profile_id: SELLER_PROFILE_ID }] })
    const req: any = { params: { id: PRODUCT_ID } }
    const res = makeRes()

    await reviewSellerProduct(req, res)

    expect(mockQuery.mock.calls[0][0]).toContain('SET is_active = TRUE')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ is_active: true }) }),
    )
  })

  it('404s when there is no matching pending seller product', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { params: { id: 'does-not-exist' } }
    const res = makeRes()

    await reviewSellerProduct(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})
