/**
 * PROMOTION-OPS-1 background scheduler/publisher. Same shape as
 * newsletter.queue.ts (this codebase's one consistent async-worker
 * convention -- a plain setInterval poller, not a job-queue library; see
 * that file for the pattern this one deliberately mirrors): module-level
 * start/stop + a re-entrancy guard, no separate queue infrastructure.
 *
 * Known limitation, carried forward unchanged from every existing worker
 * in this codebase (newsletter.queue.ts, supplier.guardrails.ts,
 * workers/anomaly.detection.ts, workers/metrics.broadcaster.ts): no
 * `FOR UPDATE SKIP LOCKED` -- safety against double-processing rests on
 * the single-process assumption (one Node process running this worker) and
 * the busy-guard below, not row-level locking. Confirmed via
 * infrastructure/docker-compose.prod.yml (a fixed `container_name:
 * techtools-api-prod`, incompatible with replica scaling) that production
 * runs exactly one API process today -- not a guess. PROMOTION_QUEUE_ENABLED
 * (default true) exists as an explicit safety valve for if that topology
 * ever changes: set it to false on every instance except the one
 * deliberately designated to publish. See Production Review Round 1 §7.
 *
 * Idempotency (the core safety property this file exists to provide):
 * every row is claimed -- moved to PUBLISHING -- via an UPDATE ... RETURNING
 * *before* any network call is made. If a row already has a remote_post_id
 * when claimed (a prior attempt crashed after the real platform call
 * succeeded but before this process recorded it), the worker never calls
 * publish() again -- it records a SKIPPED_ALREADY_PUBLISHED attempt and
 * marks the row PUBLISHED.
 *
 * Dry-run truth (Production Review Round 1 §3): a simulated publish can
 * NEVER reach 'PUBLISHED' -- only 'DRY_RUN_SUCCEEDED'. A campaign whose
 * channels are all dry-run reaches 'DRY_RUN_COMPLETED', never 'PUBLISHED'
 * or 'PARTIAL_SUCCESS'. No dry-run row is ever indistinguishable from a
 * genuinely published one.
 *
 * Failure classification (Production Review Round 1 §4/§5): every real
 * publish failure is either SAFE_TO_RETRY (a definitive provider response
 * indicating a transient condition), DO_NOT_RETRY (a definitive provider
 * response indicating a permanent condition), or REMOTE_STATE_UNKNOWN (no
 * definitive response was ever received -- the network call itself threw).
 * Only SAFE_TO_RETRY is ever automatically retried. REMOTE_STATE_UNKNOWN
 * and exhausted-retry SAFE_TO_RETRY failures both land on REQUIRES_ACTION
 * or FAILED as appropriate -- REMOTE_STATE_UNKNOWN specifically NEVER
 * auto-retries, since a retry could create a real duplicate post if the
 * ambiguous first attempt actually succeeded. See
 * docs/SOCIAL-PUBLISHING-ARCHITECTURE.md.
 */
import { query } from '../database/connection'
import { randomUUID } from 'crypto'
import logger from '../utils/logger'
import { decryptSecret } from '../utils/secret-encryption'
import { getAdapter } from './social-adapters/registry'
import { ConnectionCreds, PublishError, SocialPlatform } from './social-adapters/social-adapter.types'

let queueStarted = false
let queueTimer: NodeJS.Timeout | null = null
let queueBusy = false
let lastMetricsSyncAt = 0

const WORKER_INTERVAL_MS = Number.parseInt(process.env.PROMOTION_QUEUE_INTERVAL_MS || '15000', 10)
const BATCH_SIZE = Number.parseInt(process.env.PROMOTION_QUEUE_BATCH_SIZE || '10', 10)
const MAX_RETRIES_DEFAULT = Number.parseInt(process.env.PROMOTION_MAX_RETRIES || '3', 10)
const RETRY_BACKOFF_SECONDS = Number.parseInt(process.env.PROMOTION_RETRY_BACKOFF_SECONDS || '60', 10)
const METRICS_SYNC_INTERVAL_MS = Number.parseInt(process.env.PROMOTION_METRICS_SYNC_INTERVAL_MS || String(30 * 60 * 1000), 10)
const METRICS_SYNC_BATCH_SIZE = Number.parseInt(process.env.PROMOTION_METRICS_SYNC_BATCH_SIZE || '20', 10)
/** A channel post left in PUBLISHING longer than this (no confirmed remote_post_id) is swept to REQUIRES_ACTION rather than left to hang or blindly requeued. */
const STUCK_PUBLISHING_TIMEOUT_SECONDS = Number.parseInt(process.env.PROMOTION_STUCK_TIMEOUT_SECONDS || '300', 10)

