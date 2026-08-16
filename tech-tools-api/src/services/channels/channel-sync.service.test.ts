import { previewProductSync, commitProductSync, runInventoryDiff, importOrders } from './channel-sync.service'
import { query, getClient } from '../../database/connection'
import { getChannelAdapter } from './registry'

jest.mock('../../database/connection', () => ({ query: jest.fn(), getClient: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('./registry', () => ({ getChannelAdapter: jest.fn() }))
jest.mock('../../utils/secret-encryption', () => ({
  channelTokenCipher: { decryptSecret: jest.fn(() => 'decrypted-access-token'), encryptSecret: jest.fn((v: string) => `enc:${v}`) },
}))

const mockQuery = query as jest.Mock
const mockGetClient = getClient as jest.Mock
const mockGetChannelAdapter = getChannelAdapter as jest.Mock

const CONNECTED_ACCOUNT_ROW = {
  id: 'account-1',
  channel_type: 'TIKTOK_SHOP',
  access_token_encrypted: 'v1:iv:tag:ct',
  external_shop_id: 'shop-123',
  shop_cipher: 'cipher-abc',
  status: 'CONNECTED',
}

describe('previewProductSync -- read + diff only, never mutates live tables', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws without querying products if the channel account is not connected', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(previewProductSync('missing-account', null)).rejects.toThrow(/not connected/i)
  })

  it('creates a channel_sync_runs row with status=preview and never writes to channel_product_mappings', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }) // loadDecryptedCreds
      .mockResolvedValueOnce({ rows: [] }) // existing mappings
      .mockResolvedValueOnce({ rows: [] }) // matched products by sku
      .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] }) // INSERT INTO channel_sync_runs

    mockGetChannelAdapter.mockReturnValue({
      fetchProducts: jest.fn().mockResolvedValue([
        { channelProductId: 'p1', productTitle: 'Impact Drill', productStatus: 'ACTIVE', channelSkuId: 'sku1', sellerSku: 'DRILL-20V-BLK', price: 89, currency: 'EUR', stock: 12 },
      ]),
    })

    const result = await previewProductSync('account-1', 'user-1')

    expect(result.runId).toBe('run-1')
    expect(result.totalItems).toBe(1)
    expect(mockQuery.mock.calls.some((c: any[]) => c[0].includes('INSERT INTO channel_product_mappings'))).toBe(false)
    const runInsertCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_sync_runs'))
    expect(runInsertCall![0]).toContain("'preview'")
  })

  it('a channel listing with no matching TechTools product is CHANNEL_ONLY, never dropped from the plan', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] })
      .mockResolvedValueOnce({ rows: [] }) // no existing mappings
      .mockResolvedValueOnce({ rows: [] }) // no matching products by SKU
      .mockResolvedValueOnce({ rows: [{ id: 'run-2' }] })

    mockGetChannelAdapter.mockReturnValue({
      fetchProducts: jest.fn().mockResolvedValue([
        { channelProductId: 'p1', productTitle: 'Unmatched Gadget', productStatus: 'ACTIVE', channelSkuId: 'sku1', sellerSku: 'NO-MATCH-SKU', price: 20, currency: 'EUR', stock: 5 },
      ]),
    })

    const result = await previewProductSync('account-1', null)

    expect(result.unmapped).toBe(1)
    const runInsertCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_sync_runs'))
    const plan = JSON.parse(runInsertCall![1][5])
    expect(plan[0].mappingStatus).toBe('CHANNEL_ONLY')
    expect(plan[0].matchedProductId).toBeNull()
  })

  it('a channel listing whose sellerSku matches a real TechTools product is MAPPED', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'product-real-1', sku: 'DRILL-20V-BLK' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'run-3' }] })

    mockGetChannelAdapter.mockReturnValue({
      fetchProducts: jest.fn().mockResolvedValue([
        { channelProductId: 'p1', productTitle: 'Impact Drill', productStatus: 'ACTIVE', channelSkuId: 'sku1', sellerSku: 'DRILL-20V-BLK', price: 89, currency: 'EUR', stock: 12 },
      ]),
    })

    const result = await previewProductSync('account-1', null)

    expect(result.toCreate).toBe(1)
    expect(result.unmapped).toBe(0)
    const runInsertCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_sync_runs'))
    const plan = JSON.parse(runInsertCall![1][5])
    expect(plan[0].mappingStatus).toBe('MAPPED')
    expect(plan[0].matchedProductId).toBe('product-real-1')
  })
})

