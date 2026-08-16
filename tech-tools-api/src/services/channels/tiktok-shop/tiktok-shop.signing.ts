/**
 * TikTok Shop Partner Center API request signing.
 *
 * Distinct from webhook signature verification (tiktok-shop.webhook-verify.ts)
 * -- TikTok Shop uses two different HMAC schemes for two different
 * purposes. This one signs every OUTBOUND request TechTools makes to the
 * TikTok Shop API gateway (open-api.tiktokglobalshop.com).
 *
 * Algorithm (sourced from TikTok Shop Partner Center's own documentation
 * domain plus corroborating third-party integration guides -- the docs
 * site itself is a JS-rendered SPA that only returns truncated content to
 * automated fetch tools, so this has NOT been verified against a raw
 * primary-source code sample. Re-verify against real Partner Center
 * "Call your first API" / signing-spec pages, and ideally real test
 * vectors, before this is ever used against a live TikTok Shop app --
 * see docs/TIKTOK-SHOP-COMMERCE-ARCHITECTURE.md):
 *
 *   1. Take every query parameter EXCEPT `sign` and `access_token`.
 *   2. Sort them alphabetically by key.
 *   3. Concatenate as key+value pairs with no separators
 *      (e.g. "app_key123timestamp456...").
 *   4. Wrap: app_secret + <concatenated string> + [request body if
 *      Content-Type is JSON] + app_secret.
 *   5. HMAC-SHA256, keyed with app_secret, over that wrapped string.
 *   6. Hex-encode the digest and pass it as the `sign` query parameter on
 *      the actual request.
 */
import crypto from 'crypto'

export interface SignRequestInput {
  appSecret: string
  /** Every query parameter that will be sent, including app_key/timestamp/shop_cipher/access_token -- this function excludes `sign`/`access_token` from the signed string itself, per the algorithm above. */
  queryParams: Record<string, string>
  /** Raw JSON request body string, if this is a JSON POST -- omitted (not included in the signed string) for GET/no-body requests. */
  jsonBody?: string
}

const EXCLUDED_FROM_SIGNATURE = new Set(['sign', 'access_token'])

export function buildSortedSignatureBase(queryParams: Record<string, string>): string {
  return Object.keys(queryParams)
    .filter((key) => !EXCLUDED_FROM_SIGNATURE.has(key))
    .sort()
    .map((key) => `${key}${queryParams[key]}`)
    .join('')
}

export function signTikTokShopRequest({ appSecret, queryParams, jsonBody }: SignRequestInput): string {
  const sortedParams = buildSortedSignatureBase(queryParams)
  const message = `${appSecret}${sortedParams}${jsonBody ?? ''}${appSecret}`
  return crypto.createHmac('sha256', appSecret).update(message).digest('hex')
}
