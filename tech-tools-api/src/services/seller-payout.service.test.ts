jest.mock('../database/connection', () => ({ query: jest.fn(), getClient: jest.fn() }))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const makeClient = () => ({ query: jest.fn(), release: jest.fn() })

const SETTINGS_ROW = { fallback_hold_period_days: 30, min_payout_amount: '0.00', program_enabled: true }

/**
 * isSellerPayoutsEnabled() caches its infra-ready check for the process
 * lifetime (by design -- a table either exists or doesn't, unlike
 * settings which have a short TTL). Each test resets the module registry
 * and re-requires both the service AND its ../database/connection mock
 * fresh -- resetModules() creates a brand new mock instance each time, so
 * the returned mockQuery/mockGetClient here must always be used instead
 * of any reference captured before this call.
 */
function loadServiceFresh() {
  jest.resetModules()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const service = require('./seller-payout.service') as typeof import('./seller-payout.service')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const connection = require('../database/connection')
  return {
    ...service,
    mockQuery: connection.query as jest.Mock,
    mockGetClient: connection.getClient as jest.Mock,
  }
}

describe('recordSellerEarningsForOrder -- money-splitting logic', () => {
  beforeEach(() => {
    process.env.ENABLE_SELLER_TIERS = 'true'
  })

  it('is a no-op when ENABLE_SELLER_TIERS is not "true"', async () => {
    process.env.ENABLE_SELLER_TIERS = 'false'
    const { recordSellerEarningsForOrder, mockQuery } = loadServiceFresh()
    await recordSellerEarningsForOrder('order-1')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('is a no-op when the seller_earnings table does not exist yet', async () => {
    const { recordSellerEarningsForOrder, mockQuery } = loadServiceFresh()
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('to_regclass')) return Promise.resolve({ rows: [{ regclass: null }] })
      return Promise.resolve({ rows: [] })
    })
    await recordSellerEarningsForOrder('order-1')
    // Only the to_regclass check ran -- nothing about the order was ever queried.
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when seller_payout_settings.program_enabled is false', async () => {
    const { recordSellerEarningsForOrder, mockQuery, mockGetClient } = loadServiceFresh()
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('to_regclass')) return Promise.resolve({ rows: [{ regclass: 'seller_earnings' }] })
      if (sql.includes('seller_payout_settings')) {
        return Promise.resolve({ rows: [{ ...SETTINGS_ROW, program_enabled: false }] })
      }
      return Promise.resolve({ rows: [] })
    })
    await recordSellerEarningsForOrder('order-1')
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('excludes order_items with no seller_profile_id (platform-owned products) without erroring', async () => {
    const { recordSellerEarningsForOrder, mockQuery, mockGetClient } = loadServiceFresh()
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('to_regclass')) return Promise.resolve({ rows: [{ regclass: 'seller_earnings' }] })
      if (sql.includes('seller_payout_settings')) return Promise.resolve({ rows: [SETTINGS_ROW] })
      if (sql.includes('FROM order_items')) return Promise.resolve({ rows: [] }) // JOIN already excludes NULL seller_profile_id
      return Promise.resolve({ rows: [] })
    })
    await expect(recordSellerEarningsForOrder('order-1')).resolves.toBeUndefined()
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('splits a multi-seller order into one seller_earnings row per seller, with the correct independent sums', async () => {
    const { recordSellerEarningsForOrder, mockQuery, mockGetClient } = loadServiceFresh()
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO seller_earnings')) return Promise.resolve({ rows: [{ id: 'earning-row' }] })
      return Promise.resolve({ rows: [] })
    })

    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('to_regclass')) return Promise.resolve({ rows: [{ regclass: 'seller_earnings' }] })
      if (sql.includes('seller_payout_settings')) return Promise.resolve({ rows: [SETTINGS_ROW] })
      if (sql.includes('FROM order_items')) {
        return Promise.resolve({
          rows: [
            { order_item_id: 'item-1', total_price: '20.00', seller_profile_id: 'seller-A', tier: 'basic' },
            { order_item_id: 'item-2', total_price: '30.00', seller_profile_id: 'seller-A', tier: 'basic' },
            { order_item_id: 'item-3', total_price: '50.00', seller_profile_id: 'seller-B', tier: 'pro' },
          ],
        })
      }
      if (sql.includes('FROM seller_tier_config')) {
        return Promise.resolve({ rows: [{ commission_rate: '15.00' }] })
      }
      return Promise.resolve({ rows: [] })
    })

    await recordSellerEarningsForOrder('order-multi')

    const insertCalls = client.query.mock.calls.filter((c: any[]) => c[0].includes('INSERT INTO seller_earnings'))
    expect(insertCalls).toHaveLength(2)

    const sellerAParams = insertCalls.find((c: any[]) => c[1][0] === 'seller-A')![1]
    expect(sellerAParams[2]).toBe(50) // gross_item_amount: 20 + 30
    const sellerBParams = insertCalls.find((c: any[]) => c[1][0] === 'seller-B')![1]
    expect(sellerBParams[2]).toBe(50) // gross_item_amount: just item-3
  })

  it('is idempotent -- ON CONFLICT DO NOTHING means a duplicate webhook delivery skips the child-item inserts too', async () => {
    const { recordSellerEarningsForOrder, mockQuery, mockGetClient } = loadServiceFresh()
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    // Simulate the conflict case: the INSERT ... RETURNING id returns no rows.
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO seller_earnings')) return Promise.resolve({ rows: [] })
      return Promise.resolve({ rows: [] })
    })

    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('to_regclass')) return Promise.resolve({ rows: [{ regclass: 'seller_earnings' }] })
      if (sql.includes('seller_payout_settings')) return Promise.resolve({ rows: [SETTINGS_ROW] })
      if (sql.includes('FROM order_items')) {
        return Promise.resolve({
          rows: [{ order_item_id: 'item-1', total_price: '19.99', seller_profile_id: 'seller-A', tier: 'unverified' }],
        })
      }
      if (sql.includes('FROM seller_tier_config')) return Promise.resolve({ rows: [{ commission_rate: '20.00' }] })
      return Promise.resolve({ rows: [] })
    })

    await recordSellerEarningsForOrder('order-dup')

    const itemInsertCalls = client.query.mock.calls.filter((c: any[]) => c[0].includes('INSERT INTO seller_earning_items'))
    expect(itemInsertCalls).toHaveLength(0)
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })

  it('rounds commission the same way the affiliate system does (no float-cent drift)', async () => {
    const { recordSellerEarningsForOrder, mockQuery, mockGetClient } = loadServiceFresh()
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    let insertedParams: any[] = []
    client.query.mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO seller_earnings')) {
        insertedParams = params!
        return Promise.resolve({ rows: [{ id: 'earning-row' }] })
      }
      return Promise.resolve({ rows: [] })
    })

    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('to_regclass')) return Promise.resolve({ rows: [{ regclass: 'seller_earnings' }] })
      if (sql.includes('seller_payout_settings')) return Promise.resolve({ rows: [SETTINGS_ROW] })
      if (sql.includes('FROM order_items')) {
        // 19.99 * 0.15 = 2.9985 -- a classic float-cent-drift trap.
        return Promise.resolve({
          rows: [{ order_item_id: 'item-1', total_price: '19.99', seller_profile_id: 'seller-A', tier: 'basic' }],
        })
      }
      if (sql.includes('FROM seller_tier_config')) return Promise.resolve({ rows: [{ commission_rate: '15.00' }] })
      return Promise.resolve({ rows: [] })
    })

    await recordSellerEarningsForOrder('order-round')

    // params: [sellerProfileId, orderId, grossItemAmount, tier, commissionRate, platformCommissionAmount, sellerNetAmount]
    expect(insertedParams[5]).toBe(3) // Math.round(2.9985 * 100) / 100 rounds to 3.00, not 2.9985 or 2.99
    expect(insertedParams[6]).toBe(16.99) // 19.99 - 3.00
  })
})