/**
 * Explicit single-worker-instance safety valve (Production Review Round 1
 * §7) -- defaults to enabled because the current verified production
 * topology (infrastructure/docker-compose.prod.yml) runs exactly one API
 * container. If that ever changes to multiple replicas, this MUST be set
 * to 'false' on every instance except the one deliberately designated to
 * run the publisher, or the FOR UPDATE SKIP LOCKED gap above becomes a
 * real double-publish risk.
 */
function isQueueEnabled(): boolean {
  return process.env.PROMOTION_QUEUE_ENABLED !== 'false'
}

/**
 * Global default for whether a NEW campaign is created in dry-run mode --
 * every campaign snapshots this value at schedule/publish time (see
 * promotion-campaign.controller.ts), so flipping this env var never
 * retroactively relabels a campaign already in flight. Defaults to true
 * (safe-by-default): a founder must deliberately set this to the literal
 * string 'false' to allow any campaign to attempt a real external publish.
 */
export function isDryRunDefault(): boolean {
  return process.env.SOCIAL_PUBLISH_DRY_RUN !== 'false'
}

interface ChannelPostRow {
  id: string
  campaign_id: string
  channel: SocialPlatform
  connection_id: string | null
  message_override: string | null
  hashtags: string[]
  link_url: string | null
  remote_post_id: string | null
  attempt_count: number
  max_retries: number
  dry_run: boolean
  campaign_master_message: string
}

async function resolveConnectionCreds(connectionId: string | null): Promise<ConnectionCreds | null> {
  if (!connectionId) return null
  const result = await query(
    `SELECT id, access_token_encrypted, external_account_id
     FROM social_connections
     WHERE id = $1 AND disabled_by_admin = false`,
    [connectionId],
  )
  const row = result.rows[0]
  if (!row || !row.access_token_encrypted) return null
  return {
    connectionId: row.id,
    accessToken: decryptSecret(row.access_token_encrypted),
    externalAccountId: row.external_account_id,
  }
}

/**
 * Promotes DRAFT channel posts whose (own or inherited-from-campaign)
 * scheduled time has arrived into QUEUED -- and flips their parent
 * campaign from SCHEDULED to PUBLISHING the first time this happens for
 * it. "Publish now" bypasses this entirely: the controller sets QUEUED
 * directly so the very next tick picks it up without waiting on a
 * schedule check.
 */
async function promoteScheduledChannelPosts(): Promise<void> {
  const dueResult = await query(
    `UPDATE promotion_channel_posts pcp
     SET status = 'QUEUED', queued_at = now(), updated_at = now()
     FROM promotion_campaigns pc
     WHERE pcp.campaign_id = pc.id
       AND pcp.status = 'DRAFT'
       AND pc.status = 'SCHEDULED'
       AND COALESCE(pcp.scheduled_at, pc.scheduled_at) <= now()
     RETURNING pcp.campaign_id`,
    [],
  )
  if (dueResult.rows.length === 0) return

  const campaignIds = Array.from(new Set(dueResult.rows.map((r: any) => r.campaign_id)))
  await query(
    `UPDATE promotion_campaigns
     SET status = 'PUBLISHING', published_at = COALESCE(published_at, now()), updated_at = now()
     WHERE id = ANY($1) AND status = 'SCHEDULED'`,
    [campaignIds],
  )
}

/**
 * A channel post that has sat in PUBLISHING (claimed, network call
 * presumably attempted) for longer than STUCK_PUBLISHING_TIMEOUT_SECONDS
 * without ever recording a remote_post_id is swept to REQUIRES_ACTION --
 * NEVER blindly returned to QUEUED, since we cannot know whether the
 * stalled attempt's real publish call actually reached the provider
 * before the process/connection failed. A human must resolve it (see
 * promotion-campaign.controller.ts's resolveChannelPost()).
 */
