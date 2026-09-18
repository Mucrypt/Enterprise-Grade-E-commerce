// The affiliate queue this mirrors (affiliate-commission.queue.ts) has no
// test file at all -- worth doing here anyway since this is a money
// feature. Tests call the module's internal tick logic indirectly via
// its exported start function is impractical (setInterval-based), so
// these test the three query-producing steps by re-requiring the module
// fresh per test and driving processQueueTick indirectly through
// startSellerPayoutCommissionWorker's immediate first-tick call, then
// stopping it immediately after to avoid a real timer leaking between
// tests.

jest.mock('../database/connection', () => ({ query: jest.fn() }))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('./notification.service', () => ({
  NotificationService: { create: jest.fn().mockResolvedValue(undefined) },
}))
jest.mock('./seller-payout.service', () => ({
  isSellerPayoutsEnabled: jest.fn().mockResolvedValue(true),
  getSellerPayoutSettings: jest.fn().mockResolvedValue({
    fallbackHoldPeriodDays: 30,
    minPayoutAmount: 0,
    programEnabled: true,
  }),
}))

function loadQueueFresh() {
  jest.resetModules()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const queue = require('./seller-payout-commission.queue') as typeof import('./seller-payout-commission.queue')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const connection = require('../database/connection')
  return { ...queue, mockQuery: connection.query as jest.Mock }
}

// Fires the worker's very first, immediate tick (startSellerPayoutCommissionWorker
// calls processQueueTick() once synchronously-scheduled before the
// setInterval), then stops the worker so no real timer survives the test.
async function runOneTick(queue: ReturnType<typeof loadQueueFresh>) {
  queue.startSellerPayoutCommissionWorker()
  // The first tick is fired via `void processQueueTick()` -- flush microtasks.
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
  queue.stopSellerPayoutCommissionWorker()
}

describe('seller-payout-commission.queue -- confirm eligible earnings', () => {
  beforeEach(() => {
    process.env.SELLER_PAYOUT_QUEUE_ENABLED = 'true'
  })

  it('confirms a pending earning whose order is delivered and past its tier hold period', async () => {
    const queue = loadQueueFresh()
    queue.mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM seller_earnings se') && sql.includes("status = 'pending'")) {
        return Promise.resolve({
          rows: [{ id: 'earning-1', seller_net_amount: '42.50', seller_user_id: 'user-1' }],
        })
      }
      return Promise.resolve({ rows: [] })
    })

    await runOneTick(queue)

    const updateCall = queue.mockQuery.mock.calls.find((c: any[]) =>
      c[0].includes("UPDATE seller_earnings SET status = 'confirmed'"),
    )
    expect(updateCall![1]).toEqual(['earning-1'])

    const ledgerCall = queue.mockQuery.mock.calls.find((c: any[]) => c[0].includes('earning_confirmed'))
    expect(ledgerCall![1]).toEqual(['earning-1', '42.50'])
  })

  it('confirms a never-delivered order once the fallback hold period has elapsed (the eligibility query itself encodes this -- confirmed by the query text and its bound parameter, since a real DB round-trip is out of scope for a unit test)', async () => {
    const queue = loadQueueFresh()
    let capturedSql = ''
    let capturedParams: any[] | undefined
    queue.mockQuery.mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('FROM seller_earnings se') && sql.includes("status = 'pending'")) {
        capturedSql = sql
        capturedParams = params
      }
      return Promise.resolve({ rows: [] })
    })

    await runOneTick(queue)

    expect(capturedSql).toContain("o.order_status = 'delivered'")
    expect(capturedSql).toContain('payout_hold_period_days')
    expect(capturedSql).toContain("o.order_status != 'delivered'")
    // fallback_hold_period_days is read from settings and passed as a
    // real bound parameter ($1), not interpolated into the SQL text.
    expect(capturedParams).toEqual([30])
  })
})

