jest.mock('../database/connection', () => ({ query: jest.fn() }))

import { query } from '../database/connection'
import {
  resolveSellerCapabilities,
  evaluateStoreReadiness,
  evaluateLiveEligibility,
  computeOnboardingProgress,
} from './seller-lifecycle-query.service'

const mockQuery = query as jest.Mock

describe('seller-lifecycle-query.service -- resolveSellerCapabilities is 100% server-derived', () => {
  beforeEach(() => jest.clearAllMocks())

  // The function signature only accepts a userId -- there is no
  // parameter through which a caller could pass a claimed status,
  // capability, or role. This is the structural guarantee that "a
  // customer cannot obtain seller capabilities merely by changing
  // client state": the only way in is a database read.
  it('never grants any capability when the database has no seller_profiles row at all', async () => {
    mockQuery.mockResolvedValue({ rows: [{ is_business_account: true, has_creator_profile: false }] })

    const capabilities = await resolveSellerCapabilities('user-1')

    expect(capabilities.canAccessSellerCenter).toBe(false)
    expect(capabilities.canManageProducts).toBe(false)
    expect(capabilities.canPublishProducts).toBe(false)
    expect(capabilities.canReceiveOrders).toBe(false)
    expect(capabilities.canOpenStorefront).toBe(false)
    expect(capabilities.requiredNextAction).toBe('START_ONBOARDING')
  })

  it('grants full capabilities only when the DB row says account_status = ACTIVE', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'sp-1',
          is_business_account: true,
          has_creator_profile: true,
          account_status: 'ACTIVE',
          store_status: 'LIVE',
          onboarding_status: 'COMPLETED',
          verification_status: 'APPROVED',
          tier: 'trusted',
        },
      ],
    })

    const capabilities = await resolveSellerCapabilities('user-1')

    expect(capabilities.canAccessSellerCenter).toBe(true)
    expect(capabilities.canManageProducts).toBe(true)
    expect(capabilities.canPublishProducts).toBe(true)
    expect(capabilities.canReceiveOrders).toBe(true)
    expect(capabilities.canUseCreatorTools).toBe(true)
    expect(capabilities.canOpenStorefront).toBe(true)
    expect(capabilities.blockingReasons).toEqual([]);
  })

  it('a RESTRICTED account keeps building capabilities (dashboard, products, finances) but loses receive-orders/storefront', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'sp-1',
          is_business_account: true,
          has_creator_profile: false,
          account_status: 'RESTRICTED',
          store_status: 'PAUSED',
          onboarding_status: 'COMPLETED',
          verification_status: 'APPROVED',
          tier: 'basic',
        },
      ],
    })

    const capabilities = await resolveSellerCapabilities('user-1')

    expect(capabilities.canAccessSellerCenter).toBe(true)
    expect(capabilities.canManageProducts).toBe(true)
    expect(capabilities.canPublishProducts).toBe(true)
    expect(capabilities.canViewFinances).toBe(true)
    expect(capabilities.canReceiveOrders).toBe(false)
    expect(capabilities.canOpenStorefront).toBe(false)
    expect(capabilities.blockingReasons.length).toBeGreaterThan(0)
  })

  it('a SUSPENDED account loses every seller capability', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'sp-1',
          is_business_account: true,
          has_creator_profile: true,
          account_status: 'SUSPENDED',
          store_status: 'SUSPENDED',
          onboarding_status: 'COMPLETED',
          verification_status: 'APPROVED',
          tier: 'trusted',
        },
      ],
    })

    const capabilities = await resolveSellerCapabilities('user-1')

    expect(capabilities.canAccessSellerCenter).toBe(false)
    expect(capabilities.canManageProducts).toBe(false)
    expect(capabilities.canPublishProducts).toBe(false)
    expect(capabilities.canReceiveOrders).toBe(false)
    expect(capabilities.canUseCreatorTools).toBe(false)
    expect(capabilities.canOpenStorefront).toBe(false)
    expect(capabilities.requiredNextAction).toBe('CONTACT_SUPPORT')
  })

  it('an in-progress, unverified DRAFT seller still gets dashboard/build access -- verification only gates going public', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'sp-1',
          is_business_account: true,
          has_creator_profile: false,
          account_status: 'DRAFT',
          store_status: 'DRAFT',
          onboarding_status: 'IN_PROGRESS',
          verification_status: 'NOT_STARTED',
          tier: 'unverified',
        },
      ],
    })

    const capabilities = await resolveSellerCapabilities('user-1')

    expect(capabilities.canAccessSellerCenter).toBe(true)
    expect(capabilities.canManageProducts).toBe(true)
    expect(capabilities.canViewFinances).toBe(true)
    // Still correctly blocked from anything that requires real trust:
    expect(capabilities.canReceiveOrders).toBe(false)
    expect(capabilities.canOpenStorefront).toBe(false)
    expect(capabilities.requiredNextAction).toBe('COMPLETE_ONBOARDING')
  })

  it('a still-pending-review (submitted but not yet approved) seller can build; only the storefront stays gated', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'sp-1',
          is_business_account: true,
          has_creator_profile: false,
          account_status: 'PENDING_REVIEW',
          store_status: 'DRAFT',
          onboarding_status: 'SUBMITTED',
          verification_status: 'PENDING_REVIEW',
          tier: 'unverified',
        },
      ],
    })

    const capabilities = await resolveSellerCapabilities('user-1')

    expect(capabilities.canAccessSellerCenter).toBe(true)
    expect(capabilities.canManageProducts).toBe(true)
    expect(capabilities.canPublishProducts).toBe(true)
    expect(capabilities.canOpenStorefront).toBe(false)
    expect(capabilities.canReceiveOrders).toBe(false)
    expect(capabilities.requiredNextAction).toBe('AWAIT_REVIEW')
  })

  it('a REJECTED seller can still reach their dashboard to see why and resubmit', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'sp-1',
          is_business_account: true,
          has_creator_profile: false,
          account_status: 'REJECTED',
          store_status: 'DRAFT',
          onboarding_status: 'SUBMITTED',
          verification_status: 'REJECTED',
          tier: 'unverified',
        },
      ],
    })

    const capabilities = await resolveSellerCapabilities('user-1')

    expect(capabilities.canAccessSellerCenter).toBe(true)
    expect(capabilities.requiredNextAction).toBe('REVIEW_REJECTION')
  })
})

