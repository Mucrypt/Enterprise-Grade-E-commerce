import { onboardSeller, requestSellerVerification } from './seller.controller'
import { query, getClient } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
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

// Every `tableExists()` check (ensureSellerInfrastructure, and
// account-mode-reconciliation.service.ts's own copy) goes through this
// exact SQL regardless of which table it's asking about -- a single
// always-true branch covers all of them, matching how the pre-existing
// test already did this.
const regclassBranch = (sql: string) =>
  sql.includes('SELECT to_regclass($1) AS regclass') ? { rows: [{ regclass: 'x' }] } : null

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('seller.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ENABLE_SELLER_TIERS = 'true'
  })

  it('onboarding auto-activates business mode for a non-business customer instead of rejecting them', async () => {
    // THE BEHAVIOR CHANGE under test: starting onboarding IS the
    // business-mode-activation event now -- there is no longer a
    // separate precondition a customer can fail here. This closes the
    // gap where a user could end up with is_business_account=true and a
    // creator_profiles row but no seller_profiles row (or vice versa)
    // depending on which endpoint they called first.
    mockQuery.mockImplementation(async (sql: string) => {
      const regclass = regclassBranch(sql)
      if (regclass) return regclass

      if (sql.includes('SELECT id, user_type, is_business_account'))
        return { rows: [{ id: 'user-1', user_type: 'customer', is_business_account: false }] }

      // ensureBusinessModeActivated
      if (sql.includes('SELECT is_business_account FROM users WHERE id = $1'))
        return { rows: [{ is_business_account: false }] }
      if (sql.includes('UPDATE users') && sql.includes('is_business_account = true')) return { rows: [] }
      if (sql.includes('INSERT INTO user_business_mode_audit')) return { rows: [] }

      // ensureCreatorProfileForUser
      if (sql.includes('FROM creator_profiles WHERE user_id = $1')) return { rows: [] }
      if (sql.includes('SELECT email, first_name, last_name FROM users'))
        return { rows: [{ email: 'a@b.com', first_name: 'A', last_name: 'B' }] }
      if (sql.includes('SELECT id FROM creator_profiles WHERE handle = $1')) return { rows: [] }
      if (sql.includes('INSERT INTO creator_profiles'))
        return { rows: [{ id: 'cp-1', user_id: 'user-1', handle: 'a-b', display_name: 'A B', verification_status: 'pending', is_public: true }] }

      // onboardSeller itself
      if (sql.includes('SELECT * FROM seller_profiles WHERE user_id = $1')) return { rows: [] }
      if (sql.includes('FROM seller_tier_config'))
        return { rows: [{ max_active_listings: 5, max_product_price: 99.99 }] }
      if (sql.includes('INSERT INTO seller_profiles'))
        return { rows: [{ id: 'sp-1', user_id: 'user-1', tier: 'unverified', verification_status: 'none', account_status: 'DRAFT', onboarding_status: 'IN_PROGRESS' }] }
      if (sql.includes('INSERT INTO seller_audit_log')) return { rows: [] }

      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'user-1' },
      body: { termsAccepted: true },
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await onboardSeller(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    const businessModeUpdate = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes('UPDATE users') && c[0].includes('is_business_account = true'),
    )
    expect(businessModeUpdate).toBeDefined()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { sellerProfile: expect.objectContaining({ onboarding_status: 'IN_PROGRESS' }) },
      }),
    )
  })

  it('blocks editing an onboarding application that has already been submitted and is under review', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      const regclass = regclassBranch(sql)
      if (regclass) return regclass

      if (sql.includes('SELECT id, user_type, is_business_account'))
        return { rows: [{ id: 'user-1', user_type: 'customer', is_business_account: true }] }
      if (sql.includes('SELECT * FROM seller_profiles WHERE user_id = $1'))
        return { rows: [{ id: 'sp-1', onboarding_status: 'SUBMITTED', account_status: 'PENDING_REVIEW' }] }

      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'user-1' },
      body: { displayName: 'New name' },
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await onboardSeller(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('creates verification request for onboarded seller', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      const regclass = regclassBranch(sql)
      if (regclass) return regclass

      if (sql.includes('SELECT * FROM seller_profiles WHERE user_id = $1')) {
        return {
          rows: [
            {
              id: 'sp-1',
              user_id: 'user-1',
              tier: 'unverified',
              is_suspended: false,
              account_status: 'DRAFT',
            },
          ],
        }
      }

      return { rows: [] }
    })

    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.trim().startsWith('SELECT * FROM seller_profiles WHERE id = $1'))
          return {
            rows: [
              {
                id: 'sp-1',
                user_id: 'user-1',
                tier: 'unverified',
                account_status: 'DRAFT',
                onboarding_status: 'IN_PROGRESS',
              },
            ],
          }
        if (sql.includes('FROM seller_verification_requests') && sql.includes("status IN ('pending'"))
          return { rows: [] }
        if (sql.includes('INSERT INTO seller_verification_requests'))
          return { rows: [{ id: 'svr-1', seller_profile_id: 'sp-1', requested_tier: 'basic', status: 'pending' }] }
        if (sql.includes('UPDATE seller_profiles') && sql.includes("verification_status = 'pending'"))
          return { rows: [] }
        if (sql.includes('UPDATE seller_profiles') && sql.includes('onboarding_status ='))
          return { rows: [{ id: 'sp-1', onboarding_status: 'SUBMITTED' }] }
        if (sql.includes('INSERT INTO seller_audit_log')) return { rows: [] }
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    mockGetClient.mockResolvedValue(client)

    const req: any = {
      user: { userId: 'user-1' },
      body: {
        requestedTier: 'basic',
      },
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await requestSellerVerification(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { request: expect.objectContaining({ id: 'svr-1', status: 'pending' }) },
      }),
    )
  })

  it('requestSellerVerification rejects a suspended seller', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      const regclass = regclassBranch(sql)
      if (regclass) return regclass
      if (sql.includes('SELECT * FROM seller_profiles WHERE user_id = $1'))
        return { rows: [{ id: 'sp-1', user_id: 'user-1', account_status: 'SUSPENDED', is_suspended: true }] }
      return { rows: [] }
    })

    const req: any = { user: { userId: 'user-1' }, body: { requestedTier: 'basic' }, headers: {}, ip: '127.0.0.1' }
    const res = makeRes()

    await requestSellerVerification(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockGetClient).not.toHaveBeenCalled()
  })
})
