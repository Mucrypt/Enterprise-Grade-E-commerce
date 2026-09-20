jest.mock('../database/connection', () => ({ query: jest.fn(), getClient: jest.fn() }))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('./notification.service', () => ({
  NotificationService: { create: jest.fn().mockResolvedValue(undefined) },
}))
jest.mock('./seller-lifecycle-query.service', () => ({
  evaluateStoreReadiness: jest.fn(),
}))

import { getClient } from '../database/connection'
import { NotificationService } from './notification.service'
import {
  setSellerAccountStatus,
  approveVerification,
  rejectVerification,
  setSellerTier,
  submitSellerApplication,
  IllegalTransitionError,
  SelfApprovalError,
} from './seller-lifecycle.service'

const mockGetClient = getClient as jest.Mock
const mockNotificationCreate = NotificationService.create as jest.Mock

// A stateful mock client -- tracks a single seller_profiles row across
// the several sequential queries one lifecycle operation issues, and
// answers seller_verification_requests / seller_tier_config lookups by
// simple SQL-substring matching. Kept generic and reused across tests
// rather than hand-rolled per test, since every function under test
// shares the same BEGIN / SELECT ... FOR UPDATE / UPDATE / audit-log /
// COMMIT shape.
//
// `document`, when provided, simulates a real seller_verification_documents
// row's {review_status, malware_scan_status}. The mock does NOT simply
// return that row whenever asked -- it checks whether the REAL SQL text
// actually constrains on review_status/malware_scan_status the way a
// real Postgres WHERE clause would, and only "matches" the document if
// every constraint present in the query text is satisfied. This means a
// future regression that weakens the query (e.g. drops the
// malware_scan_status clause) shows up as a newly-passing document in
// these tests, not a silently-still-passing one.
function makeClient(options: {
  profile?: Record<string, any>
  request?: Record<string, any>
  tierConfig?: Record<string, any>
  document?: { review_status: string; malware_scan_status: string } | null
}) {
  const profile = { ...options.profile }
  const request = options.request ? { ...options.request } : null
  const tierConfig = options.tierConfig || { max_active_listings: 10, max_product_price: 100, requires_id_verification: false }
  const document = options.document ?? null

  const client = {
    query: jest.fn(async (sql: string, params: any[] = []) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }

      if (sql.includes('FROM seller_verification_requests svr') && sql.includes('FOR UPDATE OF svr')) {
        return request ? { rows: [{ ...request, current_tier: profile.tier, current_account_status: profile.account_status }] } : { rows: [] }
      }
      if (sql.trim().startsWith('SELECT * FROM seller_verification_requests WHERE id = $1')) {
        return request ? { rows: [{ ...request }] } : { rows: [] }
      }
      if (sql.includes('WHERE seller_profile_id = $1 AND status IN')) {
        // submitSellerApplication's existingCase lookup
        const isNonTerminal = request && ['PENDING', 'MORE_INFORMATION_REQUIRED'].includes(request.status)
        return isNonTerminal ? { rows: [{ ...request }] } : { rows: [] }
      }
      if (sql.includes('FROM seller_verification_documents')) {
        if (!document) return { rows: [] }
        const requiresAccepted = sql.includes("review_status = 'accepted'")
        const requiresClean = sql.includes("malware_scan_status = 'clean'")
        const matches =
          (!requiresAccepted || document.review_status === 'accepted') &&
          (!requiresClean || document.malware_scan_status === 'clean')
        return { rows: matches ? [{ id: 'doc-1' }] : [] }
      }
      if (sql.includes('UPDATE seller_verification_requests') && sql.includes("status = 'SUPERSEDED'")) {
        // supersede-others statement
        return { rows: [] }
      }
      if (sql.trim().startsWith('INSERT INTO seller_verification_requests')) {
        const inserted = {
          id: 'req-new',
          user_id: params[0],
          seller_profile_id: params[1],
          requested_tier: params[2],
          status: 'PENDING',
          case_type: params[3],
        }
        if (request) Object.assign(request, inserted)
        return { rows: [inserted] }
      }
      if (sql.trim().startsWith('UPDATE seller_verification_requests')) {
        if (request) Object.assign(request, { status: params.includes('APPROVED') ? 'APPROVED' : request.status })
        return { rows: [{ ...request, id: request?.id }] }
      }
      if (sql.includes('FROM seller_tier_config')) {
        return { rows: [{ ...tierConfig, tier: params[0] }] }
      }
      if (sql.trim().startsWith('SELECT * FROM seller_profiles WHERE id = $1')) {
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('UPDATE seller_profiles') && sql.includes('account_status =')) {
        Object.assign(profile, { account_status: params[0] })
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('UPDATE seller_profiles') && sql.includes('onboarding_status =')) {
        Object.assign(profile, { onboarding_status: params[0] })
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('UPDATE seller_profiles') && sql.includes('SET tier =')) {
        Object.assign(profile, { tier: params[0] })
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('SELECT * FROM seller_profiles WHERE id = $1')) {
        return { rows: [{ ...profile }] }
      }
      if (sql.includes('UPDATE users')) return { rows: [] }
      if (sql.includes('INSERT INTO seller_audit_log')) return { rows: [] }
      return { rows: [] }
    }),
    release: jest.fn(),
  }
  return { client, profile, request }
}