describe('seller-payout-commission.queue -- clawback', () => {
  beforeEach(() => {
    process.env.SELLER_PAYOUT_QUEUE_ENABLED = 'true'
  })

  it('claws back a confirmed earning refunded after confirmation -- flips status to cancelled and inserts a negative ledger row', async () => {
    const queue = loadQueueFresh()
    queue.mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("status IN ('confirmed', 'paid')")) {
        return Promise.resolve({
          rows: [{ id: 'earning-2', seller_net_amount: '10.00', status: 'confirmed', seller_profile_id: 'seller-A' }],
        })
      }
      return Promise.resolve({ rows: [] })
    })

    await runOneTick(queue)

    const cancelCall = queue.mockQuery.mock.calls.find((c: any[]) => c[0].includes("status = 'cancelled'"))
    expect(cancelCall![1]).toEqual(['earning-2'])

    const ledgerCall = queue.mockQuery.mock.calls.find((c: any[]) => c[0].includes('earning_clawback'))
    expect(ledgerCall![1]).toEqual(['seller-A', -10, 'earning-2'])
  })

  it('claws back an already-paid earning WITHOUT changing its status -- stamps clawed_back_at instead, since real bank-transfer money already left the business (the one deliberate deviation from the affiliate precedent)', async () => {
    const queue = loadQueueFresh()
    queue.mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("status IN ('confirmed', 'paid')")) {
        return Promise.resolve({
          rows: [{ id: 'earning-3', seller_net_amount: '99.00', status: 'paid', seller_profile_id: 'seller-B' }],
        })
      }
      return Promise.resolve({ rows: [] })
    })

    await runOneTick(queue)

    // Must NOT have run the status='cancelled' update for this row.
    const cancelCall = queue.mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes("status = 'cancelled'") && c[1]?.[0] === 'earning-3',
    )
    expect(cancelCall).toBeUndefined()

    // Must have stamped clawed_back_at instead.
    const clawedBackCall = queue.mockQuery.mock.calls.find((c: any[]) => c[0].includes('clawed_back_at = NOW()'))
    expect(clawedBackCall![1]).toEqual(['earning-3'])

    // The negative ledger row still gets inserted regardless -- the
    // seller's live balance still needs to reflect the clawback even
    // though the earning's own status is frozen at 'paid'.
    const ledgerCall = queue.mockQuery.mock.calls.find((c: any[]) => c[0].includes('earning_clawback'))
    expect(ledgerCall![1]).toEqual(['seller-B', -99, 'earning-3'])
  })
})

describe('seller-payout-commission.queue -- cancel pending refunded orders', () => {
  beforeEach(() => {
    process.env.SELLER_PAYOUT_QUEUE_ENABLED = 'true'
  })

  it('cancels pending earnings refunded before ever confirming, with no ledger row', async () => {
    const queue = loadQueueFresh()
    queue.mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('order_refunded_before_confirmation')) {
        return Promise.resolve({ rows: [{ id: 'earning-4' }] })
      }
      return Promise.resolve({ rows: [] })
    })

    await runOneTick(queue)

    const ledgerCall = queue.mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO seller_payout_ledger'))
    expect(ledgerCall).toBeUndefined()
  })
})

describe('seller-payout-commission.queue -- disabled states', () => {
  it('does nothing when isSellerPayoutsEnabled() resolves false', async () => {
    jest.resetModules()
    jest.doMock('./seller-payout.service', () => ({
      isSellerPayoutsEnabled: jest.fn().mockResolvedValue(false),
      getSellerPayoutSettings: jest.fn().mockResolvedValue({ fallbackHoldPeriodDays: 30 }),
    }))
    process.env.SELLER_PAYOUT_QUEUE_ENABLED = 'true'
    const queue = loadQueueFresh()
    await runOneTick(queue)
    expect(queue.mockQuery).not.toHaveBeenCalled()
  })

  it('does not start at all when SELLER_PAYOUT_QUEUE_ENABLED=false', async () => {
    process.env.SELLER_PAYOUT_QUEUE_ENABLED = 'false'
    const queue = loadQueueFresh()
    await runOneTick(queue)
    expect(queue.mockQuery).not.toHaveBeenCalled()
  })
})