describe('seller-lifecycle-query.service -- evaluateStoreReadiness invents nothing', () => {
  beforeEach(() => jest.clearAllMocks())

  it('is ineligible with a real missing-requirement reason when terms are not accepted, even if ACTIVE', async () => {
    mockQuery.mockResolvedValue({ rows: [{ account_status: 'ACTIVE', terms_accepted: false }] })

    const readiness = await evaluateStoreReadiness('sp-1')

    expect(readiness.eligible).toBe(false)
    expect(readiness.missing).toContain('marketplace_terms_not_accepted')
    // No payouts/finance requirement is invented -- those systems don't
    // exist as real gates yet.
    expect(readiness.missing.some((m) => /payout|finance/i.test(m))).toBe(false)
  })

  it('is eligible once ACTIVE and terms are accepted -- nothing else required', async () => {
    mockQuery.mockResolvedValue({ rows: [{ account_status: 'ACTIVE', terms_accepted: true }] })

    const readiness = await evaluateStoreReadiness('sp-1')

    expect(readiness).toEqual({ eligible: true, missing: [] })
  })

  it('reports not-found rather than inventing eligibility for a nonexistent profile', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    const readiness = await evaluateStoreReadiness('sp-missing')

    expect(readiness.eligible).toBe(false)
    expect(readiness.missing).toContain('seller_profile_not_found')
  })
})

describe('seller-lifecycle-query.service -- evaluateLiveEligibility gates live shopping on tier, not just good standing', () => {
  beforeEach(() => jest.clearAllMocks())

  it('is ineligible below the trusted tier even when ACTIVE and terms accepted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ account_status: 'ACTIVE', terms_accepted: true, tier: 'basic' }] })

    const readiness = await evaluateLiveEligibility('sp-1')

    expect(readiness.eligible).toBe(false)
    expect(readiness.missing).toContain('seller_tier_too_low_for_live')
  })

  it('is eligible for a trusted-tier seller in good standing', async () => {
    mockQuery.mockResolvedValue({ rows: [{ account_status: 'ACTIVE', terms_accepted: true, tier: 'trusted' }] })

    const readiness = await evaluateLiveEligibility('sp-1')

    expect(readiness).toEqual({ eligible: true, missing: [] })
  })

  it('is eligible for a pro-tier seller in good standing', async () => {
    mockQuery.mockResolvedValue({ rows: [{ account_status: 'ACTIVE', terms_accepted: true, tier: 'pro' }] })

    const readiness = await evaluateLiveEligibility('sp-1')

    expect(readiness).toEqual({ eligible: true, missing: [] })
  })

  it('still requires ACTIVE account status regardless of tier', async () => {
    mockQuery.mockResolvedValue({ rows: [{ account_status: 'RESTRICTED', terms_accepted: true, tier: 'pro' }] })

    const readiness = await evaluateLiveEligibility('sp-1')

    expect(readiness.eligible).toBe(false)
    expect(readiness.missing).toContain('seller_account_must_be_active')
  })

  it('reports not-found rather than inventing eligibility for a nonexistent profile', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    const readiness = await evaluateLiveEligibility('sp-missing')

    expect(readiness.eligible).toBe(false)
    expect(readiness.missing).toContain('seller_profile_not_found')
  })
})

describe('seller-lifecycle-query.service -- computeOnboardingProgress never lets the frontend self-declare completion', () => {
  beforeEach(() => jest.clearAllMocks())

  it('canSubmit is false when documents/eligibility are missing, regardless of onboarding_status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ is_business_account: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'sp-1',
            seller_type: 'individual',
            seller_type_details: {},
            terms_accepted: true,
            onboarding_status: 'IN_PROGRESS',
            verification_status: 'NOT_STARTED',
            account_status: 'DRAFT',
            store_status: 'DRAFT',
            tier: 'unverified',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // evaluateSubmissionEligibility's document lookup -- no documents uploaded
      .mockResolvedValueOnce({ rows: [] }) // computeOnboardingProgress's own document lookup

    const progress = await computeOnboardingProgress('user-1')

    expect(progress.canSubmit).toBe(false)
    expect(progress.missingRequirements.length).toBeGreaterThan(0)
  })
})