describe('commitProductSync -- applies a previewed plan, rejects re-committing', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws if the sync run does not exist for this channel account', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(commitProductSync('account-1', 'missing-run', 'user-1')).rejects.toThrow(/not found/i)
  })

  it('rejects committing a run that is already committed -- never silently re-applies', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-1', status: 'committed', parsed_items: [] }] })
    await expect(commitProductSync('account-1', 'run-1', 'user-1')).rejects.toThrow(/already "committed"/i)
  })

  it('upserts channel_product_mappings for each planned item inside one transaction, then marks the run committed', async () => {
    const plan = [
      {
        channelProductId: 'p1',
        channelSku: 'DRILL-20V-BLK',
        productTitle: 'Impact Drill',
        channelPrice: 89,
        channelCurrency: 'EUR',
        channelStock: 12,
        matchedProductId: 'product-real-1',
        mappingStatus: 'MAPPED',
        diff: null,
        existingMappingId: null,
      },
    ]
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-1', status: 'preview', parsed_items: plan }] })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_product_mappings')) return { rows: [{ inserted: true }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await commitProductSync('account-1', 'run-1', 'user-1')

    expect(result.createdCount).toBe(1)
    expect(result.updatedCount).toBe(0)
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(mockClient.query.mock.calls.some((c: any[]) => c[0].includes("UPDATE channel_sync_runs SET status = 'committed'"))).toBe(true)
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('rolls back the transaction and releases the client if an item upsert fails', async () => {
    const plan = [
      {
        channelProductId: 'p1',
        channelSku: 'X',
        productTitle: 'X',
        channelPrice: null,
        channelCurrency: null,
        channelStock: null,
        matchedProductId: null,
        mappingStatus: 'CHANNEL_ONLY',
        diff: null,
        existingMappingId: null,
      },
    ]
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-1', status: 'preview', parsed_items: plan }] })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_product_mappings')) throw new Error('constraint violation')
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    await expect(commitProductSync('account-1', 'run-1', 'user-1')).rejects.toThrow('constraint violation')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })
})

describe('runInventoryDiff -- read-only, never writes to inventory or the channel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws without querying mappings if the channel account is not connected', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(runInventoryDiff('missing-account', null)).rejects.toThrow(/not connected/i)
  })

  it('short-circuits to an empty committed run when there are no MAPPED product mappings', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] })
      .mockResolvedValueOnce({ rows: [] }) // no MAPPED mappings
      .mockResolvedValueOnce({ rows: [{ id: 'run-empty' }] })

    const result = await runInventoryDiff('account-1', null)

    expect(result.comparedCount).toBe(0)
    expect(result.flaggedCount).toBe(0)
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('flags a SKU whose TechTools stock differs from the channel-reported stock, and never touches the inventory table', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] })
      .mockResolvedValueOnce({
        rows: [{ id: 'mapping-1', channel_product_id: 'p1', channel_sku: 'DRILL-20V-BLK', product_id: 'product-1', available_stock: 12 }],
      })

    mockGetChannelAdapter.mockReturnValue({
      fetchProducts: jest.fn().mockResolvedValue([
        { channelProductId: 'p1', productTitle: 'Impact Drill', productStatus: 'ACTIVE', channelSkuId: 'sku1', sellerSku: 'DRILL-20V-BLK', price: 89, currency: 'EUR', stock: 10 },
      ]),
    })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await runInventoryDiff('account-1', null)

    expect(result.comparedCount).toBe(1)
    expect(result.flaggedCount).toBe(1)
    const diffInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_inventory_diffs'))
    expect(diffInsert![1]).toEqual(['run-1', 'mapping-1', 12, 10, 2, 'FLAGGED'])
    expect(mockClient.query.mock.calls.some((c: any[]) => c[0].includes('UPDATE inventory'))).toBe(false)
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
  })

  it('does not flag a SKU whose stock matches exactly', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] })
      .mockResolvedValueOnce({
        rows: [{ id: 'mapping-1', channel_product_id: 'p1', channel_sku: 'DRILL-20V-BLK', product_id: 'product-1', available_stock: 10 }],
      })

    mockGetChannelAdapter.mockReturnValue({
      fetchProducts: jest.fn().mockResolvedValue([
        { channelProductId: 'p1', productTitle: 'Impact Drill', productStatus: 'ACTIVE', channelSkuId: 'sku1', sellerSku: 'DRILL-20V-BLK', price: 89, currency: 'EUR', stock: 10 },
      ]),
    })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await runInventoryDiff('account-1', null)

    expect(result.flaggedCount).toBe(0)
    const diffInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_inventory_diffs'))
    expect(diffInsert![1]).toEqual(['run-1', 'mapping-1', 10, 10, 0, 'NONE'])
  })

  it('never fabricates a delta when the channel simply did not report stock for a SKU -- NULL, not a guessed zero', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] })
      .mockResolvedValueOnce({
        rows: [{ id: 'mapping-1', channel_product_id: 'p1', channel_sku: 'DRILL-20V-BLK', product_id: 'product-1', available_stock: 10 }],
      })

    mockGetChannelAdapter.mockReturnValue({
      fetchProducts: jest.fn().mockResolvedValue([
        { channelProductId: 'p1', productTitle: 'Impact Drill', productStatus: 'ACTIVE', channelSkuId: 'sku1', sellerSku: 'DRILL-20V-BLK', price: 89, currency: 'EUR', stock: null },
      ]),
    })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await runInventoryDiff('account-1', null)

    expect(result.flaggedCount).toBe(0)
    const diffInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_inventory_diffs'))
    expect(diffInsert![1]).toEqual(['run-1', 'mapping-1', 10, null, null, 'NONE'])
  })

  it('rolls back and releases the client if writing a diff row fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] })
      .mockResolvedValueOnce({
        rows: [{ id: 'mapping-1', channel_product_id: 'p1', channel_sku: 'X', product_id: 'product-1', available_stock: 10 }],
      })
    mockGetChannelAdapter.mockReturnValue({ fetchProducts: jest.fn().mockResolvedValue([]) })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        if (sql.includes('INSERT INTO channel_inventory_diffs')) throw new Error('db error')
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    await expect(runInventoryDiff('account-1', null)).rejects.toThrow('db error')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })
})