describe('seller-lifecycle.service -- setSellerAccountStatus', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects an illegal transition (DRAFT -> RESTRICTED is not on the adjacency map)', async () => {
    const { client } = makeClient({ profile: { id: 'sp-1', user_id: 'user-1', account_status: 'DRAFT' } })
    mockGetClient.mockResolvedValue(client)

    await expect(
      setSellerAccountStatus({ sellerProfileId: 'sp-1', toStatus: 'RESTRICTED', actor: { actorId: 'admin-1' } }),
    ).rejects.toThrow(IllegalTransitionError)

    const updateCall = client.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE seller_profiles'))
    expect(updateCall).toBeUndefined()
  })

  it('is a no-op (no write, no audit) when already in the target state', async () => {
    const { client } = makeClient({ profile: { id: 'sp-1', user_id: 'user-1', account_status: 'ACTIVE' } })
    mockGetClient.mockResolvedValue(client)

    const result = await setSellerAccountStatus({ sellerProfileId: 'sp-1', toStatus: 'ACTIVE', actor: { actorId: 'admin-1' } })

    expect(result.noop).toBe(true)
    const updateCall = client.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE seller_profiles'))
    expect(updateCall).toBeUndefined()
    const auditCall = client.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO seller_audit_log'))
    expect(auditCall).toBeUndefined()
  })
})

