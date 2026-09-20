// =====================================================
// Closes the gap where activating business mode and onboarding as a
// seller could diverge into inconsistent states: a user who only ever
// called POST /users/business-mode/activate ended up with
// is_business_account=true and a creator_profiles row, but NO
// seller_profiles row at all -- which then failed
// getCreatorAccessContext's approval check and updateCreatorProduct's
// join-based lookup with a confusing "Creator profile not found".
//
// Every function here is idempotent (select-then-insert, never
// overwrites existing data) so calling either activateBusinessMode or
// onboardSeller, any number of times, in either order, converges on the
// same consistent state: is_business_account=true, one creator_profiles
// row, one seller_profiles row.
// =====================================================

import { query } from '../database/connection'
import logger from '../utils/logger'
import type { TransitionActor } from './seller-lifecycle.service'
import { appendSellerAuditLog } from './seller-lifecycle.service'

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const tableExists = async (tableName: string) => {
  const result = await query(`SELECT to_regclass($1) AS regclass`, [`public.${tableName}`])
  return Boolean(result.rows[0]?.regclass)
}

export async function ensureBusinessModeActivated(params: {
  userId: string
  source: string
  actor: TransitionActor
  companyName?: string
  businessType?: string
}): Promise<void> {
  const current = await query(`SELECT is_business_account FROM users WHERE id = $1 LIMIT 1`, [
    params.userId,
  ])
  if (current.rows.length === 0) {
    throw new Error('User not found')
  }
  if (current.rows[0].is_business_account) {
    return
  }

  await query(
    `UPDATE users
     SET is_business_account = true,
         business_mode_activated_at = COALESCE(business_mode_activated_at, CURRENT_TIMESTAMP),
         business_mode_source = COALESCE(business_mode_source, $1),
         company_name = COALESCE($2, company_name),
         business_type = COALESCE($3, business_type),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [params.source, params.companyName || null, params.businessType || null, params.userId],
  )

  const auditReady = await tableExists('user_business_mode_audit')
  if (auditReady) {
    await query(
      `INSERT INTO user_business_mode_audit (user_id, action, metadata)
       VALUES ($1, 'activate_business_mode', $2::jsonb)`,
      [params.userId, JSON.stringify({ source: params.source, via: 'reconciliation' })],
    ).catch((error) => logger.warn('Failed to write user_business_mode_audit', error))
  }
}

export async function ensureCreatorProfileForUser(params: {
  userId: string
  handle?: string
  displayName?: string
}): Promise<Record<string, unknown> | null> {
  const creatorTableReady = await tableExists('creator_profiles')
  if (!creatorTableReady) return null

  const existing = await query(
    `SELECT id, user_id, handle, display_name, verification_status, is_public, created_at
     FROM creator_profiles WHERE user_id = $1 LIMIT 1`,
    [params.userId],
  )
  if (existing.rows.length > 0) {
    return existing.rows[0]
  }

  const userResult = await query(
    `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
    [params.userId],
  )
  const user = userResult.rows[0] || {}

  const preferredHandle =
    String(params.handle || '').trim() ||
    String(user.email || '').split('@')[0] ||
    `${user.first_name || ''}-${user.last_name || ''}`

  const base = toSlug(preferredHandle).slice(0, 60) || 'creator'
  let normalizedHandle = base
  for (let index = 0; index < 20; index++) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`
    const taken = await query(`SELECT id FROM creator_profiles WHERE handle = $1 LIMIT 1`, [candidate])
    if (taken.rows.length === 0) {
      normalizedHandle = candidate
      break
    }
    normalizedHandle = `${base}-${Date.now()}`
  }

  const resolvedDisplayName =
    String(params.displayName || '').trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    normalizedHandle

  const created = await query(
    `INSERT INTO creator_profiles (user_id, handle, display_name, verification_status, is_public, updated_at)
     VALUES ($1, $2, $3, 'pending', true, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING id, user_id, handle, display_name, verification_status, is_public, created_at`,
    [params.userId, normalizedHandle, resolvedDisplayName],
  )

  if (created.rows.length > 0) {
    return created.rows[0]
  }

  // Lost a race with a concurrent request -- re-select the row the
  // other request just inserted rather than erroring.
  const reselect = await query(
    `SELECT id, user_id, handle, display_name, verification_status, is_public, created_at
     FROM creator_profiles WHERE user_id = $1 LIMIT 1`,
    [params.userId],
  )
  return reselect.rows[0] || null
}

export async function ensureSellerProfileForUser(params: {
  userId: string
  actor: TransitionActor
  source: string
}): Promise<Record<string, unknown>> {
  const existing = await query(`SELECT * FROM seller_profiles WHERE user_id = $1 LIMIT 1`, [
    params.userId,
  ])
  if (existing.rows.length > 0) {
    return existing.rows[0]
  }

  const unverifiedConfig = await query(
    `SELECT max_active_listings, max_product_price FROM seller_tier_config WHERE tier = 'unverified' LIMIT 1`,
  )
  const config = unverifiedConfig.rows[0] || { max_active_listings: 5, max_product_price: 99.99 }

  const inserted = await query(
    `INSERT INTO seller_profiles (
       user_id, tier, verification_status, account_status, onboarding_status, store_status,
       max_active_listings, max_product_price
     )
     VALUES ($1, 'unverified', 'NOT_STARTED', 'DRAFT', 'IN_PROGRESS', 'DRAFT', $2, $3)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [params.userId, config.max_active_listings, config.max_product_price],
  )

  if (inserted.rows.length > 0) {
    await appendSellerAuditLog({
      profileId: inserted.rows[0].id,
      userId: params.userId,
      actorId: params.actor.actorId,
      action: 'seller_profile_auto_created',
      newState: { tier: 'unverified', verificationStatus: 'NOT_STARTED' },
      details: { source: params.source },
      ip: params.actor.ip,
      userAgent: params.actor.userAgent,
    })
    return inserted.rows[0]
  }

  const reselect = await query(`SELECT * FROM seller_profiles WHERE user_id = $1 LIMIT 1`, [
    params.userId,
  ])
  return reselect.rows[0]
}
