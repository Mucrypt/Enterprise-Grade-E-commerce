import { onboardSeller, requestSellerVerification } from './seller.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
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

  it('rejects onboarding for non-business customer', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT to_regclass($1) AS regclass')) {
        return { rows: [{ regclass: 'seller_profiles' }] }
      }

      if (sql.includes('SELECT id, user_type, is_business_account')) {
        return {
          rows: [
            {
              id: 'user-1',
              user_type: 'customer',
              is_business_account: false,
            },
          ],
        }
      }

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

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('creates verification request for onboarded seller', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT to_regclass($1) AS regclass')) {
        return { rows: [{ regclass: 'seller_profiles' }] }
      }

      if (sql.includes('SELECT * FROM seller_profiles WHERE user_id = $1')) {
        return {
          rows: [
            {
              id: 'sp-1',
              user_id: 'user-1',
              tier: 'unverified',
              is_suspended: false,
            },
          ],
        }
      }

      if (
        sql.includes('FROM seller_verification_requests') &&
        sql.includes("status = 'pending'")
      ) {
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO seller_verification_requests')) {
        return {
          rows: [
            {
              id: 'svr-1',
              seller_profile_id: 'sp-1',
              requested_tier: 'basic',
              status: 'pending',
            },
          ],
        }
      }

      return { rows: [] }
    })

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
      }),
    )
  })
})