async function sweepStuckPublishingRows(): Promise<void> {
  const result = await query(
    `UPDATE promotion_channel_posts
     SET status = 'REQUIRES_ACTION', last_error = 'Stuck in PUBLISHING beyond the safety timeout with no confirmed remote post id -- outcome unknown, human verification required.',
         last_error_code = 'STUCK_PUBLISHING_TIMEOUT', updated_at = now()
     WHERE status = 'PUBLISHING'
       AND remote_post_id IS NULL
       AND publishing_started_at IS NOT NULL
       AND publishing_started_at < now() - make_interval(secs => $1)
     RETURNING id, campaign_id, channel`,
    [STUCK_PUBLISHING_TIMEOUT_SECONDS],
  )
  for (const row of result.rows) {
    await logActivity(row.campaign_id, row.id, 'CHANNEL_REQUIRES_ACTION', { channel: row.channel, reason: 'STUCK_PUBLISHING_TIMEOUT' })
  }
}

async function claimBatch(): Promise<ChannelPostRow[]> {
  const result = await query(
    `UPDATE promotion_channel_posts
     SET status = 'PUBLISHING', publishing_started_at = now(), updated_at = now()
     WHERE id IN (
       SELECT id FROM promotion_channel_posts
       WHERE status = 'QUEUED' AND (next_attempt_at IS NULL OR next_attempt_at <= now())
       ORDER BY queued_at ASC NULLS LAST
       LIMIT $1
     )
     RETURNING id, campaign_id, channel, connection_id, message_override, hashtags, link_url,
               remote_post_id, attempt_count, max_retries, dry_run,
               (SELECT master_message FROM promotion_campaigns WHERE id = promotion_channel_posts.campaign_id) as campaign_master_message`,
    [BATCH_SIZE],
  )
  return result.rows as ChannelPostRow[]
}

