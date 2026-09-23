import { query } from '../../database/connection'
import logger from '../../utils/logger'
import { webSocketService } from '../websocket.service'
import * as ivs from './ivs.service'

export interface LiveSessionDTO {
  id: string
  sellerProfileId: string
  title: string
  status: 'scheduled' | 'live' | 'ended' | 'errored'
  ivsIngestEndpoint: string | null
  ivsPlaybackUrl: string | null
  thumbnailUrl: string | null
  scheduledStartAt: string | null
  startedAt: string | null
  endedAt: string | null
  viewerCountPeak: number
  createdAt: string
}

function toDTO(row: any): LiveSessionDTO {
  return {
    id: row.id,
    sellerProfileId: row.seller_profile_id,
    title: row.title,
    status: row.status,
    ivsIngestEndpoint: row.ivs_ingest_endpoint,
    ivsPlaybackUrl: row.ivs_playback_url,
    thumbnailUrl: row.thumbnail_url,
    scheduledStartAt: row.scheduled_start_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    viewerCountPeak: row.viewer_count_peak,
    createdAt: row.created_at,
  }
}

function liveRoom(sessionId: string): string {
  return `live:${sessionId}`
}

/**
 * Creates the session row AND its AWS IVS channel + chat room up front
 * (not deferred to "start") -- an IVS channel has no ongoing cost just
 * for existing (billing is per stream-minute), and creating it early
 * lets a seller configure OBS/Streamlabs with their stream key well
 * before they actually go live, which is how every real broadcaster
 * workflow works.
 */
export async function createSession(params: {
  sellerProfileId: string
  title: string
  scheduledStartAt?: string | null
}): Promise<LiveSessionDTO> {
  const channelName = `live-${params.sellerProfileId}-${Date.now()}`
  const channel = await ivs.createChannel(channelName)
  const chatRoom = await ivs.createChatRoom(channelName)

  const result = await query(
    `INSERT INTO live_sessions
      (seller_profile_id, title, status, ivs_channel_arn, ivs_ingest_endpoint,
       ivs_stream_key_arn, ivs_playback_url, ivs_chat_room_arn, scheduled_start_at)
     VALUES ($1, $2, 'scheduled', $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.sellerProfileId,
      params.title,
      channel.channelArn,
      channel.ingestEndpoint,
      channel.streamKeyArn,
      channel.playbackUrl,
      chatRoom.roomArn,
      params.scheduledStartAt || null,
    ],
  )

  return toDTO(result.rows[0])
}

/** The stream key value, fetched fresh from AWS (never stored) -- seller-only, checked by the caller. */
export async function getStreamKeyForSession(sessionId: string): Promise<string | null> {
  const result = await query(`SELECT ivs_stream_key_arn FROM live_sessions WHERE id = $1 LIMIT 1`, [sessionId])
  const arn = result.rows[0]?.ivs_stream_key_arn
  if (!arn) return null
  return ivs.getStreamKeyValue(arn)
}

/**
 * Optimistic transition when the seller confirms they've started
 * broadcasting in OBS/Streamlabs -- the real source of truth is AWS IVS
 * itself (reconciled by the EventBridge webhook and by getSessionForViewer's
 * own live poll), so this never fabricates viewer/stream state, only the
 * session's own status/started_at bookkeeping.
 */
export async function startSession(sessionId: string): Promise<LiveSessionDTO | null> {
  const result = await query(
    `UPDATE live_sessions
     SET status = 'live', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status IN ('scheduled', 'live')
     RETURNING *`,
    [sessionId],
  )
  const row = result.rows[0]
  if (!row) return null

  webSocketService.sendToRoom('mobile-app', 'live-session-started', { sessionId, title: row.title })
  webSocketService.sendToRoom('web-store', 'live-session-started', { sessionId, title: row.title })

  return toDTO(row)
}

/**
 * The real kill switch -- stops the AWS-side stream (so an ended
 * session can never keep broadcasting even if a client is misbehaving),
 * then records the session as ended with its final peak viewer count.
 * Used by both a seller's own "End stream" and admin's force-end.
 */
export async function endSession(
  sessionId: string,
  endedBy: 'seller' | 'admin' | 'webhook',
): Promise<LiveSessionDTO | null> {
  const sessionResult = await query(`SELECT * FROM live_sessions WHERE id = $1 LIMIT 1`, [sessionId])
  const session = sessionResult.rows[0]
  if (!session) return null
  if (session.status === 'ended') return toDTO(session)

  let finalViewerCount = session.viewer_count_peak
  try {
    const state = await ivs.getStreamState(session.ivs_channel_arn)
    finalViewerCount = Math.max(finalViewerCount, state.viewerCount)
  } catch (error) {
    logger.warn(`[Live] Could not poll final viewer count for session ${sessionId} before ending`, error)
  }

  try {
    await ivs.stopStream(session.ivs_channel_arn)
  } catch (error) {
    logger.error(`[Live] Failed to stop AWS IVS stream for session ${sessionId} (${endedBy}-initiated)`, error)
    // Still mark the session ended in our own records -- a viewer-facing
    // "this stream is over" beats leaving it stuck 'live' forever just
    // because the AWS call itself failed.
  }

  const result = await query(
    `UPDATE live_sessions
     SET status = 'ended', ended_at = CURRENT_TIMESTAMP, viewer_count_peak = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [sessionId, finalViewerCount],
  )
  const row = result.rows[0]

  webSocketService.sendToRoom(liveRoom(sessionId), 'live-session-ended', { sessionId, endedBy })
  logger.info(`[Live] Session ${sessionId} ended (${endedBy})`)

  return toDTO(row)
}

