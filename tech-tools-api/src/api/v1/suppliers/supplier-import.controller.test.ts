import { commitSupplierImport } from './supplier-import.controller'
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

describe('commitSupplierImport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('ensures an inventory row for every committed row, without ON CONFLICT (no unique constraint on inventory.product_id)', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'batch-1',
          supplier_id: 'supplier-1',
          status: 'preview',
          parsed_rows: [
            {
              rowNumber: 2,
              sku: 'NEW-SKU',
              productName: 'New Product',
              costPrice: 10,
              stockQuantity: 5,
              leadTimeDays: 3,
              currencyCode: 'EUR',
              action: 'create',
            },
            {
              rowNumber: 3,
              sku: 'EXISTING-SKU',
              productName: 'Existing Product',
              costPrice: 20,
              stockQuantity: 8,
              leadTimeDays: 3,
              currencyCode: 'EUR',
              action: 'update',
              existingProductId: 'existing-product-1',
            },
          ],
        },
      ],
    })

    const client = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.includes('INSERT INTO products')) {
          return { rows: [{ id: 'new-product-1' }] }
        }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(client)

    const req: any = {
      params: { id: 'supplier-1', batchId: 'batch-1' },
    }
    const res = makeRes()

    await commitSupplierImport(req, res)

    const inventoryCalls = client.query.mock.calls.filter((call: any[]) =>
      call[0].includes('INSERT INTO inventory'),
    )

    // One inventory-ensure attempt per committed row (create + update).
    expect(inventoryCalls).toHaveLength(2)

    // Uses an existence-check INSERT...WHERE NOT EXISTS, never ON CONFLICT --
    // there is no unique constraint on inventory.product_id, so ON CONFLICT
    // would fail at runtime.
    for (const call of inventoryCalls) {
      expect(call[0]).not.toMatch(/ON CONFLICT/i)
      expect(call[0]).toMatch(/WHERE NOT EXISTS/i)
    }

    expect(inventoryCalls[0][1]).toEqual(['new-product-1', 5])
    expect(inventoryCalls[1][1]).toEqual(['existing-product-1', 8])

    expect(client.query).toHaveBeenCalledWith('COMMIT')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    )
  })
})