async function recordAttempt(
  channelPostId: string,
  attemptNumber: number,
  dryRun: boolean,
  responseStatus: string,
  fields: { requestPayload?: unknown; remotePostId?: string; errorCode?: string; errorMessage?: string } = {},
): Promise<void> {
  await query(
    `INSERT INTO social_publish_attempts
       (channel_post_id, attempt_number, dry_run, request_payload, response_status, remote_post_id, error_code, error_message, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [
      channelPostId,
      attemptNumber,
      dryRun,
      JSON.stringify(fields.requestPayload || {}),
      responseStatus,
      fields.remotePostId || null,
      fields.errorCode || null,
      fields.errorMessage || null,
    ],
  )
}

async function logActivity(campaignId: string, channelPostId: string | null, action: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await query(
    `INSERT INTO promotion_activity_log (campaign_id, channel_post_id, actor_user_id, action, metadata)
     VALUES ($1, $2, NULL, $3, $4)`,
    [campaignId, channelPostId, action, JSON.stringify(metadata)],
  )
}

/** Never throws -- every real adapter failure is normalized to a PublishError so the caller always has a classification to branch on, even if an adapter (or a bug) throws a plain Error somewhere. Unclassified failures default to REMOTE_STATE_UNKNOWN -- the safe choice when genuinely uncertain, matching "when unknowable, mark REQUIRES_ACTION." */
function classifyUnknownError(error: unknown): PublishError {
  if (error instanceof PublishError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new PublishError(message, 'REMOTE_STATE_UNKNOWN', 'UNCLASSIFIED_ERROR')
}

async function processChannelPost(row: ChannelPostRow): Promise<void> {
  const attemptNumber = row.attempt_count + 1
  const message = row.message_override ?? row.campaign_master_message

  // Idempotency guard -- a prior attempt may have crashed after the real
  // platform call succeeded but before this process recorded it. Never
  // re-publish; just reconcile our own state.
  if (row.remote_post_id) {
    await recordAttempt(row.id, attemptNumber, row.dry_run, 'SKIPPED_ALREADY_PUBLISHED', { remotePostId: row.remote_post_id })
    await query(
      `UPDATE promotion_channel_posts SET status = $2, published_at = COALESCE(published_at, now()), updated_at = now() WHERE id = $1`,
      [row.id, row.dry_run ? 'DRY_RUN_SUCCEEDED' : 'PUBLISHED'],
    )
    return
  }

  if (row.dry_run) {
    // A dry-run post is a SIMULATION -- it must never become
    // indistinguishable from a genuinely published one. DRY_RUN_SUCCEEDED
    // is a structurally distinct terminal status; the synthesized id is
    // clearly prefixed and is never written into a real-looking
    // remote_permalink.
    const fakeRemoteId = `dry-run-${randomUUID()}`
    await recordAttempt(row.id, attemptNumber, true, 'SUCCESS', {
      requestPayload: { message, hashtags: row.hashtags, link: row.link_url },
      remotePostId: fakeRemoteId,
    })
    await query(
      `UPDATE promotion_channel_posts
       SET status = 'DRY_RUN_SUCCEEDED', remote_post_id = $2, published_at = now(), attempt_count = $3, updated_at = now()
       WHERE id = $1`,
      [row.id, fakeRemoteId, attemptNumber],
    )
    return
  }

  const connection = await resolveConnectionCreds(row.connection_id)
  if (!connection) {
    await recordAttempt(row.id, attemptNumber, false, 'FAILED', { errorCode: 'MISSING_CONNECTION', errorMessage: 'No active social connection configured for this channel.' })
    await query(
      `UPDATE promotion_channel_posts SET status = 'FAILED', last_error = 'No active social connection configured for this channel.', last_error_code = 'MISSING_CONNECTION', attempt_count = $2, updated_at = now() WHERE id = $1`,
      [row.id, attemptNumber],
    )
    await logActivity(row.campaign_id, row.id, 'CHANNEL_PUBLISH_FAILED', { channel: row.channel, errorCode: 'MISSING_CONNECTION' })
    return
  }

  try {
    const adapter = getAdapter(row.channel)
    const result = await adapter.publish({
      connection,
      message,
      link: row.link_url || undefined,
      dryRun: false,
    })
    await recordAttempt(row.id, attemptNumber, false, 'SUCCESS', { remotePostId: result.remotePostId })
    await query(
      `UPDATE promotion_channel_posts
       SET status = 'PUBLISHED', remote_post_id = $2, remote_permalink = $3, published_at = now(), attempt_count = $4, updated_at = now()
       WHERE id = $1`,
      [row.id, result.remotePostId, result.remotePermalink || null, attemptNumber],
    )
    await logActivity(row.campaign_id, row.id, 'CHANNEL_PUBLISHED', { channel: row.channel })
  } catch (rawError) {
    const error = classifyUnknownError(rawError)
    await recordAttempt(row.id, attemptNumber, false, 'FAILED', { errorMessage: error.message, errorCode: error.errorCode })

    if (error.classification === 'REMOTE_STATE_UNKNOWN') {
      // Never auto-retry an ambiguous outcome -- a retry could create a
      // real duplicate post if the first attempt actually reached the
      // provider. Requires an explicit human decision.
      await query(
        `UPDATE promotion_channel_posts SET status = 'REQUIRES_ACTION', attempt_count = $2, last_error = $3, last_error_code = $4, updated_at = now() WHERE id = $1`,
        [row.id, attemptNumber, error.message, error.errorCode],
      )
      await logActivity(row.campaign_id, row.id, 'CHANNEL_REQUIRES_ACTION', { channel: row.channel, errorCode: error.errorCode })
      return
    }

    if (error.classification === 'DO_NOT_RETRY') {
      // A definitive, permanent failure -- retrying would fail identically forever.
      await query(
        `UPDATE promotion_channel_posts SET status = 'FAILED', attempt_count = $2, last_error = $3, last_error_code = $4, updated_at = now() WHERE id = $1`,
        [row.id, attemptNumber, error.message, error.errorCode],
      )
      await logActivity(row.campaign_id, row.id, 'CHANNEL_PUBLISH_FAILED', { channel: row.channel, errorCode: error.errorCode, terminal: true, retryable: false })

      // A credential being present and OAuth having once succeeded does not
      // mean it still carries publish authority (Production Review Round 1
      // §18) -- an AUTH_EXPIRED/MISSING_SCOPE failure is real, first-hand
      // evidence the connection no longer works. Reflect that on the
      // connection itself so the Connections page stops honestly-but-
      // stalely claiming CONNECTED forever. Only downgrades a currently
      // CONNECTED row -- never overwrites a DISCONNECTED/DISABLED_BY_ADMIN
      // state a human already set deliberately.
      if (row.connection_id && (error.errorCode === 'AUTH_EXPIRED' || error.errorCode === 'MISSING_SCOPE')) {
        await query(
          `UPDATE social_connections SET status = $2, last_error = $3, updated_at = now() WHERE id = $1 AND status = 'CONNECTED'`,
          [row.connection_id, error.errorCode === 'AUTH_EXPIRED' ? 'TOKEN_EXPIRED' : 'MISSING_PERMISSION', error.message],
        )
      }
      return
    }

    // SAFE_TO_RETRY -- the provider gave a definitive response indicating
    // a transient condition; the request was received and errored, not
    // silently dropped, so retrying cannot create a duplicate.
    const maxRetries = row.max_retries || MAX_RETRIES_DEFAULT
    if (attemptNumber < maxRetries) {
      await query(
        `UPDATE promotion_channel_posts
         SET status = 'QUEUED', attempt_count = $2, last_error = $3, last_error_code = $4,
             next_attempt_at = now() + make_interval(secs => $5 * $2), updated_at = now()
         WHERE id = $1`,
        [row.id, attemptNumber, error.message, error.errorCode, RETRY_BACKOFF_SECONDS],
      )
    } else {
      await query(
        `UPDATE promotion_channel_posts SET status = 'FAILED', attempt_count = $2, last_error = $3, last_error_code = $4, updated_at = now() WHERE id = $1`,
        [row.id, attemptNumber, error.message, error.errorCode],
      )
      await logActivity(row.campaign_id, row.id, 'CHANNEL_PUBLISH_FAILED', { channel: row.channel, errorCode: error.errorCode, terminal: true, retryable: true, retriesExhausted: true })
    }
  }
}

/**
 * Recomputes each touched campaign's aggregate status from its channel
 * posts' actual current statuses -- never rolls back an already-terminal
 * channel row; a campaign only ever moves forward through its lifecycle.
 * A dry-run campaign can only ever land on DRY_RUN_COMPLETED, never
 * PUBLISHED/PARTIAL_SUCCESS/FAILED -- those three remain reserved for
 * campaigns that attempted a genuinely real publish.
 */
export async function reconcileCampaignStatuses(campaignIds: string[]): Promise<void> {
  if (campaignIds.length === 0) return
  const uniqueIds = Array.from(new Set(campaignIds))

  const result = await query(
    `SELECT campaign_id,
            bool_and(dry_run) as all_dry_run,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status IN ('PUBLISHED', 'DRY_RUN_SUCCEEDED')) as succeeded,
            COUNT(*) FILTER (WHERE status IN ('FAILED', 'CANCELLED')) as terminal_failed,
            COUNT(*) FILTER (WHERE status = 'REQUIRES_ACTION') as requires_action,
            COUNT(*) FILTER (WHERE status IN ('DRAFT', 'QUEUED', 'PUBLISHING')) as in_flight
     FROM promotion_channel_posts
     WHERE campaign_id = ANY($1)
     GROUP BY campaign_id`,
    [uniqueIds],
  )

  for (const row of result.rows) {
    const total = Number(row.total)
    const succeeded = Number(row.succeeded)
    const terminalFailed = Number(row.terminal_failed)
    const requiresAction = Number(row.requires_action)
    const inFlight = Number(row.in_flight)

    if (inFlight > 0) continue // still in progress -- leave as PUBLISHING

    let newStatus: string
    if (row.all_dry_run) {
      // Simulation finished -- regardless of per-channel outcome within
      // the simulation, no real publication occurred. Never PUBLISHED,
      // never PARTIAL_SUCCESS, never FAILED.
      newStatus = 'DRY_RUN_COMPLETED'
    } else if (succeeded === total) {
      newStatus = 'PUBLISHED'
    } else if (requiresAction === 0 && succeeded === 0 && terminalFailed === total) {
      newStatus = 'FAILED'
    } else {
      // Any mix, or any REQUIRES_ACTION channel present -- never silently
      // reported as a clean FAILED/PUBLISHED when a human still needs to
      // look at something.
      newStatus = 'PARTIAL_SUCCESS'
    }

    await query(
      `UPDATE promotion_campaigns
       SET status = $2, completed_at = COALESCE(completed_at, now()), updated_at = now()
       WHERE id = $1 AND status = 'PUBLISHING'`,
      [row.campaign_id, newStatus],
    )
  }
}

async function syncMetrics(): Promise<void> {
  if (Date.now() - lastMetricsSyncAt < METRICS_SYNC_INTERVAL_MS) return
  lastMetricsSyncAt = Date.now()

  // dry_run = false is the critical guard here -- a dry-run channel post's
  // synthesized remote_post_id ('dry-run-<uuid>') is not a real provider
  // identity, and fetchMetrics() must never be called with it. No
  // dry-run post may ever accumulate a real-looking metric snapshot.
  const result = await query(
    `SELECT id, channel, connection_id, remote_post_id
     FROM promotion_channel_posts
     WHERE status = 'PUBLISHED' AND dry_run = false AND remote_post_id IS NOT NULL
       AND connection_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM social_metric_snapshots s
         WHERE s.channel_post_id = promotion_channel_posts.id AND s.captured_at > now() - make_interval(mins => 60)
       )
     ORDER BY published_at DESC NULLS LAST
     LIMIT $1`,
    [METRICS_SYNC_BATCH_SIZE],
  )

  for (const row of result.rows) {
    try {
      const connection = await resolveConnectionCreds(row.connection_id)
      if (!connection) continue
      const adapter = getAdapter(row.channel)
      const metrics = await adapter.fetchMetrics(connection, row.remote_post_id)
      await query(
        `INSERT INTO social_metric_snapshots (channel_post_id, impressions, reach, likes, comments, shares, clicks, raw_metrics)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          row.id,
          metrics.impressions ?? null,
          metrics.reach ?? null,
          metrics.likes ?? null,
          metrics.comments ?? null,
          metrics.shares ?? null,
          metrics.clicks ?? null,
          JSON.stringify(metrics.raw || {}),
        ],
      )
    } catch (error) {
      logger.warn(`[PromotionQueue] Metrics sync failed for channel post ${row.id}`, error)
    }
  }
}