export async function pinProduct(sessionId: string, productId: string): Promise<void> {
  await query(
    `INSERT INTO live_session_products (live_session_id, product_id, is_pinned, pinned_at)
     VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
     ON CONFLICT (live_session_id, product_id)
     DO UPDATE SET is_pinned = TRUE, pinned_at = CURRENT_TIMESTAMP`,
    [sessionId, productId],
  )
  // Only one pinned product per session (enforced by the partial unique
  // index too -- this unpins any previous pin so the DB write above
  // doesn't race the constraint).
  await query(
    `UPDATE live_session_products SET is_pinned = FALSE
     WHERE live_session_id = $1 AND product_id != $2 AND is_pinned = TRUE`,
    [sessionId, productId],
  )

  const productResult = await query(
    `SELECT id, name, slug, base_price, sale_price FROM products WHERE id = $1 LIMIT 1`,
    [productId],
  )
  webSocketService.sendToRoom(liveRoom(sessionId), 'live-product-pinned', {
    sessionId,
    product: productResult.rows[0] || { id: productId },
  })
}

export async function unpinProduct(sessionId: string, productId: string): Promise<void> {
  await query(
    `UPDATE live_session_products SET is_pinned = FALSE
     WHERE live_session_id = $1 AND product_id = $2`,
    [sessionId, productId],
  )
  webSocketService.sendToRoom(liveRoom(sessionId), 'live-product-unpinned', { sessionId, productId })
}

/** Viewer-facing session detail -- includes a live AWS IVS poll (not just our own DB status) and a scoped chat token. */
export async function getSessionForViewer(
  sessionId: string,
  viewerUserId: string,
): Promise<{
  session: LiveSessionDTO
  isLive: boolean
  viewerCount: number
  pinnedProduct: any | null
  chatToken: string
  chatRoomArn: string
} | null> {
  const sessionResult = await query(`SELECT * FROM live_sessions WHERE id = $1 LIMIT 1`, [sessionId])
  const session = sessionResult.rows[0]
  if (!session) return null

  const [state, pinnedResult, chatToken] = await Promise.all([
    ivs.getStreamState(session.ivs_channel_arn).catch(() => ({ isLive: false, viewerCount: 0, startedAt: null })),
    query(
      `SELECT p.id, p.name, p.slug, p.base_price, p.sale_price
       FROM live_session_products lsp
       JOIN products p ON p.id = lsp.product_id
       WHERE lsp.live_session_id = $1 AND lsp.is_pinned = TRUE
       LIMIT 1`,
      [sessionId],
    ),
    ivs.createChatToken(session.ivs_chat_room_arn, viewerUserId, { isModerator: false }),
  ])

  return {
    session: toDTO(session),
    isLive: state.isLive,
    viewerCount: state.viewerCount,
    pinnedProduct: pinnedResult.rows[0] || null,
    chatToken: chatToken.token,
    chatRoomArn: session.ivs_chat_room_arn,
  }
}

/**
 * AWS IVS's EventBridge notifications identify a stream by its channel
 * ARN, not our internal session id -- this resolves that, for the
 * webhook handler only (live-webhook.controller.ts).
 */
export async function findSessionIdByChannelArn(channelArn: string): Promise<string | null> {
  const result = await query(
    `SELECT id FROM live_sessions WHERE ivs_channel_arn = $1 AND status != 'ended' LIMIT 1`,
    [channelArn],
  )
  return result.rows[0]?.id ?? null
}

export interface LiveSessionListItemDTO extends LiveSessionDTO {
  sellerDisplayName: string | null
  sellerHandle: string | null
}

/** "Who's live now" rail -- Discover feed's entry point into live shopping. */
export async function listLiveSessions(): Promise<LiveSessionListItemDTO[]> {
  const result = await query(
    `SELECT ls.*, sp.display_name AS seller_display_name, sp.handle AS seller_handle
     FROM live_sessions ls
     JOIN seller_profiles sp ON sp.id = ls.seller_profile_id
     WHERE ls.status = 'live'
     ORDER BY ls.started_at DESC`,
  )
  return result.rows.map((row) => ({
    ...toDTO(row),
    sellerDisplayName: row.seller_display_name,
    sellerHandle: row.seller_handle,
  }))
}
