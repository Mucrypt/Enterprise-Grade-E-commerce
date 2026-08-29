import { resolveAffiliateForCheckout } from './affiliate.service'
import { query } from '../database/connection'

jest.mock('../database/connection', () => ({ query: jest.fn() }))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock

const SETTINGS_ROW = {
  commission_rate_percent: '10.00',
  hold_period_days: 14,
  fallback_hold_period_days: 30,
  min_payout_amount: '0.00',
  program_enabled: true,
}

const AFFILIATE_ROW = {
  affiliate_id: 'affiliate-uuid-1',
  owner_user_id: 'owner-user-uuid',
  owner_email: 'affiliate@example.com',
}

// The settings query and the affiliate-lookup query are both routed
// through the same mocked `query()` -- dispatch on the SQL text instead
// of call order, since getAffiliateSettings() has its own short-lived
// in-memory cache that can make call counts vary between tests.
function mockQueryImplementation(overrides: { affiliateRow?: any } = {}) {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('affiliate_settings')) {
      return Promise.resolve({ rows: [SETTINGS_ROW] })
    }
    if (sql.includes('affiliate_profiles')) {
      const row = 'affiliateRow' in overrides ? overrides.affiliateRow : AFFILIATE_ROW
      return Promise.resolve({ rows: row ? [row] : [] })
    }
    return Promise.resolve({ rows: [] })
  })
}

describe('resolveAffiliateForCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Settings cache is module-level state -- reset it between tests by
    // re-requiring isn't practical here, so each test uses a fresh
    // referralCode-independent settings row that's stable across the suite.
  })

  it('returns null when no referral code is provided', async () => {
    mockQueryImplementation()
    const result = await resolveAffiliateForCheckout(undefined, 'buyer@example.com', 'buyer-uuid')
    expect(result).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null for an unknown or inactive referral code', async () => {
    mockQueryImplementation({ affiliateRow: null })
    const result = await resolveAffiliateForCheckout('DOESNOTEXIST', 'buyer@example.com', 'buyer-uuid')
    expect(result).toBeNull()
  })

  it('blocks an authenticated self-referral (matching user id)', async () => {
    mockQueryImplementation()
    const result = await resolveAffiliateForCheckout(
      'ROMEO4F9K',
      'someone-else@example.com',
      'owner-user-uuid', // same as AFFILIATE_ROW.owner_user_id
    )
    expect(result).toBeNull()
  })

  it('blocks a guest self-referral via a case-insensitive email match', async () => {
    mockQueryImplementation()
    const result = await resolveAffiliateForCheckout(
      'ROMEO4F9K',
      'AFFILIATE@EXAMPLE.COM', // same as AFFILIATE_ROW.owner_email, different case
      undefined,
    )
    expect(result).toBeNull()
  })

  it('attributes a genuine, non-self referral', async () => {
    mockQueryImplementation()
    const result = await resolveAffiliateForCheckout(
      'ROMEO4F9K',
      'genuine-buyer@example.com',
      'a-different-user-uuid',
    )
    expect(result).toBe('affiliate-uuid-1')
  })

  it('never throws -- a DB error resolves to null instead of breaking checkout', async () => {
    mockQuery.mockImplementation(() => Promise.reject(new Error('connection lost')))
    const result = await resolveAffiliateForCheckout('ANYCODE', 'buyer@example.com', 'buyer-uuid')
    expect(result).toBeNull()
  })
})
