/**
 * TikTok Shop webhook receiver. Direct structural clone of
 * payments/payment.controller.ts's handleWebhook -- the only other
 * inbound-webhook precedent in this codebase: raw-body signature
 * verification, then an INSERT ... ON CONFLICT DO NOTHING idempotency
 * gate, then event-type dispatch.
 *
 * CRITICAL, deliberate design constraint (per the founder's explicit
 * instruction and TikTok's own protocol limitation -- see
 * tiktok-shop.webhook-verify.ts's header comment): TikTok's webhook
 * signature has no replay protection, and TikTok's own docs reportedly
 * warn against branching on undocumented numeric/type fields. Every
 * handler below therefore only ever LOGS and FLAGS for human/worker
 * reconciliation -- it never auto-mutates order or inventory state
 * directly from a webhook payload alone. Real state changes happen
 * through the read/diff sync workers (channel-order-import.worker.ts,
 * channel-inventory-diff.worker.ts), which re-fetch and compare against
 * the channel's own API rather than trusting a push payload as ground
 * truth by itself.
 */
import { Request, Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { verifyTikTokShopWebhookSignature } from '../../../services/channels/tiktok-shop/tiktok-shop.webhook-verify'

interface TikTokShopWebhookPayload {
  tts_notification_id: string
  type?: number
  event_type?: string
  shop_id?: string
  data?: Record<string, unknown>
}

const KNOWN_EVENT_TYPES = new Set([
  'ORDER_STATUS_CHANGE',
  'RECIPIENT_ADDRESS_UPDATE',
  'PACKAGE_UPDATE',
  'PRODUCT_STATUS_CHANGE',
  'SELLER_DEAUTHORIZATION',
  'UPCOMING_AUTHORIZATION_EXPIRATION',
  'CANCELLATION_STATUS_CHANGE',
  'RETURN_STATUS_CHANGE',
  'REVERSE_STATUS_UPDATE',
  'PRODUCT_INFORMATION_CHANGE',
  'PRODUCT_CREATION',
  'PRODUCT_CATEGORY_CHANGE',
  'PRODUCT_AUDIT_STATUS_CHANGE',
  'INVOICE_STATUS_CHANGE',
])

export const handleTikTokShopWebhook = async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
  const appKey = process.env.CHANNEL_TIKTOK_SHOP_APP_KEY
  const appSecret = process.env.CHANNEL_TIKTOK_SHOP_APP_SECRET

  if (!appKey || !appSecret) {
    logger.error('TikTok Shop webhook received but CHANNEL_TIKTOK_SHOP_APP_KEY/_APP_SECRET are not configured')
    res.status(500).json({ error: 'Webhook not configured' })
    return
  }
  if (!req.rawBody) {
    logger.error('TikTok Shop webhook received without a captured raw body -- signature verification cannot proceed')
    res.status(400).json({ error: 'Missing raw request body' })
    return
  }

  const rawBody = req.rawBody.toString('utf8')
  const authorizationHeader = req.headers['authorization'] as string | undefined
  const signatureValid = verifyTikTokShopWebhookSignature({ appKey, appSecret, rawBody, authorizationHeader })

  let payload: TikTokShopWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    logger.error('TikTok Shop webhook body is not valid JSON')
    res.status(400).json({ error: 'Invalid payload' })
    return
  }

  if (!signatureValid) {
    logger.warn(`[TikTokShopWebhook] Rejected webhook with an invalid signature (notification_id=${payload.tts_notification_id})`)
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  if (!payload.tts_notification_id) {
    logger.warn('[TikTokShopWebhook] Webhook payload has no tts_notification_id -- cannot deduplicate, rejecting.')
    res.status(400).json({ error: 'Missing tts_notification_id' })
    return
  }

  const eventType = payload.event_type || 'UNKNOWN'
  const channelAccountId = await resolveChannelAccountId(payload.shop_id)

  // Idempotency gate -- channel_webhook_events.tts_notification_id is
  // UNIQUE. A signature has no replay protection of its own (see this
  // file's header comment), so this uniqueness constraint is the real
  // defense against processing the same delivery twice.
  const eventRecord = await query(
    `INSERT INTO channel_webhook_events (channel_account_id, tts_notification_id, event_type, payload, signature_valid)
     VALUES ($1, $2, $3, $4::jsonb, true)
     ON CONFLICT (tts_notification_id) DO NOTHING
     RETURNING id`,
    [channelAccountId, payload.tts_notification_id, eventType, JSON.stringify(payload)],
  )

  if (eventRecord.rowCount === 0) {
    logger.info(`[TikTokShopWebhook] Duplicate notification ignored: ${payload.tts_notification_id}`)
    res.json({ received: true, duplicate: true })
    return
  }

  const webhookEventId = eventRecord.rows[0].id

  if (!KNOWN_EVENT_TYPES.has(eventType)) {
    // An unrecognized event type is not an error -- TikTok can add new
    // topics, and this deployment may not subscribe to (or know about)
    // all of them. Logged and stored for visibility, never a 500.
    logger.info(`[TikTokShopWebhook] Received event_type "${eventType}" with no specific handler -- stored for visibility only.`)
    await query(`UPDATE channel_webhook_events SET processed_at = now() WHERE id = $1`, [webhookEventId])
    res.json({ received: true })
    return
  }

  try {
    // Every branch below only logs a channel_activity_log entry flagging
    // this event for the next sync-worker pass to reconcile against the
    // real API -- never a direct write to channel_orders/
    // channel_product_mappings/inventory from the webhook payload alone.
    if (channelAccountId) {
      await query(
        `INSERT INTO channel_activity_log (channel_account_id, actor_user_id, action, metadata)
         VALUES ($1, NULL, $2, $3)`,
        [channelAccountId, `WEBHOOK_${eventType}`, JSON.stringify({ ttsNotificationId: payload.tts_notification_id })],
      )
    }

    if (eventType === 'SELLER_DEAUTHORIZATION' && channelAccountId) {
      // The one event type worth an immediate, narrow state change --
      // the shop itself revoked TechTools' access. Marking the connection
      // as needing re-auth is not "trusting the webhook as ground truth
      // for commerce data," it's reacting to an authorization event about
      // the connection itself, which this deployment has no other way to
      // learn about until the next API call fails.
      await query(
        `UPDATE commerce_channel_accounts SET status = 'NEEDS_CREDENTIALS', last_error = 'Seller deauthorized this connection (via webhook).', updated_at = now() WHERE id = $1`,
        [channelAccountId],
      )
    }

    await query(`UPDATE channel_webhook_events SET processed_at = now() WHERE id = $1`, [webhookEventId])
    res.json({ received: true })
  } catch (error) {
    logger.error('[TikTokShopWebhook] Error processing webhook event:', error)
    await query(`UPDATE channel_webhook_events SET processing_error = $2 WHERE id = $1`, [
      webhookEventId,
      error instanceof Error ? error.message : String(error),
    ])
    // Still acknowledge receipt -- a webhook signature we already accepted
    // and durably recorded should not be redelivered forever just because
    // our own downstream bookkeeping (the activity log insert, etc.)
    // failed. Reconciliation happens via the sync workers regardless.
    res.json({ received: true, processingError: true })
  }
}

async function resolveChannelAccountId(shopId: string | undefined): Promise<string | null> {
  if (!shopId) return null
  const result = await query(`SELECT id FROM commerce_channel_accounts WHERE external_shop_id = $1`, [shopId])
  return result.rows[0]?.id ?? null
}