describe('seller-lifecycle.service -- approveVerification', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws SelfApprovalError when the acting admin is the applicant themself', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', tier: 'unverified', account_status: 'PENDING_REVIEW' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', requested_tier: 'basic' },
    })
    mockGetClient.mockResolvedValue(client)

    await expect(
      approveVerification({ requestId: 'req-1', actor: { actorId: 'user-1' } }),
    ).rejects.toThrow(SelfApprovalError)
  })

  it('is idempotent -- approving an already-APPROVED request is a no-op, not a re-approval', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', tier: 'trusted', account_status: 'ACTIVE' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'APPROVED', requested_tier: 'trusted' },
    })
    mockGetClient.mockResolvedValue(client)

    const result = await approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })

    expect(result.noop).toBe(true)
    const updateCall = client.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE seller_profiles') && c[0].includes('tier ='))
    expect(updateCall).toBeUndefined()
  })

  describe('malware fail-closed enforcement (no real scanner is integrated this phase)', () => {
    const trustedTierConfig = { max_active_listings: 100, max_product_price: 2000, requires_id_verification: true }
    const baseFixture = {
      profile: { id: 'sp-1', tier: 'unverified', account_status: 'PENDING_REVIEW' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', requested_tier: 'trusted' },
      tierConfig: trustedTierConfig,
    }

    it('blocks approval when no document exists at all', async () => {
      const { client } = makeClient({ ...baseFixture, document: null })
      mockGetClient.mockResolvedValue(client)

      await expect(approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })).rejects.toThrow(
        IllegalTransitionError,
      )
    })

    it('blocks approval when the document is accepted but still NOT_SCANNED -- the core fail-closed case', async () => {
      const { client } = makeClient({
        ...baseFixture,
        document: { review_status: 'accepted', malware_scan_status: 'not_scanned' },
      })
      mockGetClient.mockResolvedValue(client)

      await expect(approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })).rejects.toThrow(
        IllegalTransitionError,
      )
      const approveCall = client.query.mock.calls.find(
        (c: any[]) => c[0].includes('UPDATE seller_verification_requests') && c[0].includes("status = 'APPROVED'"),
      )
      expect(approveCall).toBeUndefined()
    })

    it('blocks approval when the document is accepted but FLAGGED by a scan', async () => {
      const { client } = makeClient({
        ...baseFixture,
        document: { review_status: 'accepted', malware_scan_status: 'flagged' },
      })
      mockGetClient.mockResolvedValue(client)

      await expect(approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })).rejects.toThrow(
        IllegalTransitionError,
      )
    })

    it('blocks approval when the document is accepted but the scan ERRORed', async () => {
      const { client } = makeClient({
        ...baseFixture,
        document: { review_status: 'accepted', malware_scan_status: 'error' },
      })
      mockGetClient.mockResolvedValue(client)

      await expect(approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })).rejects.toThrow(
        IllegalTransitionError,
      )
    })

    it('blocks approval when the document is CLEAN but not yet accepted by an admin -- a scan result alone is also insufficient', async () => {
      const { client } = makeClient({
        ...baseFixture,
        document: { review_status: 'pending', malware_scan_status: 'clean' },
      })
      mockGetClient.mockResolvedValue(client)

      await expect(approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })).rejects.toThrow(
        IllegalTransitionError,
      )
    })

    it('approves only when BOTH accepted AND clean are true together', async () => {
      const { client } = makeClient({
        ...baseFixture,
        document: { review_status: 'accepted', malware_scan_status: 'clean' },
      })
      mockGetClient.mockResolvedValue(client)

      const result = await approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })

      expect(result.noop).toBe(false)
    })

    it('never requires a document at all for a tier that does not require ID verification', async () => {
      const { client } = makeClient({
        profile: { id: 'sp-1', tier: 'unverified', account_status: 'PENDING_REVIEW' },
        request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', requested_tier: 'basic' },
        tierConfig: { max_active_listings: 25, max_product_price: 500, requires_id_verification: false },
        document: null,
      })
      mockGetClient.mockResolvedValue(client)

      const result = await approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })

      expect(result.noop).toBe(false)
    })
  })

  it('auto-supersedes any other non-terminal case left on the same profile -- the exact orphan class found live in production -- marking it SUPERSEDED, not APPROVED', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', tier: 'unverified', account_status: 'PENDING_REVIEW' },
      request: { id: 'req-2', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', requested_tier: 'trusted' },
    })
    mockGetClient.mockResolvedValue(client)

    await approveVerification({ requestId: 'req-2', actor: { actorId: 'admin-1' } })

    const supersedeCall = client.query.mock.calls.find(
      (c: any[]) => c[0].includes('id <> $3') && c[0].includes("status IN ('PENDING', 'MORE_INFORMATION_REQUIRED')"),
    )
    expect(supersedeCall).toBeDefined()
    expect(supersedeCall![0]).toContain("status = 'SUPERSEDED'")
    expect(supersedeCall![0]).not.toContain("status = 'APPROVED', admin_decision_reason")
    expect(supersedeCall![1]).toEqual(['admin-1', 'sp-1', 'req-2'])
  })
})

