// Seller earnings & payout ledger -- shared logic used by both the
// payment-succeeded webhook trigger (stripe.service.ts) and the
// seller-facing/admin-facing controllers that need to read a seller's
// balance and history. Mirrors affiliate.service.ts's role as shared
// logic for both checkout code and controllers.
//
// commission_rate has existed on seller_tier_config since migration 034
// but was never used for any money calculation anywhere in this codebase
// -- this file is the first real consumer of it.

import { query, getClient } from '../database/connection'
import logger from '../utils/logger'

export interface SellerPayoutSettings {
  fallbackHoldPeriodDays: number
  minPayoutAmount: number
  programEnabled: boolean
}

let cachedSettings: SellerPayoutSettings | null = null
let cachedSettingsAt = 0
const SETTINGS_CACHE_MS = 30_000 // short TTL -- an admin toggle should take effect within seconds, not be a stale-forever singleton read

export async function getSellerPayoutSettings(): Promise<SellerPayoutSettings> {
  if (cachedSettings && Date.now() - cachedSettingsAt < SETTINGS_CACHE_MS) {
    return cachedSettings
  }
  const result = await query(
    `SELECT fallback_hold_period_days, min_payout_amount, program_enabled
     FROM seller_payout_settings WHERE id = 1`,
  )
  const row = result.rows[0]
  cachedSettings = {
    fallbackHoldPeriodDays: Number(row?.fallback_hold_period_days ?? 30),
    minPayoutAmount: Number(row?.min_payout_amount ?? 0),
    programEnabled: row?.program_enabled !== false,
  }
  cachedSettingsAt = Date.now()
  return cachedSettings
}

const isSellerTiersEnabled = () =>
  String(process.env.ENABLE_SELLER_TIERS || 'false').toLowerCase() === 'true'

let cachedInfraReady: boolean | null = null

/**
 * Same graceful "infrastructure not ready" pattern as
 * seller.controller.ts's ensureSellerInfrastructure, but a plain boolean
 * (no Response object) -- this runs on every order's payment-succeeded
 * webhook now, not just from an HTTP request, so it must no-op cheaply
 * and safely wherever the migration/flag isn't live. Cached for the
 * process lifetime since a table either exists or doesn't -- unlike
 * settings, this never needs to change without a restart.
 */
export async function isSellerPayoutsEnabled(): Promise<boolean> {
  if (!isSellerTiersEnabled()) return false
  if (cachedInfraReady !== null) return cachedInfraReady
  const result = await query(`SELECT to_regclass('public.seller_earnings') AS regclass`)
  cachedInfraReady = Boolean(result.rows[0]?.regclass)
  return cachedInfraReady
}

interface SellerOrderItemRow {
  order_item_id: string
  total_price: string
  seller_profile_id: string
  tier: string
}

/**
 * Records one seller_earnings row per seller present in this order
 * (a cart can mix products from different sellers), each with its own
 * seller_earning_items audit rows. Idempotent on (order_id,
 * seller_profile_id) -- safe to call more than once for the same order,
 * which a Stripe webhook retry will do.
 *
 * Deliberately an exported, directly-testable function (unlike the
 * affiliate system's recordAffiliateEffectsForOrder, a private method on
 * StripeService) -- this money-splitting logic needs its own real test
 * coverage, not just an end-to-end webhook test.
 */