const SAMPLE_CHANNEL_ORDER = {
  channelOrderId: 'tt-order-1',
  channelOrderStatus: 'AWAITING_SHIPMENT',
  buyerDisplayName: 'J. Rossi',
  buyerCountry: 'IT',
  currency: 'EUR',
  grossAmount: 89.99,
  shippingFeeAmount: 4.99,
  taxAmount: null,
  externalUpdatedAt: null as Date | null,
  items: [
    { channelSku: 'DRILL-20V-BLK', channelProductId: 'p1', productTitle: 'Impact Drill', quantity: 1, unitPrice: 89.99, lineTotal: 89.99 },
  ],
  rawPayload: { id: 'tt-order-1' },
}

/** No watermark row -- forces the ORDER_IMPORT_LOOKBACK_MS rolling-window default. */
const NO_WATERMARK_ROW = { rows: [{ order_import_watermark: null }] }

describe('importOrders -- idempotent reconciliation, never materializes a TechTools order or touches inventory', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws without fetching orders if the channel account is not connected', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(importOrders('missing-account', null)).rejects.toThrow(/not connected/i)
  })

  it('upserts a new order and its line items, resolving a known product mapping', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }) // loadDecryptedCreds
      .mockResolvedValueOnce(NO_WATERMARK_ROW) // watermark lookup
      .mockResolvedValueOnce({ rows: [{ id: 'mapping-1', channel_product_id: 'p1', channel_sku: 'DRILL-20V-BLK' }] }) // mappings lookup

    mockGetChannelAdapter.mockReturnValue({ fetchOrders: jest.fn().mockResolvedValue({ orders: [SAMPLE_CHANNEL_ORDER], complete: true }) })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        if (sql.includes('INSERT INTO channel_orders')) return { rows: [{ id: 'order-row-1', inserted: true }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await importOrders('account-1', null)

    expect(result.importedCount).toBe(1)
    expect(result.updatedCount).toBe(0)
    expect(result.failedCount).toBe(0)
    expect(result.issueCount).toBe(0)
    expect(result.complete).toBe(true)

    const itemInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_order_items'))
    expect(itemInsert![1]).toEqual(['order-row-1', 'mapping-1', 'DRILL-20V-BLK', 1, 89.99, 89.99, JSON.stringify(SAMPLE_CHANNEL_ORDER.items[0])])
    expect(mockClient.query.mock.calls.some((c: any[]) => c[0].includes('DELETE FROM channel_order_items'))).toBe(true)
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')

    // A fully-successful, non-backfill run advances the watermark.
    const watermarkUpdate = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('order_import_watermark ='))
    expect(watermarkUpdate).toBeDefined()
  })

  it('re-importing the same channel_order_id updates the existing row via ON CONFLICT, never duplicates it', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce(NO_WATERMARK_ROW).mockResolvedValueOnce({ rows: [] })

    mockGetChannelAdapter.mockReturnValue({ fetchOrders: jest.fn().mockResolvedValue({ orders: [SAMPLE_CHANNEL_ORDER], complete: true }) })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        if (sql.includes('INSERT INTO channel_orders')) {
          expect(sql).toContain('ON CONFLICT (channel_account_id, channel_order_id)')
          return { rows: [{ id: 'order-row-1', inserted: false }] }
        }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await importOrders('account-1', null)

    expect(result.importedCount).toBe(0)
    expect(result.updatedCount).toBe(1)
  })

  it('records an order with an unparseable gross amount in channel_order_import_issues instead of silently skipping it, and keeps processing the rest', async () => {
    const badOrder = { ...SAMPLE_CHANNEL_ORDER, channelOrderId: 'tt-order-bad', grossAmount: NaN }
    const goodOrder = { ...SAMPLE_CHANNEL_ORDER, channelOrderId: 'tt-order-good' }
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce(NO_WATERMARK_ROW).mockResolvedValueOnce({ rows: [] })

    mockGetChannelAdapter.mockReturnValue({ fetchOrders: jest.fn().mockResolvedValue({ orders: [badOrder, goodOrder], complete: true }) })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        if (sql.includes('INSERT INTO channel_orders')) return { rows: [{ id: 'order-row-good', inserted: true }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await importOrders('account-1', null)

    expect(result.issueCount).toBe(1)
    expect(result.failedCount).toBe(0)
    expect(result.importedCount).toBe(1)
    const orderInsertCalls = mockClient.query.mock.calls.filter((c: any[]) => c[0].includes('INSERT INTO channel_orders'))
    expect(orderInsertCalls).toHaveLength(1)
    const issueInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_order_import_issues'))
    expect(issueInsert![1]).toEqual(['account-1', 'run-1', 'tt-order-bad', null, 'INVALID_ORDER_AMOUNT', expect.any(String)])
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
  })

  it('records an order with a missing currency as MISSING_CURRENCY', async () => {
    const noCurrencyOrder = { ...SAMPLE_CHANNEL_ORDER, currency: '' }
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce(NO_WATERMARK_ROW).mockResolvedValueOnce({ rows: [] })
    mockGetChannelAdapter.mockReturnValue({ fetchOrders: jest.fn().mockResolvedValue({ orders: [noCurrencyOrder], complete: true }) })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => (sql.includes('INSERT INTO channel_sync_runs') ? { rows: [{ id: 'run-1' }] } : { rows: [] })),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await importOrders('account-1', null)
    expect(result.issueCount).toBe(1)
    const issueInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_order_import_issues'))
    expect(issueInsert![1][4]).toBe('MISSING_CURRENCY')
  })

  it('records an order with no external order ID as MALFORMED_REMOTE_ORDER', async () => {
    const malformedOrder = { ...SAMPLE_CHANNEL_ORDER, channelOrderId: '' }
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce(NO_WATERMARK_ROW).mockResolvedValueOnce({ rows: [] })
    mockGetChannelAdapter.mockReturnValue({ fetchOrders: jest.fn().mockResolvedValue({ orders: [malformedOrder], complete: true }) })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => (sql.includes('INSERT INTO channel_sync_runs') ? { rows: [{ id: 'run-1' }] } : { rows: [] })),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await importOrders('account-1', null)
    expect(result.issueCount).toBe(1)
    const issueInsert = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO channel_order_import_issues'))
    expect(issueInsert![1][4]).toBe('MALFORMED_REMOTE_ORDER')
  })

  it('ignores a stale/out-of-order event whose external_updated_at is older than what is already stored, and does not touch its line items', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce(NO_WATERMARK_ROW).mockResolvedValueOnce({ rows: [] })
    mockGetChannelAdapter.mockReturnValue({ fetchOrders: jest.fn().mockResolvedValue({ orders: [SAMPLE_CHANNEL_ORDER], complete: true }) })

    const mockClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        // The conditional WHERE clause rejected the update -- Postgres
        // returns zero rows from RETURNING in that case.
        if (sql.includes('INSERT INTO channel_orders')) return { rows: [] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await importOrders('account-1', null)

    expect(result.staleIgnoredCount).toBe(1)
    expect(result.importedCount).toBe(0)
    expect(result.updatedCount).toBe(0)
    expect(mockClient.query.mock.calls.some((c: any[]) => c[0].includes('DELETE FROM channel_order_items'))).toBe(false)
    expect(mockClient.query.mock.calls.some((c: any[]) => c[0].includes('INSERT INTO channel_order_items'))).toBe(false)
    const activityLog = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('ORDER_IMPORT_STALE_EVENT_IGNORED'))
    expect(activityLog).toBeDefined()
  })

  it('uses the persisted watermark (minus the overlap buffer) instead of the rolling window when one exists', async () => {
    const watermark = new Date('2026-08-10T00:00:00.000Z')
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce({ rows: [{ order_import_watermark: watermark }] }).mockResolvedValueOnce({ rows: [] })
    const fetchOrdersMock = jest.fn().mockResolvedValue({ orders: [], complete: true })
    mockGetChannelAdapter.mockReturnValue({ fetchOrders: fetchOrdersMock })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => (sql.includes('INSERT INTO channel_sync_runs') ? { rows: [{ id: 'run-1' }] } : { rows: [] })),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    await importOrders('account-1', null)

    const sinceDateArg: Date = fetchOrdersMock.mock.calls[0][1]
    expect(sinceDateArg.getTime()).toBeLessThan(watermark.getTime())
    expect(sinceDateArg.getTime()).toBeGreaterThan(watermark.getTime() - 3 * 60 * 60 * 1000) // within the 2h overlap buffer, not the full 7-day window
  })

  it('does NOT advance the watermark when pagination failed partway (complete: false)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce(NO_WATERMARK_ROW).mockResolvedValueOnce({ rows: [] })
    mockGetChannelAdapter.mockReturnValue({
      fetchOrders: jest.fn().mockResolvedValue({ orders: [SAMPLE_CHANNEL_ORDER], complete: false, error: 'rate limited on page 3' }),
    })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        if (sql.includes('INSERT INTO channel_orders')) return { rows: [{ id: 'order-row-1', inserted: true }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const result = await importOrders('account-1', null)

    expect(result.complete).toBe(false)
    expect(mockClient.query.mock.calls.some((c: any[]) => c[0].includes('order_import_watermark ='))).toBe(false)
    const runUpdate = mockClient.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE channel_sync_runs SET status'))
    expect(runUpdate![1][1]).toBe('failed')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT') // orders fetched before the failed page are still applied, not discarded
  })

  it('a backfill (explicit fromDate) bypasses the watermark lookup entirely and never advances it', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce({ rows: [] }) // no watermark query -- only loadDecryptedCreds + mappings
    const fetchOrdersMock = jest.fn().mockResolvedValue({ orders: [], complete: true })
    mockGetChannelAdapter.mockReturnValue({ fetchOrders: fetchOrdersMock })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => (sql.includes('INSERT INTO channel_sync_runs') ? { rows: [{ id: 'run-1' }] } : { rows: [] })),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    const backfillFrom = new Date('2026-01-01T00:00:00.000Z')
    await importOrders('account-1', null, { fromDate: backfillFrom })

    expect(fetchOrdersMock).toHaveBeenCalledWith(expect.anything(), backfillFrom)
    expect(mockClient.query.mock.calls.some((c: any[]) => c[0].includes('order_import_watermark ='))).toBe(false)
  })

  it('never writes to orders, inventory, or techtools_order_id -- import stays scoped to channel_orders/channel_order_items', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce(NO_WATERMARK_ROW).mockResolvedValueOnce({ rows: [] })
    mockGetChannelAdapter.mockReturnValue({ fetchOrders: jest.fn().mockResolvedValue({ orders: [SAMPLE_CHANNEL_ORDER], complete: true }) })

    const mockClient = {
      query: jest.fn(async (sql: string, _params?: any[]) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) return { rows: [{ id: 'run-1' }] }
        if (sql.includes('INSERT INTO channel_orders')) return { rows: [{ id: 'order-row-1', inserted: true }] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    await importOrders('account-1', null)

    const forbidden = mockClient.query.mock.calls.filter(
      (c: any[]) => /\b(UPDATE|INSERT INTO)\s+(orders|inventory)\b/i.test(c[0]) || c[0].includes('techtools_order_id ='),
    )
    expect(forbidden).toHaveLength(0)
  })

  it('rolls back and releases the client if the run fails outright', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CONNECTED_ACCOUNT_ROW] }).mockResolvedValueOnce(NO_WATERMARK_ROW).mockResolvedValueOnce({ rows: [] })
    mockGetChannelAdapter.mockReturnValue({ fetchOrders: jest.fn().mockResolvedValue({ orders: [SAMPLE_CHANNEL_ORDER], complete: true }) })

    const mockClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO channel_sync_runs')) throw new Error('db unavailable')
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(mockClient)

    await expect(importOrders('account-1', null)).rejects.toThrow('db unavailable')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })
})
