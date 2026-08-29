// Affiliate / referral program -- shared logic used by both the
// affiliates.controller.ts self-service/admin endpoints and the checkout
// controllers (order.controller.ts) that need to resolve a referral code
// into a real affiliate at the moment an order is placed.

import { query } from '../database/connection'
import logger from '../utils/logger'

export interface AffiliateSettings {
  commissionRatePercent: number
  holdPeriodDays: number
  fallbackHoldPeriodDays: number
  minPayoutAmount: number
  programEnabled: boolean
}

let cachedSettings: AffiliateSettings | null = null
let cachedSettingsAt = 0
const SETTINGS_CACHE_MS = 30_000 // short TTL -- an admin rate change should take effect within seconds, not be a stale-forever singleton read

export async function getAffiliateSettings(): Promise<AffiliateSettings> {
  if (cachedSettings && Date.now() - cachedSettingsAt < SETTINGS_CACHE_MS) {
    return cachedSettings
  }
  const result = await query(
    `SELECT commission_rate_percent, hold_period_days, fallback_hold_period_days,
            min_payout_amount, program_enabled
     FROM affiliate_settings WHERE id = 1`,
  )
  const row = result.rows[0]
  cachedSettings = {
    commissionRatePercent: Number(row?.commission_rate_percent ?? 10),
    holdPeriodDays: Number(row?.hold_period_days ?? 14),
    fallbackHoldPeriodDays: Number(row?.fallback_hold_period_days ?? 30),
    minPayoutAmount: Number(row?.min_payout_amount ?? 0),
    programEnabled: row?.program_enabled !== false,
  }
  cachedSettingsAt = Date.now()
  return cachedSettings
}

/**
 * Self-referral prevention -- the primary fraud control for a program
 * where enrollment is automatic and commission has real cash value.
 * Checked on BOTH the authenticated user id (an affiliate buying through
 * their own link while logged in) AND email (case-insensitive -- covers
 * guest checkout with the affiliate's own email, or a second account
 * sharing it). A resolution failure of any kind -- unknown code, suspended
 * affiliate, self-referral -- returns null and NEVER errors checkout;
 * the buyer just doesn't get attributed to anyone.
 */
export async function resolveAffiliateForCheckout(
  referralCode: string | undefined | null,
  buyerEmail: string | undefined | null,
  buyerUserId: string | undefined | null,
): Promise<string | null> {
  if (!referralCode || typeof referralCode !== 'string') return null

  try {
    const settings = await getAffiliateSettings()
    if (!settings.programEnabled) return null

    const result = await query(
      `SELECT ap.id AS affiliate_id, ap.user_id AS owner_user_id, u.email AS owner_email
       FROM affiliate_profiles ap
       JOIN users u ON u.id = ap.user_id
       WHERE ap.referral_code = $1 AND ap.status = 'active'`,
      [referralCode.trim().toUpperCase()],
    )
    const affiliate = result.rows[0]
    if (!affiliate) return null

    if (buyerUserId && String(affiliate.owner_user_id) === String(buyerUserId)) {
      return null // authenticated self-purchase
    }
    if (buyerEmail && String(affiliate.owner_email).toLowerCase() === buyerEmail.toLowerCase()) {
      return null // guest checkout (or matching account email) using their own code
    }
    return affiliate.affiliate_id as string
  } catch (error) {
    // A referral-resolution failure must never break checkout -- log and
    // proceed with no attribution, same as an unknown/expired code.
    logger.warn('resolveAffiliateForCheckout failed, proceeding without attribution:', error)
    return null
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I -- avoids visually-ambiguous codes in a shared link

function randomCodeSuffix(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

function codePrefixFromName(firstName: string | null | undefined): string {
  const cleaned = (firstName || '').toUpperCase().replace(/[^A-Z]/g, '')
  return (cleaned || 'FRIEND').slice(0, 8)
}

/**
 * Get-or-create a user's affiliate profile. `user_id UNIQUE` makes this a
 * single INSERT ... ON CONFLICT DO NOTHING with a follow-up SELECT on
 * conflict -- no race window between an existence check and the insert.
 */
export async function getOrCreateAffiliateProfile(userId: string): Promise<{
  id: string
  referralCode: string
  status: string
}> {
  const existing = await query(
    `SELECT id, referral_code, status FROM affiliate_profiles WHERE user_id = $1`,
    [userId],
  )
  if (existing.rows[0]) {
    return {
      id: existing.rows[0].id,
      referralCode: existing.rows[0].referral_code,
      status: existing.rows[0].status,
    }
  }

  const userResult = await query('SELECT first_name FROM users WHERE id = $1', [userId])
  const prefix = codePrefixFromName(userResult.rows[0]?.first_name)

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${prefix}${randomCodeSuffix(4)}`.slice(0, 20)
    const inserted = await query(
      `INSERT INTO affiliate_profiles (user_id, referral_code)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id, referral_code, status`,
      [userId, code],
    )
    if (inserted.rows[0]) {
      return {
        id: inserted.rows[0].id,
        referralCode: inserted.rows[0].referral_code,
        status: inserted.rows[0].status,
      }
    }
    // Either the referral_code collided (retry with a new suffix) or a
    // concurrent request already created this user's profile (re-select).
    const raceCheck = await query(
      `SELECT id, referral_code, status FROM affiliate_profiles WHERE user_id = $1`,
      [userId],
    )
    if (raceCheck.rows[0]) {
      return {
        id: raceCheck.rows[0].id,
        referralCode: raceCheck.rows[0].referral_code,
        status: raceCheck.rows[0].status,
      }
    }
  }
  throw new Error('Failed to generate a unique referral code after 5 attempts')
}

export async function getStoreCreditBalance(userId: string): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(delta_amount), 0) AS balance FROM store_credit_ledger WHERE user_id = $1`,
    [userId],
  )
  return Number(result.rows[0]?.balance || 0)
}