describe('seller-lifecycle.service -- rejectVerification', () => {
  beforeEach(() => jest.clearAllMocks())

  it('requires a reason', async () => {
    await expect(
      rejectVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' }, reason: '' }),
    ).rejects.toThrow(/reason is required/i)
  })

  it('throws SelfApprovalError when the acting admin is the applicant themself', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', account_status: 'PENDING_REVIEW' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', case_type: 'initial_onboarding' },
    })
    mockGetClient.mockResolvedValue(client)

    await expect(
      rejectVerification({ requestId: 'req-1', actor: { actorId: 'user-1' }, reason: 'no' }),
    ).rejects.toThrow(SelfApprovalError)
  })

  it('never downgrades an already-ACTIVE account when rejecting a tier-upgrade request', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', account_status: 'ACTIVE' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', case_type: 'tier_upgrade' },
    })
    mockGetClient.mockResolvedValue(client)

    await rejectVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' }, reason: 'Not eligible for that tier yet' })

    const accountStatusUpdate = client.query.mock.calls.find(
      (c: any[]) => c[0].includes('UPDATE seller_profiles') && c[0].includes('verification_status'),
    )
    expect(accountStatusUpdate).toBeUndefined()
  })

  it('moves both verification_status and account_status to REJECTED when rejecting an initial-onboarding application', async () => {
    const { client, profile } = makeClient({
      profile: { id: 'sp-1', account_status: 'PENDING_REVIEW' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', case_type: 'initial_onboarding' },
    })
    mockGetClient.mockResolvedValue(client)

    await rejectVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' }, reason: 'Documents did not match' })

    const verificationUpdate = client.query.mock.calls.find(
      (c: any[]) => c[0].includes('UPDATE seller_profiles') && c[0].includes("verification_status = 'REJECTED'"),
    )
    expect(verificationUpdate).toBeDefined()
    expect(profile.account_status).toBe('REJECTED')
  })
})

describe('seller-lifecycle.service -- setSellerTier (the tier/verification conflation fix)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('touches tier and tier-derived limits only -- never verification_status or account_status', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', user_id: 'user-1', tier: 'unverified', verification_status: 'APPROVED', account_status: 'SUSPENDED' },
    })
    mockGetClient.mockResolvedValue(client)

    await setSellerTier({ sellerProfileId: 'sp-1', toTier: 'pro', actor: { actorId: 'admin-1' } })

    const updateCall = client.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE seller_profiles') && c[0].includes('SET tier ='))
    expect(updateCall![0]).not.toMatch(/verification_status|account_status/)
    const usersUpdate = client.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE users'))
    expect(usersUpdate).toBeUndefined()
  })

  it('never activates a seller account -- a tier change alone cannot move a DRAFT/PENDING_REVIEW seller to ACTIVE', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', user_id: 'user-1', tier: 'unverified', account_status: 'PENDING_REVIEW' },
    })
    mockGetClient.mockResolvedValue(client)

    await setSellerTier({ sellerProfileId: 'sp-1', toTier: 'trusted', actor: { actorId: 'admin-1' } })

    const accountStatusUpdate = client.query.mock.calls.find(
      (c: any[]) => c[0].includes('UPDATE seller_profiles') && c[0].includes('account_status ='),
    )
    expect(accountStatusUpdate).toBeUndefined()
  })
})

