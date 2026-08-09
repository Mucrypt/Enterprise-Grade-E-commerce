import { createProduct } from './product.controller'
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

const makeReq = (overrides: any = {}) => ({
  body: {
    sku: 'SKU-1',
    name: 'Test Product',
    slug: 'test-product',
    stockQuantity: 25,
    ...overrides,
  },
  files: undefined,
  user: { userId: 'admin-1' },
})

describe('createProduct', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // No existing SKU/slug conflicts by default.
    mockQuery.mockResolvedValue({ rows: [] })
  })

  it('creates the product and a matching inventory row in the same transaction', async () => {
    const queries: string[] = []
    const client = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        queries.push(sql)
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.includes('INSERT INTO products')) {
          return { rows: [{ id: 'product-1', sku: 'SKU-1', stock_quantity: 25 }] }
        }
        if (sql.includes('INSERT INTO inventory')) {
          return { rows: [] }
        }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(client)
    // Final "fetch complete product with media" read after the transaction.
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT p.*')) {
        return { rows: [{ id: 'product-1', sku: 'SKU-1' }] }
      }
      return { rows: [] }
    })

    const req: any = makeReq()
    const res = makeRes()

    await createProduct(req, res)

    expect(queries).toEqual(
      expect.arrayContaining(['BEGIN', 'COMMIT']),
    )
    const inventoryCall = client.query.mock.calls.find((call: any[]) =>
      call[0].includes('INSERT INTO inventory'),
    )
    expect(inventoryCall).toBeDefined()
    expect(inventoryCall![1]).toEqual(['product-1', 25])
    expect(client.release).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('rolls back and releases the client if the inventory insert fails', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
        if (sql.includes('INSERT INTO products')) {
          return { rows: [{ id: 'product-1' }] }
        }
        if (sql.includes('INSERT INTO inventory')) {
          throw new Error('simulated inventory insert failure')
        }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(client)

    const req: any = makeReq()
    const res = makeRes()

    await createProduct(req, res)

    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('does not open a transaction when the SKU already exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-product' }] })

    const req: any = makeReq()
    const res = makeRes()

    await createProduct(req, res)

    expect(mockGetClient).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
