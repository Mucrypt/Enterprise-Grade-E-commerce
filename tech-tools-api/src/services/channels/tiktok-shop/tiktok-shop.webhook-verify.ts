/**
 * TikTok Shop webhook signature verification.
 *
 * Distinct from API request signing (tiktok-shop.signing.ts) -- this
 * verifies INBOUND webhook deliveries from TikTok Shop to
 * POST /api/v1/channels/webhook/tiktok-shop.
 *
 * Algorithm (sourced from official-domain search results plus
 * corroborating third-party technical write-ups -- re-verify against
 * Partner Center's own webhook-signature documentation before this is
 * ever relied on against real production traffic):
 *
 *   Authorization header (NO "Bearer " prefix) = hex-encoded
 *   HMAC-SHA256(key = app_secret, message = app_key + raw_request_body)
 *
 * CRITICAL, documented protocol limitation: there is no timestamp folded
 * into this signature, so it provides NO cryptographic replay protection
 * on its own -- a captured, validly-signed payload could be replayed
 * indefinitely and would still verify. This module deliberately does not
 * pretend otherwise. Replay/duplicate-processing defense for this system
 * lives entirely in channel_webhook_events.tts_notification_id's UNIQUE
 * constraint (see channel-webhook.controller.ts) -- a signature-valid but
 * already-seen notification id is still safely ignored.
 *
 * The raw, exact-as-received request body MUST be used for verification
 * -- never JSON.parse() first and re-serialize, since that can silently
 * change whitespace/key-order and invalidate a genuinely valid signature.
 */
import crypto from 'crypto'

export interface VerifyWebhookInput {
  appKey: string
  appSecret: string
  /** The exact raw request body bytes/string as received, before any JSON parsing. */
  rawBody: string
  /** The Authorization header value as received (no "Bearer " prefix expected). */
  authorizationHeader: string | undefined
}

export function verifyTikTokShopWebhookSignature({ appKey, appSecret, rawBody, authorizationHeader }: VerifyWebhookInput): boolean {
  if (!authorizationHeader) return false

  const expected = crypto.createHmac('sha256', appSecret).update(`${appKey}${rawBody}`).digest('hex')

  // Constant-time comparison -- a signature check that short-circuits on
  // the first mismatched byte leaks timing information an attacker could
  // use to guess the correct signature one byte at a time.
  const expectedBuffer = Buffer.from(expected, 'hex')
  const receivedBuffer = Buffer.from(authorizationHeader.trim(), 'hex')
  if (expectedBuffer.length !== receivedBuffer.length) return false

  try {
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  } catch {
    // timingSafeEqual throws if the inputs aren't valid equal-length
    // buffers (e.g. authorizationHeader wasn't valid hex) -- an
    // unverifiable signature is a rejected one, not a crash.
    return false
  }
}