export async function recordSellerEarningsForOrder(orderId: string): Promise<void> {
  if (!(await isSellerPayoutsEnabled())) return

  const settings = await getSellerPayoutSettings()
  if (!settings.programEnabled) return

  const itemsResult = await query(
    `SELECT oi.id AS order_item_id, oi.total_price, p.seller_profile_id, sp.tier
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN seller_profiles sp ON sp.id = p.seller_profile_id
     WHERE oi.order_id = $1 AND p.seller_profile_id IS NOT NULL`,
    [orderId],
  )
  if (itemsResult.rows.length === 0) return

  const bySeller = new Map<string, { tier: string; items: SellerOrderItemRow[] }>()
  for (const row of itemsResult.rows as SellerOrderItemRow[]) {
    const group = bySeller.get(row.seller_profile_id)
    if (group) {
      group.items.push(row)
    } else {
      bySeller.set(row.seller_profile_id, { tier: row.tier, items: [row] })
    }
  }

  for (const [sellerProfileId, group] of bySeller) {
    const tierConfig = await query(
      `SELECT commission_rate FROM seller_tier_config WHERE tier = $1`,
      [group.tier],
    )
    const commissionRate = Number(tierConfig.rows[0]?.commission_rate ?? 15)
    const grossItemAmount = group.items.reduce((sum, item) => sum + Number(item.total_price), 0)
    const platformCommissionAmount = Math.round(grossItemAmount * (commissionRate / 100) * 100) / 100
    const sellerNetAmount = Math.round((grossItemAmount - platformCommissionAmount) * 100) / 100

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const earningResult = await client.query(
        `INSERT INTO seller_earnings
          (seller_profile_id, order_id, gross_item_amount, seller_tier_snapshot,
           commission_rate_snapshot, platform_commission_amount, seller_net_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (order_id, seller_profile_id) DO NOTHING
         RETURNING id`,
        [sellerProfileId, orderId, grossItemAmount, group.tier, commissionRate, platformCommissionAmount, sellerNetAmount],
      )

      const earning = earningResult.rows[0]
      if (earning) {
        for (const item of group.items) {
          await client.query(
            `INSERT INTO seller_earning_items (seller_earning_id, order_item_id, item_gross_amount)
             VALUES ($1, $2, $3)
             ON CONFLICT (order_item_id) DO NOTHING`,
            [earning.id, item.order_item_id, item.total_price],
          )
        }
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error(`Failed to record seller earnings for seller ${sellerProfileId} on order ${orderId}:`, error)
      throw error
    } finally {
      client.release()
    }
  }
}

export interface SellerEarningsSummary {
  pendingBalance: number
  confirmedUnpaidBalance: number
  lifetimePaid: number
  tier: string | null
  commissionRate: number | null
}

/**
 * confirmedUnpaidBalance/lifetimePaid are computed live from
 * seller_payout_ledger (SUM(delta_amount)), never a cached rollup column
 * -- same principle as store_credit_ledger, "to avoid an entire class of
 * rollup-drifted-from-reality bugs." pendingBalance is a separate figure
 * (not yet in the ledger at all -- it only enters the ledger once the
 * confirmation worker runs), shown for visibility only.
 */
export async function getSellerEarningsSummary(sellerProfileId: string): Promise<SellerEarningsSummary> {
  const [pendingResult, ledgerResult, tierResult] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(seller_net_amount), 0) AS pending
       FROM seller_earnings WHERE seller_profile_id = $1 AND status = 'pending'`,
      [sellerProfileId],
    ),
    query(
      `SELECT
         COALESCE(SUM(delta_amount), 0) AS unpaid_balance,
         COALESCE(SUM(delta_amount) FILTER (WHERE reason = 'payout_sent'), 0) AS lifetime_paid
       FROM seller_payout_ledger WHERE seller_profile_id = $1`,
      [sellerProfileId],
    ),
    query(
      `SELECT sp.tier, tc.commission_rate
       FROM seller_profiles sp
       JOIN seller_tier_config tc ON tc.tier = sp.tier
       WHERE sp.id = $1`,
      [sellerProfileId],
    ),
  ])

  return {
    pendingBalance: Number(pendingResult.rows[0]?.pending ?? 0),
    confirmedUnpaidBalance: Number(ledgerResult.rows[0]?.unpaid_balance ?? 0),
    // payout_sent rows are negative deltas (money leaving the unpaid
    // balance) -- lifetime paid is the positive magnitude of that.
    lifetimePaid: Math.abs(Number(ledgerResult.rows[0]?.lifetime_paid ?? 0)),
    tier: tierResult.rows[0]?.tier ?? null,
    commissionRate: tierResult.rows[0] ? Number(tierResult.rows[0].commission_rate) : null,
  }
}

export interface SellerLedgerEntry {
  id: string
  delta_amount: string
  reason: string
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

export async function getSellerPayoutLedger(
  sellerProfileId: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
): Promise<{ entries: SellerLedgerEntry[]; page: number; hasMore: boolean }> {
  const offset = (page - 1) * limit
  const result = await query(
    `SELECT id, delta_amount, reason, reference_type, reference_id, created_at
     FROM seller_payout_ledger
     WHERE seller_profile_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [sellerProfileId, limit + 1, offset],
  )
  const entries = result.rows as SellerLedgerEntry[]
  const hasMore = entries.length > limit
  return { entries: entries.slice(0, limit), page, hasMore }
}
