import {
  getAllSellers,
  getSellerDetail,
  getSellerVerificationQueue,
  grantSellerAccess,
  reactivateSellerProfile,
  rejectSellerVerificationRequest,
  setSellerTier,
} from './sellers.controller'
import { getClient, query } from '../../../database/connection'
import { getSellerEarningsSummary } from '../../../services/seller-payout.service'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))

jest.mock('../../../services/seller-payout.service', () => ({
  getSellerEarningsSummary: jest.fn(),
}))

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

const mockQuery = query as jest.Mock
const mockGetClient = getClient as jest.Mock
const mockGetSellerEarningsSummary = getSellerEarningsSummary as jest.Mock

const mockRegclass = (sql: string) => sql.includes('SELECT to_regclass($1) AS regclass')

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('admin sellers controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ENABLE_SELLER_TIERS = 'true'
  })

  it('returns queue items for pending moderation', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT to_regclass($1) AS regclass')) {
        return { rows: [{ regclass: 'seller_verification_requests' }] }
      }

      if (sql.includes('FROM seller_verification_requests svr')) {
        return {
          rows: [{ id: 'req-1', status: 'pending' }],
        }
      }

      if (sql.includes('SELECT COUNT(*)::int AS total')) {
        return { rows: [{ total: 1 }] }
      }

      return { rows: [] }
    })

    const req: any = { query: {} }
    const res = makeRes()

    await getSellerVerificationQueue(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    )
  })

  it('rejects non-pending requests when admin tries to reject', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') {
          return { rows: [] }
        }

        if (
          sql.includes('SELECT *') &&
          sql.includes('seller_verification_requests')
        ) {
          return {
            rows: [{ id: 'req-1', status: 'approved' }],
          }
        }

        return { rows: [] }
      }),
      release: jest.fn(),
    }

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT to_regclass($1) AS regclass')) {
        return { rows: [{ regclass: 'seller_verification_requests' }] }
      }

      return { rows: [] }
    })

    mockGetClient.mockResolvedValue(client)

    const req: any = {
      user: { userId: 'admin-1' },
      params: { requestId: 'req-1' },
      body: {},
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await rejectSellerVerificationRequest(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('getAllSellers returns a searchable, filterable list of every seller (not just the pending queue)', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM seller_profiles sp') && sql.includes('INNER JOIN users u') && sql.includes('LIMIT'))
        return { rows: [{ id: 'sp-1', tier: 'basic' }] }
      if (sql.includes('SELECT COUNT(*)::int AS total')) return { rows: [{ total: 1 }] }
      return { rows: [] }
    })

    const req: any = { query: { search: 'jane' } }
    const res = makeRes()

    await getAllSellers(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ items: [{ id: 'sp-1', tier: 'basic' }] }),
      }),
    )
  })

  it('getSellerDetail degrades gracefully when the earnings summary lookup fails (e.g. payouts infra not migrated yet)', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM seller_profiles sp') && sql.includes('WHERE sp.id = $1'))
        return { rows: [{ id: 'sp-1', user_id: 'user-1' }] }
      if (sql.includes('FROM seller_verification_requests') && sql.includes('WHERE seller_profile_id'))
        return { rows: [] }
      if (sql.includes('FROM products')) return { rows: [{ count: 2 }] }
      if (sql.includes('FROM discover_posts')) return { rows: [{ count: 3 }] }
      return { rows: [] }
    })
    mockGetSellerEarningsSummary.mockRejectedValue(new Error('seller_earnings does not exist'))

    const req: any = { params: { sellerProfileId: 'sp-1' } }
    const res = makeRes()

    await getSellerDetail(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          storeProductCount: 2,
          discoverPostCount: 3,
          earningsSummary: null,
        }),
      }),
    )
  })

  it('grantSellerAccess rejects (409) a user who already has a seller profile', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'user-1' }] }
      if (sql.includes('FROM seller_profiles WHERE user_id = $1'))
        return { rows: [{ id: 'existing-sp' }] }
      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'admin-1' },
      body: { userId: 'user-1', tier: 'basic' },
    }
    const res = makeRes()

    await grantSellerAccess(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('grantSellerAccess creates an approved seller profile at the chosen tier and flips is_business_account', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'user-1' }] }
      if (sql.includes('FROM seller_profiles WHERE user_id = $1')) return { rows: [] }
      if (sql.includes('FROM seller_tier_config'))
        return { rows: [{ max_active_listings: 25, max_product_price: 500 }] }
      return { rows: [] }
    })
    const client = { query: jest.fn(), release: jest.fn() }
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
      if (sql.includes('INSERT INTO seller_profiles'))
        return { rows: [{ id: 'sp-new', tier: 'basic', verification_status: 'approved' }] }
      return { rows: [] }
    })
    mockGetClient.mockResolvedValue(client)

    const req: any = {
      user: { userId: 'admin-1' },
      body: { userId: 'user-1', tier: 'basic' },
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await grantSellerAccess(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    const insertCall = client.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO seller_profiles'))
    expect(insertCall![1]).toEqual(['user-1', 'basic', 25, 500, 'admin-1'])
  })

  it('setSellerTier rejects an invalid tier with 400 before touching the database', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      return { rows: [] }
    })

    const req: any = { user: { userId: 'admin-1' }, params: { sellerProfileId: 'sp-1' }, body: { tier: 'legendary' } }
    const res = makeRes()

    await setSellerTier(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('setSellerTier updates tier and limits from seller_tier_config directly, and approves a seller left dangling in "pending" from an earlier self-submitted request', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM seller_profiles sp') && sql.includes('WHERE sp.id = $1'))
        return {
          rows: [
            {
              id: 'sp-1',
              user_id: 'user-1',
              tier: 'unverified',
              verification_status: 'pending',
              is_suspended: false,
              is_business_account: true,
            },
          ],
        }
      if (sql.includes('FROM seller_tier_config'))
        return { rows: [{ max_active_listings: 100, max_product_price: 2000 }] }
      return { rows: [] }
    })
    const client = { query: jest.fn(), release: jest.fn() }
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
      if (sql.includes('UPDATE seller_profiles'))
        return { rows: [{ id: 'sp-1', tier: 'pro', verification_status: 'approved' }] }
      return { rows: [] }
    })
    mockGetClient.mockResolvedValue(client)

    const req: any = {
      user: { userId: 'admin-1' },
      params: { sellerProfileId: 'sp-1' },
      body: { tier: 'pro' },
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await setSellerTier(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { sellerProfile: { id: 'sp-1', tier: 'pro', verification_status: 'approved' } },
      }),
    )
    // Never silently reactivates a business account that was already true --
    // no spurious UPDATE users call for the already-business-account case.
    const usersUpdateCall = client.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE users'))
    expect(usersUpdateCall).toBeUndefined()
  })

  it('setSellerTier does not silently un-suspend a seller -- verification_status is left untouched while suspended', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM seller_profiles sp') && sql.includes('WHERE sp.id = $1'))
        return {
          rows: [
            {
              id: 'sp-1',
              user_id: 'user-1',
              tier: 'basic',
              verification_status: 'suspended',
              is_suspended: true,
              is_business_account: true,
            },
          ],
        }
      if (sql.includes('FROM seller_tier_config'))
        return { rows: [{ max_active_listings: 10, max_product_price: 100 }] }
      return { rows: [] }
    })
    const client = { query: jest.fn(), release: jest.fn() }
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
      if (sql.includes('UPDATE seller_profiles'))
        return { rows: [{ id: 'sp-1', tier: 'trusted', verification_status: 'suspended' }] }
      return { rows: [] }
    })
    mockGetClient.mockResolvedValue(client)

    const req: any = {
      user: { userId: 'admin-1' },
      params: { sellerProfileId: 'sp-1' },
      body: { tier: 'trusted' },
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await setSellerTier(req, res)

    const updateCall = client.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE seller_profiles'))
    expect(updateCall![1]).toEqual(['trusted', 10, 100, true, 'admin-1', 'sp-1'])
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sellerProfile: { id: 'sp-1', tier: 'trusted', verification_status: 'suspended' } } }),
    )
  })

  it('reactivateSellerProfile rejects (409) a profile that is not currently suspended', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM seller_profiles WHERE id = $1'))
        return { rows: [{ id: 'sp-1', is_suspended: false }] }
      return { rows: [] }
    })

    const req: any = { user: { userId: 'admin-1' }, params: { sellerProfileId: 'sp-1' } }
    const res = makeRes()

    await reactivateSellerProfile(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('reactivateSellerProfile clears suspension and restores approved access -- the missing inverse of suspend', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM seller_profiles WHERE id = $1'))
        return { rows: [{ id: 'sp-1', user_id: 'user-1', is_suspended: true }] }
      if (sql.includes('UPDATE seller_profiles'))
        return {
          rows: [{ id: 'sp-1', is_suspended: false, is_active: true, verification_status: 'approved' }],
        }
      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'admin-1' },
      params: { sellerProfileId: 'sp-1' },
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await reactivateSellerProfile(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { sellerProfile: { id: 'sp-1', is_suspended: false, is_active: true, verification_status: 'approved' } },
      }),
    )
  })
})
