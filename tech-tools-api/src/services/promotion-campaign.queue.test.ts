import { query } from '../database/connection'
import { getAdapter } from './social-adapters/registry'
import { decryptSecret } from '../utils/secret-encryption'
import { PublishError } from './social-adapters/social-adapter.types'
import {
  __processQueueTickForTests as processQueueTick,
  __resetMetricsSyncStateForTests as resetMetricsSyncState,
} from './promotion-campaign.queue'

jest.mock('../database/connection', () => ({ query: jest.fn() }))
jest.mock('./social-adapters/registry', () => ({ getAdapter: jest.fn() }))
jest.mock('../utils/secret-encryption', () => ({ decryptSecret: jest.fn() }))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock
const mockGetAdapter = getAdapter as jest.Mock
const mockDecryptSecret = decryptSecret as jest.Mock

const CONNECTION_ROW = { id: 'conn-1', access_token_encrypted: 'v1:iv:tag:ct', external_account_id: 'page-123' }

function baseChannelPostRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'post-1',
    campaign_id: 'campaign-1',
    channel: 'FACEBOOK',
    connection_id: 'conn-1',
    message_override: null,
    hashtags: [],
    link_url: 'https://techtoolstore.com/p/drill?utm_source=facebook',
    remote_post_id: null,
    attempt_count: 0,
    max_retries: 3,
    dry_run: false,
    campaign_master_message: 'Cordless drills, this weekend only.',
    ...overrides,
  }
}

/**
 * Builds a mockQuery implementation matching this queue's actual SQL shape
 * by substring, in the same style as analytics-v2.controller.test.ts.
 * `claimedRows` is returned exactly once by the claim UPDATE (subsequent
 * calls within the same tick return no rows, matching real single-claim-
 * per-tick behavior); `reconcileCounts` controls what
 * reconcileCampaignStatuses sees for the aggregate status recompute.
 */
function mockQueryImplementation(options: {
  claimedRows?: Record<string, unknown>[]
  reconcileCounts?: { all_dry_run: boolean; total: number; succeeded: number; terminal_failed: number; requires_action: number; in_flight: number }
  stuckRows?: Record<string, unknown>[]
} = {}) {
  const claimedRows = options.claimedRows ?? []
  let claimCalled = false

  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("SET status = 'QUEUED', queued_at = now()")) {
      // promoteScheduledChannelPosts -- no due DRAFT rows in these tests.
      return { rows: [] }
    }
    if (sql.includes("SET status = 'REQUIRES_ACTION', last_error = 'Stuck")) {
      return { rows: options.stuckRows ?? [] }
    }
    if (sql.includes("SET status = 'PUBLISHING', publishing_started_at = now()")) {
      if (claimCalled) return { rows: [] }
      claimCalled = true
      return { rows: claimedRows }
    }
    if (sql.includes('FROM social_connections')) {
      return { rows: [CONNECTION_ROW] }
    }
    if (sql.includes('INSERT INTO social_publish_attempts')) {
      return { rows: [] }
    }
    if (sql.includes('INSERT INTO promotion_activity_log')) {
      return { rows: [] }
    }
    if (sql.includes("SET status = 'QUEUED', attempt_count")) {
      return { rows: [] }
    }
    if (sql.includes("UPDATE promotion_channel_posts SET status = 'FAILED'")) {
      return { rows: [] }
    }
    if (sql.includes("UPDATE promotion_channel_posts SET status = 'REQUIRES_ACTION', attempt_count")) {
      return { rows: [] }
    }
    if (sql.includes('bool_and(dry_run)')) {
      return {
        rows: options.reconcileCounts
          ? [{ campaign_id: 'campaign-1', ...options.reconcileCounts }]
          : [],
      }
    }
    if (sql.includes('SET status = $2, completed_at')) {
      return { rows: [] }
    }
    if (sql.includes("WHERE status = 'PUBLISHED' AND dry_run = false")) {
      return { rows: [] } // metrics sync -- no eligible rows in these tests
    }
    return { rows: [] }
  })
}