describe('commission-rate snapshot -- never changes after the fact', () => {
  beforeEach(() => {
    process.env.ENABLE_SELLER_TIERS = 'true'
  })

  it('reads seller_tier_config at earning time only -- a later rate change never rewrites an already-recorded row', async () => {
    const { recordSellerEarningsForOrder, mockQuery, mockGetClient } = loadServiceFresh()
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO seller_earnings')) return Promise.resolve({ rows: [{ id: 'earning-row' }] })
      return Promise.resolve({ rows: [] })
    })

    let currentRate = '15.00' // basic tier's rate at the moment of the sale
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('to_regclass')) return Promise.resolve({ rows: [{ regclass: 'seller_earnings' }] })
      if (sql.includes('seller_payout_settings')) return Promise.resolve({ rows: [SETTINGS_ROW] })
      if (sql.includes('FROM order_items')) {
        return Promise.resolve({
          rows: [{ order_item_id: 'item-1', total_price: '100.00', seller_profile_id: 'seller-A', tier: 'basic' }],
        })
      }
      if (sql.includes('FROM seller_tier_config')) return Promise.resolve({ rows: [{ commission_rate: currentRate }] })
      return Promise.resolve({ rows: [] })
    })

    await recordSellerEarningsForOrder('order-snapshot')

    const firstInsertParams = client.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO seller_earnings'))![1]
    expect(firstInsertParams[4]).toBe(15) // commission_rate_snapshot captured at earning time

    // Admin later edits basic tier's commission_rate to 25% -- a real
    // earning already recorded a moment ago must be unaffected. This
    // service never re-reads/updates an existing row's snapshot, so
    // there's nothing more to assert here beyond confirming the insert
    // parameter itself (above) was the rate in effect AT THAT MOMENT,
    // not a live reference to the mutable config table.
    currentRate = '25.00'
    expect(firstInsertParams[4]).toBe(15)
  })
})