describe('seller-lifecycle.service -- submitSellerApplication concurrency/idempotency', () => {
  beforeEach(() => jest.clearAllMocks())

  it('acquires a row lock (FOR UPDATE) on the seller profile -- the serialization point that prevents two concurrent submissions from both passing the "no active case" check', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', user_id: 'user-1', tier: 'unverified', account_status: 'DRAFT' },
    })
    mockGetClient.mockResolvedValue(client)

    await submitSellerApplication({ sellerProfileId: 'sp-1', actor: { actorId: 'user-1' } })

    const lockingSelect = client.query.mock.calls.find(
      (c: any[]) => c[0].includes('FROM seller_profiles WHERE id = $1 FOR UPDATE'),
    )
    expect(lockingSelect).toBeDefined()
  })

  it('a resubmission while a case is already PENDING reuses that case (UPDATE) rather than inserting a second one', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', user_id: 'user-1', tier: 'unverified', account_status: 'DRAFT' },
      request: { id: 'req-existing', seller_profile_id: 'sp-1', status: 'PENDING', requested_tier: 'basic' },
    })
    mockGetClient.mockResolvedValue(client)

    await submitSellerApplication({ sellerProfileId: 'sp-1', actor: { actorId: 'user-1' }, requestedTier: 'basic' })

    const insertCall = client.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO seller_verification_requests'))
    expect(insertCall).toBeUndefined()
    const updateCall = client.query.mock.calls.find(
      (c: any[]) => c[0].trim().startsWith('UPDATE seller_verification_requests') && c[0].includes("status = 'PENDING'"),
    )
    expect(updateCall).toBeDefined()
  })
})

describe('seller-lifecycle.service -- notifications never block or duplicate the underlying transition', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does not send a notification when approveVerification is a no-op (already-approved request)', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', tier: 'trusted', account_status: 'ACTIVE' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'APPROVED', requested_tier: 'trusted' },
    })
    mockGetClient.mockResolvedValue(client)

    const result = await approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })

    expect(result.noop).toBe(true)
    expect(mockNotificationCreate).not.toHaveBeenCalled()
  })

  it('a notification failure does not roll back or fail an already-committed approval', async () => {
    mockNotificationCreate.mockRejectedValueOnce(new Error('email provider down'))
    const { client } = makeClient({
      profile: { id: 'sp-1', tier: 'unverified', account_status: 'PENDING_REVIEW' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', requested_tier: 'basic' },
      tierConfig: { max_active_listings: 25, max_product_price: 500, requires_id_verification: false },
    })
    mockGetClient.mockResolvedValue(client)

    // Must not throw despite the notification rejecting -- notifySeller
    // wraps its own call in try/catch, and runs strictly after COMMIT.
    const result = await approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' } })

    expect(result.noop).toBe(false)
    const commitCall = client.query.mock.calls.find((c: any[]) => c[0] === 'COMMIT')
    expect(commitCall).toBeDefined()
  })
})

describe('seller-lifecycle.service -- audit events carry actor/reason/state, never document content', () => {
  beforeEach(() => jest.clearAllMocks())

  it('the approval audit-log entry never includes a storage key, checksum, or other document identifier', async () => {
    const { client } = makeClient({
      profile: { id: 'sp-1', tier: 'unverified', account_status: 'PENDING_REVIEW' },
      request: { id: 'req-1', user_id: 'user-1', seller_profile_id: 'sp-1', status: 'PENDING', requested_tier: 'basic' },
      tierConfig: { max_active_listings: 25, max_product_price: 500, requires_id_verification: false },
    })
    mockGetClient.mockResolvedValue(client)

    await approveVerification({ requestId: 'req-1', actor: { actorId: 'admin-1' }, reason: 'Looks good' })

    const auditCall = client.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO seller_audit_log'))
    expect(auditCall).toBeDefined()
    const [, userId, actorId, action, previousState, newState] = auditCall![1]
    expect(userId).toBe('user-1')
    expect(actorId).toBe('admin-1')
    expect(action).toBe('seller_verification_approved')
    expect(previousState).toBeTruthy()
    expect(newState).toBeTruthy()
    const serialized = JSON.stringify(auditCall![1])
    expect(serialized).not.toMatch(/storage_key|checksum|seller-documents\//i)
  })
})
