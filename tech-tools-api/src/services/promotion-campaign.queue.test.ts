import { query } from '../database/connection'
import { getAdapter } from './social-adapters/registry'
import { decryptSecret } from '../utils/secret-encryption'
import { __processQueueTickForTests as processQueueTick } from './promotion-campaign.queue'

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
  reconcileCounts?: { total: number; published: number; terminal_failed: number; in_flight: number }
} = {}) {
  const claimedRows = options.claimedRows ?? []
  let claimCalled = false

  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("SET status = 'QUEUED', queued_at = now()")) {
      // promoteScheduledChannelPosts -- no due DRAFT rows in these tests.
      return { rows: [] }
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
    if (sql.includes('COUNT(*) FILTER')) {
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
    const publishedUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'PUBLISHED'"))
    expect(publishedUpdate).toBeDefined()
  })

  it('dry-run rows synthesize a remote id and never call the real adapter', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ dry_run: true })] })
    const mockAdapter = { publish: jest.fn() }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    expect(mockAdapter.publish).not.toHaveBeenCalled()
    const successAttempt = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes('INSERT INTO social_publish_attempts') && c[1]?.[2] === true && c[1]?.[4] === 'SUCCESS',
    )
    expect(successAttempt).toBeDefined()
    const publishedUpdate = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes("SET status = 'PUBLISHED'") && typeof c[1]?.[1] === 'string' && c[1][1].startsWith('dry-run-'),
    )
    expect(publishedUpdate).toBeDefined()
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

  it('a failed publish requeues with backoff when attempts remain', async () => {
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ attempt_count: 0, max_retries: 3 })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new Error('Rate limited')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const requeue = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'QUEUED', attempt_count"))
    expect(requeue).toBeDefined()
    expect(requeue![1]).toEqual(['post-1', 1, 'Rate limited', expect.any(Number)])
    const terminalFail = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'FAILED'"))
    expect(terminalFail).toBeUndefined()
  })

  it('a failed publish goes terminal FAILED once max_retries is reached, with an activity log entry', async () => {
    // attempt_count = 2, max_retries = 3 -> this attempt is #3, the last allowed.
    mockQueryImplementation({ claimedRows: [baseChannelPostRow({ attempt_count: 2, max_retries: 3 })] })
    const mockAdapter = { publish: jest.fn().mockRejectedValue(new Error('Invalid media')) }
    mockGetAdapter.mockReturnValue(mockAdapter)

    await processQueueTick()

    const terminalFail = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE promotion_channel_posts SET status = 'FAILED'"))
    expect(terminalFail).toBeDefined()
    expect(terminalFail![1]).toEqual(['post-1', 3, 'Invalid media'])
    const activityLog = mockQuery.mock.calls.find(
      (c: any[]) => c[0].includes('INSERT INTO promotion_activity_log') && c[1]?.[2] === 'CHANNEL_PUBLISH_FAILED',
    )
    expect(activityLog).toBeDefined()
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

  it('recomputes campaign status to PARTIAL_SUCCESS when channels split between published and failed, never touching an in-flight campaign', async () => {
    mockQueryImplementation({
      claimedRows: [baseChannelPostRow()],
      reconcileCounts: { total: 3, published: 2, terminal_failed: 1, in_flight: 0 },
    })
    mockGetAdapter.mockReturnValue({ publish: jest.fn().mockResolvedValue({ remotePostId: 'fb-1' }) })

    await processQueueTick()

    const reconcile = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, completed_at'))
    expect(reconcile).toBeDefined()
    expect(reconcile![1]).toEqual(['campaign-1', 'PARTIAL_SUCCESS'])
  })

  it('recomputes campaign status to PUBLISHED only when every channel post succeeded', async () => {
    mockQueryImplementation({
      claimedRows: [baseChannelPostRow()],
      reconcileCounts: { total: 2, published: 2, terminal_failed: 0, in_flight: 0 },
    })
    mockGetAdapter.mockReturnValue({ publish: jest.fn().mockResolvedValue({ remotePostId: 'fb-1' }) })

    await processQueueTick()

    const reconcile = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET status = $2, completed_at'))
    expect(reconcile![1]).toEqual(['campaign-1', 'PUBLISHED'])
  })

  it('leaves a campaign untouched (still PUBLISHING) while any of its channel posts are still in flight', async () => {
    mockQueryImplementation({
      claimedRows: [baseChannelPostRow()],
      reconcileCounts: { total: 3, published: 1, terminal_failed: 0, in_flight: 2 },
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
})
