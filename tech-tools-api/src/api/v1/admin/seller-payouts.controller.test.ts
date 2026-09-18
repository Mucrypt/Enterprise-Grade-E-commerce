import { recordSellerPayoutBatch } from './seller-payouts.controller'
import { getClient } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn(), getClient: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockGetClient = getClient as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const makeClient = () => ({ query: jest.fn(), release: jest.fn() })

const SELLER_ID = 'seller-profile-1'
const ADMIN_ID = 'admin-user-1'

describe('recordSellerPayoutBatch -- real money, must reject on any mismatch', () => {
  beforeEach(() => jest.clearAllMocks())

  it('400s with no earningIds selected', async () => {
    const req: any = { params: { sellerProfileId: SELLER_ID }, body: { amount: 10 }, user: { userId: ADMIN_ID } }
    const res = makeRes()

    await recordSellerPayoutBatch(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('400s with a non-positive amount', async () => {
    const req: any = {
      params: { sellerProfileId: SELLER_ID },
      body: { amount: 0, earningIds: ['e1'] },
      user: { userId: ADMIN_ID },
    }
    const res = makeRes()

    await recordSellerPayoutBatch(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('rejects (409) when a selected earning is no longer eligible -- e.g. concurrently clawed back by the queue between the eligibility fetch and this request', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return Promise.resolve()
      // Only one of the two requested rows still qualifies -- simulates
      // the other having been paid/clawed-back concurrently.
      if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ id: 'e1', seller_net_amount: '10.00' }] })
      return Promise.resolve({ rows: [] })
    })

    const req: any = {
      params: { sellerProfileId: SELLER_ID },
      body: { amount: 25, earningIds: ['e1', 'e2'] },
      user: { userId: ADMIN_ID },
    }
    const res = makeRes()

    await recordSellerPayoutBatch(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.query).not.toHaveBeenCalledWith('COMMIT')
  })

  it('400s when the given amount does not match the selected earnings total, even if all rows are individually eligible', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return Promise.resolve()
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({
          rows: [
            { id: 'e1', seller_net_amount: '10.00' },
            { id: 'e2', seller_net_amount: '15.00' },
          ],
        })
      }
      return Promise.resolve({ rows: [] })
    })

    const req: any = {
      params: { sellerProfileId: SELLER_ID },
      // Real total is 25.00 -- admin's form submitted a stale/typo'd 20.
      body: { amount: 20, earningIds: ['e1', 'e2'] },
      user: { userId: ADMIN_ID },
    }
    const res = makeRes()

    await recordSellerPayoutBatch(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
  })

  it('cannot mix another seller\'s earning IDs into a batch -- the ownership-scoped SELECT simply won\'t return them, tripping the same row-count mismatch as a clawed-back row', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return Promise.resolve()
      if (sql.includes('FOR UPDATE')) {
        // 'other-sellers-earning' belongs to a different seller_profile_id
        // -- the WHERE seller_profile_id = $2 clause excludes it entirely.
        return Promise.resolve({ rows: [{ id: 'e1', seller_net_amount: '10.00' }] })
      }
      return Promise.resolve({ rows: [] })
    })

    const req: any = {
      params: { sellerProfileId: SELLER_ID },
      body: { amount: 10, earningIds: ['e1', 'other-sellers-earning'] },
      user: { userId: ADMIN_ID },
    }
    const res = makeRes()

    await recordSellerPayoutBatch(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('succeeds when the selected earnings are all eligible and the amount matches exactly -- inserts a batch, flips earnings to paid, and records a negative ledger row', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return Promise.resolve()
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({ rows: [{ id: 'e1', seller_net_amount: '10.00' }] })
      }
      if (sql.includes('INSERT INTO seller_payout_batches')) {
        return Promise.resolve({ rows: [{ id: 'batch-1', total_amount: '10.00' }] })
      }
      return Promise.resolve({ rows: [] })
    })

    const req: any = {
      params: { sellerProfileId: SELLER_ID },
      body: { amount: 10, payoutMethod: 'bank_transfer', payoutReference: 'REF123', earningIds: ['e1'] },
      user: { userId: ADMIN_ID },
    }
    const res = makeRes()

    await recordSellerPayoutBatch(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(client.query).toHaveBeenCalledWith('COMMIT')

    const earningsUpdateCall = client.query.mock.calls.find((c: any[]) => c[0].includes("status = 'paid'"))
    expect(earningsUpdateCall![1]).toEqual(['batch-1', ['e1']])

    const ledgerCall = client.query.mock.calls.find((c: any[]) => c[0].includes('payout_sent'))
    expect(ledgerCall![1]).toEqual([SELLER_ID, -10, 'batch-1'])
  })
})
