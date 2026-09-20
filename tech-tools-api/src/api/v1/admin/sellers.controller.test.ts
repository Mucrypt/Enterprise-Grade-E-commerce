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

// A stateful mock PoolClient standing in for seller-lifecycle.service.ts's
// getClient() transactions. Tracks the profile row across the several
// short transactions a single controller action can now chain together
// (e.g. reactivate = setSellerAccountStatus, THEN setStoreStatus, each
// its own getClient() call) -- mockGetClient.mockResolvedValue(client)
// hands out this same object every time, so state carries across calls
// the way separate-but-sequential real transactions would observe it.
const makeLifecycleClient = (seedProfile: Record<string, any>) => {
  let profile = { ...seedProfile }
  const client = {
    query: jest.fn(async (sql: string, params: any[] = []) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FROM seller_verification_requests') && !sql.includes('UPDATE')) {
        return { rows: [] }
      }
      if (sql.includes('FROM seller_tier_config')) {
        return { rows: [{ tier: params[0], max_active_listings: 100, max_product_price: 2000, requires_id_verification: false }] }
      }
      if (sql.includes('FROM seller_profiles') && sql.includes('FOR UPDATE')) {
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('UPDATE seller_profiles') && sql.includes('account_status =')) {
        profile = { ...profile, account_status: params[0] }
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('UPDATE seller_profiles') && sql.includes('store_status =')) {
        profile = { ...profile, store_status: params[0] }
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('UPDATE seller_profiles') && sql.includes('onboarding_status =')) {
        profile = { ...profile, onboarding_status: params[0] }
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('UPDATE seller_profiles') && sql.includes('SET tier =')) {
        profile = { ...profile, tier: params[0], max_active_listings: params[1], max_product_price: params[2] }
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('INSERT INTO seller_profiles')) {
        profile = { ...profile, id: profile.id || 'sp-new' }
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('SELECT id FROM seller_profiles WHERE user_id')) {
        return { rows: [] }
      }
      if (sql.includes('INSERT INTO seller_audit_log') || sql.includes('UPDATE users')) {
        return { rows: [] }
      }
      return { rows: [{ ...profile }] }
    }),
    release: jest.fn(),
  }
  return { client, getProfile: () => profile }
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
            rows: [{ id: 'req-1', status: 'approved', user_id: 'user-1' }],
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
      body: { decisionReason: 'Already resolved' },
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await rejectSellerVerificationRequest(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('rejectSellerVerificationRequest requires a decisionReason', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'admin-1' },
      params: { requestId: 'req-1' },
      body: {},
    }
    const res = makeRes()

    await rejectSellerVerificationRequest(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockGetClient).not.toHaveBeenCalled()
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

  it('grantSellerAccess creates an ACTIVE, approved seller profile at the chosen tier and flips is_business_account', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'user-1' }] }
      if (sql.includes('FROM seller_profiles WHERE user_id = $1')) return { rows: [] }
      return { rows: [] }
    })
    const client = { query: jest.fn(), release: jest.fn() }
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
      if (sql.includes('SELECT id FROM seller_profiles WHERE user_id')) return { rows: [] }
      if (sql.includes('FROM seller_tier_config'))
        return { rows: [{ max_active_listings: 25, max_product_price: 500, requires_id_verification: false }] }
      if (sql.includes('INSERT INTO seller_profiles'))
        return { rows: [{ id: 'sp-new', tier: 'basic', verification_status: 'approved', account_status: 'ACTIVE' }] }
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { sellerProfile: expect.objectContaining({ account_status: 'ACTIVE', verification_status: 'approved' }) },
      }),
    )
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

  it('setSellerTier updates tier and limits from seller_tier_config, leaving verification_status/account_status completely untouched', async () => {
    const { client } = makeLifecycleClient({
      id: 'sp-1',
      user_id: 'user-1',
      tier: 'unverified',
      verification_status: 'pending',
      account_status: 'PENDING_REVIEW',
      is_suspended: false,
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

    // THE BUG FIX under test: a tier change touches tier + tier-derived
    // limits only -- 4 params, no verification/account-status column,
    // no adminId-as-approver param at all (unlike the old 6-param call
    // that also silently flipped verification_status to 'approved').
    const updateCall = client.query.mock.calls.find(
      (c: any[]) => c[0].includes('UPDATE seller_profiles') && c[0].includes('SET tier'),
    )
    expect(updateCall![0]).not.toMatch(/verification_status|account_status/)
    expect(updateCall![1]).toEqual(['pro', 100, 2000, 'sp-1'])

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          sellerProfile: expect.objectContaining({ tier: 'pro', verification_status: 'pending' }),
        }),
      }),
    )
    // Never touches users.is_business_account either -- that's exactly
    // the conflation this fix removes from the tier-change path.
    const usersUpdateCall = client.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE users'))
    expect(usersUpdateCall).toBeUndefined()
  })

  it('setSellerTier is a no-op (does not write) when the seller is already on the requested tier', async () => {
    const { client } = makeLifecycleClient({
      id: 'sp-1',
      user_id: 'user-1',
      tier: 'trusted',
      verification_status: 'suspended',
      account_status: 'SUSPENDED',
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

    const updateCall = client.query.mock.calls.find(
      (c: any[]) => c[0].includes('UPDATE seller_profiles') && c[0].includes('SET tier'),
    )
    expect(updateCall).toBeUndefined()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ noop: true }) }),
    )
  })

  it('reactivateSellerProfile rejects (409) a profile that is not currently suspended or restricted', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      if (sql.includes('FROM seller_profiles WHERE id = $1'))
        return { rows: [{ id: 'sp-1', account_status: 'ACTIVE' }] }
      return { rows: [] }
    })

    const req: any = { user: { userId: 'admin-1' }, params: { sellerProfileId: 'sp-1' } }
    const res = makeRes()

    await reactivateSellerProfile(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('reactivateSellerProfile clears suspension and restores access -- the missing inverse of suspend', async () => {
    const { client } = makeLifecycleClient({
      id: 'sp-1',
      user_id: 'user-1',
      account_status: 'SUSPENDED',
      store_status: 'SUSPENDED',
      terms_accepted: true,
    })
    mockGetClient.mockResolvedValue(client)
    mockQuery.mockImplementation(async (sql: string) => {
      if (mockRegclass(sql)) return { rows: [{ regclass: 'seller_verification_requests' }] }
      // evaluateStoreReadiness, called by reactivateSellerAccount before
      // deciding READY vs LIVE -- reads via the plain query() helper,
      // not the transactional client. Checked before the generic
      // "FROM seller_profiles WHERE id" branches below since its SELECT
      // list is a superset-distinguishing prefix.
      if (sql.includes('SELECT account_status, terms_accepted FROM seller_profiles'))
        return { rows: [{ account_status: 'ACTIVE', terms_accepted: true }] }
      // The controller's pre-check (`... LIMIT 1`) runs before the
      // service call; its post-reactivation reload (no `LIMIT 1`) runs
      // after -- same substring otherwise, so the more specific pattern
      // must be checked first.
      if (sql.includes('FROM seller_profiles WHERE id = $1 LIMIT 1'))
        return { rows: [{ id: 'sp-1', user_id: 'user-1', account_status: 'SUSPENDED' }] }
      if (sql.includes('FROM seller_profiles WHERE id = $1'))
        return {
          rows: [{ id: 'sp-1', is_suspended: false, is_active: true, verification_status: 'approved', account_status: 'ACTIVE' }],
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
        data: { sellerProfile: expect.objectContaining({ is_suspended: false, is_active: true, account_status: 'ACTIVE' }) },
      }),
    )
  })
})