async function processQueueTick(): Promise<void> {
  if (queueBusy) return
  queueBusy = true

  try {
    await promoteScheduledChannelPosts()
    await sweepStuckPublishingRows()

    const batch = await claimBatch()
    for (const row of batch) {
      await processChannelPost(row)
    }

    await reconcileCampaignStatuses(batch.map((r) => r.campaign_id))
    await syncMetrics()
  } catch (error) {
    logger.error('[PromotionQueue] Queue tick failed', error)
  } finally {
    queueBusy = false
  }
}

export function startPromotionQueueWorker(): void {
  if (queueStarted) return

  if (!isQueueEnabled()) {
    logger.info('[PromotionQueue] PROMOTION_QUEUE_ENABLED=false -- this instance will not publish. Exactly one deliberate instance should have this enabled.')
    return
  }

  queueStarted = true
  queueTimer = setInterval(() => {
    void processQueueTick()
  }, Math.max(5000, WORKER_INTERVAL_MS))

  void processQueueTick()

  logger.info(`[PromotionQueue] Worker started (interval=${Math.max(5000, WORKER_INTERVAL_MS)}ms, dryRunDefault=${isDryRunDefault()})`)
}

export function stopPromotionQueueWorker(): void {
  if (queueTimer) {
    clearInterval(queueTimer)
    queueTimer = null
  }
  queueStarted = false
}

// "Publish now" (promotion-campaign.controller.ts) does not call anything
// in this file directly -- it flips the selected DRAFT channel-post rows
// straight to QUEUED and returns immediately (never blocks the HTTP
// request on any social API call); the next scheduled tick, at most
// WORKER_INTERVAL_MS later, picks them up through this exact same
// claim/publish/reconcile pipeline. There is deliberately no second,
// separate "publish immediately" code path to keep in sync with this one.
export { processQueueTick as __processQueueTickForTests }

/** Test-only: syncMetrics self-throttles via module-level state that would
 * otherwise leak between test cases sharing this module instance. */
export function __resetMetricsSyncStateForTests(): void {
  lastMetricsSyncAt = 0
}