describe('promotion-campaign.queue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDecryptSecret.mockReturnValue('decrypted-access-token')
    resetMetricsSyncState()
  })

  it('never re-publishes a channel post that already has a remote_post_id (idempotency guard)', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ remote_post_id: 'fb-existing-post-id' })] })
    const mockAdapter = { publish: jest.fn() }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    expect(mockAdapter.publish).not.toHaveBeenCalled()
    const skippedAttempt = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes('INSERT INTO social_publish_attempts') && c[1]?.[4] === 'SKIPPED_ALREADY_PUBLISHED',
    )
    expect(skippedAttempt).toBeDefined()
    const publishedUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, published_at = COALESCE'))
    expect(publishedUpdate).toBeDefined()
    expect(publishedUpdate![1]).toEqual(['post-1', 'PUBLISHED'])
  })

  it('idempotency-skip resolves a dry-run row to DRY_RUN_SUCCEEDED, never PUBLISHED', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ remote_post_id: 'dry-run-existing', dry_run: true })] })
    mockGetAdapter.mockReturnValue({ publish: jest.fn() })

    await processQueueTick()

    const skipUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, published_at = COALESCE'))
    expect(skipUpdate![1]).toEqual(['post-1', 'DRY_RUN_SUCCEEDED'])
  })

  it('dry-run rows resolve to DRY_RUN_SUCCEEDED, never PUBLISHED, and never call the real adapter', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ dry_run: true })] })
    const mockAdapter = { publish: jest.fn() }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    expect(mockAdapter.publish).not.toHaveBeenCalled()
    const successAttempt = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes('INSERT INTO social_publish_attempts') && c[1]?.[2] === true && c[1]?.[4] === 'SUCCESS',
    )
    expect(successAttempt).toBeDefined()
    const dryRunUpdate = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes("SET status = 'DRY_RUN_SUCCEEDED'") && typeof c[1]?.[1] === 'string' && c[1][1].startsWith('dry-run-'),
    )
    expect(dryRunUpdate).toBeDefined()
    // Never PUBLISHED under any circumstance for a dry-run row.
    const wronglyPublished = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'PUBLISHED'"))
    expect(wronglyPublished).toBeUndefined()
  })

  it('a successful real publish records the attempt and marks the row PUBLISHED with the real remote id', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow()] })
    const mockAdapter = { publish: jest.fn().mockResolvedValue({ remotePostId: 'fb-new-post-id', remotePermalink: 'https://facebook.com/fb-new-post-id' }) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    expect(mockAdapter.publish).toHaveBeenCalledTimes(1)
    expect(mockAdapter.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Cordless drills, this weekend only.',
        link: 'https://techtoolstore.com/p/drill?utm_source=facebook',
        dryRun: false,
        connection: expect.objectContaining({ accessToken: 'decrypted-access-token', externalAccountId: 'page-123' }),
      }),
    )
    const publishedUpdate = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes("SET status = 'PUBLISHED'") && c[1]?.[1] === 'fb-new-post-id',
    )
    expect(publishedUpdate).toBeDefined()
  })

  it('a SAFE_TO_RETRY failure (e.g. rate limited) requeues with backoff when attempts remain', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ attempt_count: 0, max_retries: 3 })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new PublishError('Rate limited', 'SAFE_TO_RETRY', 'RATE_LIMITED')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const requeue = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'QUEUED', attempt_count"))
    expect(requeue).toBeDefined()
    expect(requeue![1]).toEqual(['post-1', 1, 'Rate limited', 'RATE_LIMITED', expect.any(Number)])
    const terminalFail = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'FAILED'"))
    expect(terminalFail).toBeUndefined()
  })

  it('a SAFE_TO_RETRY failure goes terminal FAILED once max_retries is reached, with an activity log entry', async () => {
    // attempt_count = 2, max_retries = 3 -> this attempt is #3, the last allowed.
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ attempt_count: 2, max_retries: 3 })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new PublishError('Temporary provider error', 'SAFE_TO_RETRY', 'TEMPORARY_PROVIDER_ERROR')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const terminalFail = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'FAILED'"))
    expect(terminalFail).toBeDefined()
    expect(terminalFail![1]).toEqual(['post-1', 3, 'Temporary provider error', 'TEMPORARY_PROVIDER_ERROR'])
    const activityLog = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes('INSERT INTO promotion_activity_log') && c[1]?.[2] === 'CHANNEL_PUBLISH_FAILED',
    )
    expect(activityLog).toBeDefined()
  })

  it('a DO_NOT_RETRY failure (e.g. invalid caption) goes terminal FAILED immediately, even on the very first attempt', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ attempt_count: 0, max_retries: 3 })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new PublishError('Invalid caption', 'DO_NOT_RETRY', 'INVALID_MEDIA_OR_CAPTION')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const requeue = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'QUEUED', attempt_count"))
    expect(requeue).toBeUndefined() // never retried, regardless of remaining attempts
    const terminalFail = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'FAILED'"))
    expect(terminalFail).toBeDefined()
    expect(terminalFail![1]).toEqual(['post-1', 1, 'Invalid caption', 'INVALID_MEDIA_OR_CAPTION'])
  })

  it("an AUTH_EXPIRED or MISSING_SCOPE failure downgrades the connection's status -- a credential once granted does not stay assumed-good forever (Production Review Round 1 §18)", async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ connection_id: 'conn-1' })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new PublishError('Token expired', 'DO_NOT_RETRY', 'AUTH_EXPIRED')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const connectionUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE social_connections SET status'))
    expect(connectionUpdate).toBeDefined()
    expect(connectionUpdate![1]).toEqual(['conn-1', 'TOKEN_EXPIRED', 'Token expired'])
  })

  it('a MISSING_SCOPE failure downgrades the connection to MISSING_PERMISSION', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ connection_id: 'conn-1' })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new PublishError('Missing scope', 'DO_NOT_RETRY', 'MISSING_SCOPE')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const connectionUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE social_connections SET status'))
    expect(connectionUpdate![1]).toEqual(['conn-1', 'MISSING_PERMISSION', 'Missing scope'])
  })

  it('a DO_NOT_RETRY failure unrelated to auth/scope (e.g. invalid caption) never touches the connection status', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ connection_id: 'conn-1' })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new PublishError('Invalid caption', 'DO_NOT_RETRY', 'INVALID_MEDIA_OR_CAPTION')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const connectionUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE social_connections SET status'))
    expect(connectionUpdate).toBeUndefined()
  })

  it('a REMOTE_STATE_UNKNOWN failure (network error, no definitive response) is NEVER auto-retried -- moves to REQUIRES_ACTION', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ attempt_count: 0, max_retries: 3 })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new PublishError('No response received', 'REMOTE_STATE_UNKNOWN', 'TRANSPORT_ERROR')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const requeue = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'QUEUED', attempt_count"))
    expect(requeue).toBeUndefined()
    const terminalFail = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'FAILED'"))
    expect(terminalFail).toBeUndefined()
    const requiresAction = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'REQUIRES_ACTION', attempt_count"))
    expect(requiresAction).toBeDefined()
    expect(requiresAction![1]).toEqual(['post-1', 1, 'No response received', 'TRANSPORT_ERROR'])
    const activityLog = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes('INSERT INTO promotion_activity_log') && c[1]?.[2] === 'CHANNEL_REQUIRES_ACTION',
    )
    expect(activityLog).toBeDefined()
  })

  it('a plain (non-PublishError) exception from an adapter defaults to REMOTE_STATE_UNKNOWN -- never assumed safe to retry', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow()] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new Error('unexpected bug')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const requiresAction = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'REQUIRES_ACTION', attempt_count"))
    expect(requiresAction).toBeDefined()
    expect(requiresAction![1][3]).toBe('UNCLASSIFIED_ERROR')
  })

  it('a channel post with no connection configured fails immediately without calling the adapter', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ connection_id: null })] })
    const mockAdapter = { publish: jest.fn() }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    expect(mockAdapter.publish).not.toHaveBeenCalled()
    const failedUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'FAILED'"))
    expect(failedUpdate).toBeDefined()
    expect(failedUpdate![1]).toEqual(['post-1', 1])
  })

  it('sweeps a channel post stuck in PUBLISHING past the safety timeout to REQUIRES_ACTION, and logs it -- never blindly requeues it', async () => {
    mockQueryImplementation({ stuckRows: [{ id: 'post-stuck', campaign_id: 'campaign-1', channel: 'FACEBOOK' }] })
    mockGetAdapter.mockReturnValue({ publish: jest.fn() })

    await processQueueTick()

    const sweepUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'REQUIRES_ACTION', last_error = 'Stuck"))
    expect(sweepUpdate).toBeDefined()
    const activityLog = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes('INSERT INTO promotion_activity_log') && c[1]?.[2] === 'CHANNEL_REQUIRES_ACTION' && c[1]?.[0] === 'campaign-1',
    )
    expect(activityLog).toBeDefined()
    // Never a blind requeue to QUEUED for a stuck row.
    const blindRequeue = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'QUEUED', attempt_count"))
    expect(blindRequeue).toBeUndefined()
  })

  it('recomputes campaign status to PARTIAL_SUCCESS when channels split between succeeded and failed, never touching an in-flight campaign', async () => {
    mockQueryImplementation({
      claimedRows: [baseChannelPostRow()],
      reconcileCounts: { all_dry_run: false, total: 3, succeeded: 2, terminal_failed: 1, requires_action: 0, in_flight: 0 },
    })
    mockGetAdapter.mockReturnValue({ publish: jest.fn().mockResolvedValue({ remotePostId: 'fb-1' }) })

    await processQueueTick()

    const reconcile = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, completed_at'))
    expect(reconcile).toBeDefined()
    expect(reconcile![1]).toEqual(['campaign-1', 'PARTIAL_SUCCESS'])
  })

  it('recomputes campaign status to PARTIAL_SUCCESS (never a clean FAILED/PUBLISHED) when any channel is REQUIRES_ACTION', async () => {
    mockQueryImplementation({
      claimedRows: [baseChannelPostRow()],
      reconcileCounts: { all_dry_run: false, total: 2, succeeded: 1, terminal_failed: 0, requires_action: 1, in_flight: 0 },
    })
    mockGetAdapter.mockReturnValue({ publish: jest.fn().mockResolvedValue({ remotePostId: 'fb-1' }) })

    await processQueueTick()

    const reconcile = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, completed_at'))
    expect(reconcile![1]).toEqual(['campaign-1', 'PARTIAL_SUCCESS'])
  })

  it('recomputes campaign status to PUBLISHED only when every channel post succeeded for real (not dry-run)', async () => {
    mockQueryImplementation({
      claimedRows: [baseChannelPostRow()],
      reconcileCounts: { all_dry_run: false, total: 2, succeeded: 2, terminal_failed: 0, requires_action: 0, in_flight: 0 },
    })
    mockGetAdapter.mockReturnValue({ publish: jest.fn().mockResolvedValue({ remotePostId: 'fb-1' }) })

    await processQueueTick()

    const reconcile = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, completed_at'))
    expect(reconcile![1]).toEqual(['campaign-1', 'PUBLISHED'])
  })

  it('recomputes campaign status to DRY_RUN_COMPLETED (never PUBLISHED/PARTIAL_SUCCESS/FAILED) once every channel of an all-dry-run campaign is terminal', async () => {
    mockQueryImplementation({
      claimedRows: [baseChannelPostRow({ dry_run: true })],
      reconcileCounts: { all_dry_run: true, total: 2, succeeded: 2, terminal_failed: 0, requires_action: 0, in_flight: 0 },
    })
    mockGetAdapter.mockReturnValue({ publish: jest.fn() })

    await processQueueTick()

    const reconcile = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, completed_at'))
    expect(reconcile![1]).toEqual(['campaign-1', 'DRY_RUN_COMPLETED'])
  })

  it('leaves a campaign untouched (still PUBLISHING) while any of its channel posts are still in flight', async () => {
    mockQueryImplementation({
      claimedRows: [baseChannelPostRow()],
      reconcileCounts: { all_dry_run: false, total: 3, succeeded: 1, terminal_failed: 0, requires_action: 0, in_flight: 2 },
    })
    mockGetAdapter.mockReturnValue({ publish: jest.fn().mockResolvedValue({ remotePostId: 'fb-1' }) })

    await processQueueTick()

    const reconcile = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, completed_at'))
    expect(reconcile).toBeUndefined()
  })

  it('never crashes the tick when the database query throws -- caught and logged, not propagated', async () => {
    mockQuery.mockRejectedValue(new Error('connection reset'))
    await expect(processQueueTick()).resolves.not.toThrow()
  })

  describe('metrics sync -- dry-run posts never accumulate fake social metrics (Production Review Round 1 §19)', () => {
    it("the metrics-sync SELECT is scoped to dry_run = false -- a dry-run post's synthetic remote_post_id can never be handed to a real adapter's fetchMetrics()", async () => {
      mockQueryImplementation()
      mockGetAdapter.mockReturnValue({ publish: jest.fn() })

      await processQueueTick()

      const metricsQuery = mockQuery.mock.calls.find((c: any[]) => c[0].includes('FROM promotion_channel_posts') && c[0].includes('social_metric_snapshots'))
      expect(metricsQuery).toBeDefined()
      expect(metricsQuery![0]).toContain("status = 'PUBLISHED' AND dry_run = false")
      expect(metricsQuery![0]).toContain('remote_post_id IS NOT NULL')
    })

    it('never calls fetchMetrics or inserts a metric snapshot when the metrics-sync query returns no eligible (i.e. all dry-run) rows', async () => {
      mockQueryImplementation()
      const fetchMetrics = jest.fn()
      mockGetAdapter.mockReturnValue({ publish: jest.fn(), fetchMetrics })

      await processQueueTick()

      expect(fetchMetrics).not.toHaveBeenCalled()
      const snapshotInsert = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO social_metric_snapshots'))
      expect(snapshotInsert).toBeUndefined()
    })

    it('only fetches metrics for rows the query already filtered to real, published, non-dry-run posts -- and records a real snapshot for them', async () => {
      const fetchMetrics = jest.fn().mockResolvedValue({ impressions: 100, reach: 80, likes: 5, comments: 1, shares: 0, clicks: 2 })
      mockGetAdapter.mockReturnValue({ publish: jest.fn(), fetchMetrics })
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("WHERE status = 'PUBLISHED' AND dry_run = false")) {
          return { rows: [{ id: 'post-real-1', channel: 'FACEBOOK', connection_id: 'conn-1', remote_post_id: 'fb-real-post-id' }] }
        }
        if (sql.includes('FROM social_connections')) {
          return { rows: [CONNECTION_ROW] }
        }
        if (sql.includes('INSERT INTO social_metric_snapshots')) {
          return { rows: [] }
        }
        return { rows: [] }
      })

      await processQueueTick()

      expect(fetchMetrics).toHaveBeenCalledWith(expect.anything(), 'fb-real-post-id')
      const snapshotInsert = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO social_metric_snapshots'))
      expect(snapshotInsert).toBeDefined()
      expect(snapshotInsert![1][0]).toBe('post-real-1')
    })
  })
})
