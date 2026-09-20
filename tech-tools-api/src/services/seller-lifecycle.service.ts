// =====================================================
// The single source of truth for every seller status transition.
//
// Before this file, three independently-coded admin paths
// (approveSellerVerificationRequest / grantSellerAccess+setSellerTier /
// setSellerCreatorAccess, all in admin/sellers.controller.ts) each
// wrote seller_profiles.{tier,verification_status} and
// users.is_business_account directly, each with its own copy-pasted
// audit-log helper (a third copy lived in creator.controller.ts). One
// of them -- setSellerTier -- silently auto-approved verification as a
// side effect of a tier change, which is exactly the "tier must never
// imply identity approval" conflation this service exists to end.
//
// Every write to seller_profiles.{account_status, store_status, tier,
// verification_status} or seller_verification_requests.status must go
// through a function in this file. Controllers become thin wrappers:
// parse the request, call a function here, map a thrown error to an
// HTTP status, return the result.
// =====================================================

import { PoolClient } from 'pg'
import { getClient, query as dbQuery } from '../database/connection'
import logger from '../utils/logger'
import { NotificationService } from './notification.service'
import { evaluateStoreReadiness } from './seller-lifecycle-query.service'

export type SellerAccountStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'CLOSED'

export type SellerStoreStatus = 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'SUSPENDED' | 'CLOSED'

export type SellerOnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED'

export type SellerTier = 'unverified' | 'basic' | 'trusted' | 'pro'

export interface TransitionActor {
  actorId: string | null
  isSystem?: boolean
  ip?: string | null
  userAgent?: string | null
}

export interface TransitionResult<T = Record<string, unknown>> {
  sellerProfile: T
  verificationRequest?: Record<string, unknown> | null
  noop: boolean
}

export class IllegalTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`Cannot transition ${entity} from "${from}" to "${to}"`)
    this.name = 'IllegalTransitionError'
  }
}

export class SelfApprovalError extends Error {
  constructor() {
    super('A seller cannot approve, reject, or otherwise decide their own application')
    this.name = 'SelfApprovalError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

type QueryRunner = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }

// -----------------------------------------------------------------
// Audit log -- the ONE writer, replacing the three duplicated
// appendAuditLog-style helpers this service supersedes.
// -----------------------------------------------------------------
export async function appendSellerAuditLog(
  options: {
    profileId: string
    userId: string
    actorId: string | null
    action: string
    previousState?: Record<string, unknown> | null
    newState?: Record<string, unknown> | null
    details?: Record<string, unknown> | null
    ip?: string | null
    userAgent?: string | null
  },
  client?: QueryRunner,
): Promise<void> {
  const runner = client || { query: dbQuery }
  try {
    await runner.query(
      `INSERT INTO seller_audit_log
        (seller_profile_id, user_id, actor_id, action, previous_state, new_state, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)`,
      [
        options.profileId,
        options.userId,
        options.actorId,
        options.action,
        options.previousState ? JSON.stringify(options.previousState) : null,
        options.newState ? JSON.stringify(options.newState) : null,
        options.details ? JSON.stringify(options.details) : null,
        options.ip || null,
        options.userAgent || null,
      ],
    )
  } catch (error) {
    // Audit logging must never block the underlying business
    // transition -- matches the fail-open convention already
    // established by every audit helper this service replaces.
    logger.warn('Failed to append seller audit log', error)
  }
}

async function notifySeller(params: {
  userId: string
  type: string
  title: string
  message: string
  actionUrl?: string
}): Promise<void> {
  try {
    await NotificationService.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl || '/seller-hub',
      sendEmail: true,
    })
  } catch (error) {
    // Same fail-open principle as audit logging: a notification
    // failure must never roll back or block a real status change.
    logger.warn('Failed to notify seller of lifecycle event', error)
  }
}

// -----------------------------------------------------------------
// Account status -- fixed adjacency map. Same-state calls are
// idempotent no-ops (no audit/notification noise on a repeated safe
// request). Everything else not listed is illegal.
// -----------------------------------------------------------------
const ACCOUNT_STATUS_TRANSITIONS: Record<SellerAccountStatus, SellerAccountStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'ACTIVE', 'CLOSED'], // ACTIVE reachable directly for the admin grant-access bootstrap path
  PENDING_REVIEW: ['ACTIVE', 'REJECTED', 'CLOSED'],
  ACTIVE: ['RESTRICTED', 'SUSPENDED', 'CLOSED'],
  RESTRICTED: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
  SUSPENDED: ['ACTIVE', 'RESTRICTED', 'CLOSED'],
  REJECTED: ['PENDING_REVIEW', 'CLOSED'],
  CLOSED: [],
}

export async function setSellerAccountStatus(params: {
  sellerProfileId: string
  toStatus: SellerAccountStatus
  actor: TransitionActor
  reason?: string
  action?: string
}): Promise<TransitionResult> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const current = await client.query(
      `SELECT * FROM seller_profiles WHERE id = $1 FOR UPDATE`,
      [params.sellerProfileId],
    )
    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Seller profile not found')
    }
    const before = current.rows[0]
    const fromStatus = before.account_status as SellerAccountStatus

    if (fromStatus === params.toStatus) {
      await client.query('ROLLBACK')
      return { sellerProfile: before, noop: true }
    }

    if (!ACCOUNT_STATUS_TRANSITIONS[fromStatus]?.includes(params.toStatus)) {
      await client.query('ROLLBACK')
      throw new IllegalTransitionError('seller account status', fromStatus, params.toStatus)
    }

    const updated = await client.query(
      `UPDATE seller_profiles
       SET account_status = $1,
           account_status_updated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [params.toStatus, params.sellerProfileId],
    )
    const after = updated.rows[0]

    await appendSellerAuditLog(
      {
        profileId: params.sellerProfileId,
        userId: before.user_id,
        actorId: params.actor.actorId,
        action: params.action || 'seller_account_status_changed',
        previousState: { accountStatus: fromStatus },
        newState: { accountStatus: params.toStatus },
        details: { reason: params.reason || null },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      client,
    )

    await client.query('COMMIT')
    return { sellerProfile: after, noop: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

// -----------------------------------------------------------------
// Store status. LIVE is only reachable when evaluateStoreReadiness()
// says the seller is eligible. SUSPENDED is a valid target here (so
// suspendSellerAccount below can compose it in the same transaction
// as the account-status change) but the admin-facing store-status
// ROUTE's Joi schema deliberately excludes 'SUSPENDED' as a
// caller-supplied value -- only the suspend/restrict code paths in
// this file ever pass it.
// -----------------------------------------------------------------
const STORE_STATUS_TRANSITIONS: Record<SellerStoreStatus, SellerStoreStatus[]> = {
  DRAFT: ['READY', 'LIVE', 'SUSPENDED', 'CLOSED'],
  READY: ['LIVE', 'DRAFT', 'SUSPENDED', 'CLOSED'],
  LIVE: ['PAUSED', 'DRAFT', 'SUSPENDED', 'CLOSED'],
  PAUSED: ['LIVE', 'DRAFT', 'SUSPENDED', 'CLOSED'],
  SUSPENDED: ['DRAFT', 'READY', 'LIVE', 'CLOSED'],
  CLOSED: [],
}

export async function setStoreStatus(
  params: {
    sellerProfileId: string
    toStatus: SellerStoreStatus
    actor: TransitionActor
    reason?: string
  },
  client?: PoolClient,
): Promise<TransitionResult> {
  const runner = client || (await getClient())
  const ownTransaction = !client
  try {
    if (ownTransaction) await runner.query('BEGIN')

    const current = await runner.query(
      `SELECT * FROM seller_profiles WHERE id = $1 ${ownTransaction ? 'FOR UPDATE' : ''}`,
      [params.sellerProfileId],
    )
    if (current.rows.length === 0) {
      if (ownTransaction) await runner.query('ROLLBACK')
      throw new NotFoundError('Seller profile not found')
    }
    const before = current.rows[0]
    const fromStatus = before.store_status as SellerStoreStatus

    if (fromStatus === params.toStatus) {
      if (ownTransaction) await runner.query('ROLLBACK')
      return { sellerProfile: before, noop: true }
    }

    if (!STORE_STATUS_TRANSITIONS[fromStatus]?.includes(params.toStatus)) {
      if (ownTransaction) await runner.query('ROLLBACK')
      throw new IllegalTransitionError('store status', fromStatus, params.toStatus)
    }

    if (params.toStatus === 'LIVE') {
      const readiness = await evaluateStoreReadiness(params.sellerProfileId)
      if (!readiness.eligible) {
        if (ownTransaction) await runner.query('ROLLBACK')
        throw new IllegalTransitionError(
          'store status',
          fromStatus,
          `LIVE (blocked: ${readiness.missing.join(', ')})`,
        )
      }
    }

    const updated = await runner.query(
      `UPDATE seller_profiles
       SET store_status = $1,
           store_status_updated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [params.toStatus, params.sellerProfileId],
    )

    await appendSellerAuditLog(
      {
        profileId: params.sellerProfileId,
        userId: before.user_id,
        actorId: params.actor.actorId,
        action: 'seller_store_status_changed',
        previousState: { storeStatus: fromStatus },
        newState: { storeStatus: params.toStatus },
        details: { reason: params.reason || null },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      runner,
    )

    if (ownTransaction) await runner.query('COMMIT')
    return { sellerProfile: updated.rows[0], noop: false }
  } catch (error) {
    if (ownTransaction) await runner.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    if (ownTransaction) (runner as PoolClient).release()
  }
}

// -----------------------------------------------------------------
// Onboarding status
// -----------------------------------------------------------------
const ONBOARDING_TRANSITIONS: Record<SellerOnboardingStatus, SellerOnboardingStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUBMITTED'],
  SUBMITTED: ['IN_PROGRESS', 'COMPLETED'], // IN_PROGRESS: re-opened by "more information required"
  COMPLETED: ['IN_PROGRESS'], // re-opened for a future tier upgrade / reverification case
}

export async function transitionOnboardingStatus(
  params: { sellerProfileId: string; toStatus: SellerOnboardingStatus; actor: TransitionActor },
  client?: PoolClient,
): Promise<TransitionResult> {
  const runner = client || (await getClient())
  const ownTransaction = !client
  try {
    if (ownTransaction) await runner.query('BEGIN')

    const current = await runner.query(
      `SELECT * FROM seller_profiles WHERE id = $1 ${ownTransaction ? 'FOR UPDATE' : ''}`,
      [params.sellerProfileId],
    )
    if (current.rows.length === 0) {
      if (ownTransaction) await runner.query('ROLLBACK')
      throw new NotFoundError('Seller profile not found')
    }
    const before = current.rows[0]
    const fromStatus = before.onboarding_status as SellerOnboardingStatus

    if (fromStatus === params.toStatus) {
      if (ownTransaction) await runner.query('ROLLBACK')
      return { sellerProfile: before, noop: true }
    }

    if (!ONBOARDING_TRANSITIONS[fromStatus]?.includes(params.toStatus)) {
      if (ownTransaction) await runner.query('ROLLBACK')
      throw new IllegalTransitionError('onboarding status', fromStatus, params.toStatus)
    }

    const updated = await runner.query(
      `UPDATE seller_profiles SET onboarding_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [params.toStatus, params.sellerProfileId],
    )

    if (ownTransaction) await runner.query('COMMIT')
    return { sellerProfile: updated.rows[0], noop: false }
  } catch (error) {
    if (ownTransaction) await runner.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    if (ownTransaction) (runner as PoolClient).release()
  }
}

// -----------------------------------------------------------------
// Submission -- row-locks the profile before checking/creating a
// review case, closing the race in the old requestSellerVerification
// (two concurrent submissions could both pass the "no pending
// request" check before either INSERT landed). Reuses an existing
// 'more_information_required' case on resubmission instead of
// inserting a duplicate -- the DB-level unique partial index from
// migration 075 is the last-resort backstop if this logic is ever
// bypassed.
// -----------------------------------------------------------------
export async function submitSellerApplication(params: {
  sellerProfileId: string
  actor: TransitionActor
  requestedTier?: SellerTier
}): Promise<TransitionResult> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const profileResult = await client.query(
      `SELECT * FROM seller_profiles WHERE id = $1 FOR UPDATE`,
      [params.sellerProfileId],
    )
    if (profileResult.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Seller profile not found')
    }
    const profile = profileResult.rows[0]

    // FOR UPDATE on the profile row (above) is the serialization point
    // that prevents two concurrent submissions from both passing this
    // check: a second concurrent call for the SAME sellerProfileId
    // blocks on that lock until the first commits, then sees the
    // now-inserted case here and reuses it instead of duplicating it.
    // The DB-level unique partial index on (seller_profile_id) WHERE
    // status IN ('PENDING','MORE_INFORMATION_REQUIRED') (migration 075)
    // is the last-resort backstop if this ever runs outside a
    // transaction that holds that lock.
    const existingCase = await client.query(
      `SELECT * FROM seller_verification_requests
       WHERE seller_profile_id = $1 AND status IN ('PENDING', 'MORE_INFORMATION_REQUIRED')
       LIMIT 1`,
      [params.sellerProfileId],
    )

    const requestedTier = params.requestedTier || profile.tier || 'basic'
    let requestRow: Record<string, unknown>

    if (existingCase.rows.length > 0) {
      // Resubmission after "more information required" -- reuse the
      // case rather than creating a second one for the same seller.
      const reused = await client.query(
        `UPDATE seller_verification_requests
         SET status = 'PENDING', requested_tier = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [requestedTier, existingCase.rows[0].id],
      )
      requestRow = reused.rows[0]
    } else {
      const caseType = profile.account_status === 'ACTIVE' ? 'tier_upgrade' : 'initial_onboarding'
      const inserted = await client.query(
        `INSERT INTO seller_verification_requests
          (user_id, seller_profile_id, requested_tier, status, case_type)
         VALUES ($1, $2, $3, 'PENDING', $4)
         RETURNING *`,
        [profile.user_id, params.sellerProfileId, requestedTier, caseType],
      )
      requestRow = inserted.rows[0]
    }

    await client.query(
      `UPDATE seller_profiles
       SET verification_status = 'PENDING_REVIEW', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [params.sellerProfileId],
    )

    await transitionOnboardingStatus(
      { sellerProfileId: params.sellerProfileId, toStatus: 'SUBMITTED', actor: params.actor },
      client,
    ).catch((error) => {
      // Already SUBMITTED (e.g. a resubmission) is a legitimate no-op,
      // not a failure -- transitionOnboardingStatus's own idempotency
      // check handles that; only re-throw genuine illegal transitions.
      if (!(error instanceof IllegalTransitionError)) throw error
    })

    await appendSellerAuditLog(
      {
        profileId: params.sellerProfileId,
        userId: profile.user_id,
        actorId: params.actor.actorId,
        action: 'seller_verification_requested',
        previousState: { verificationStatus: profile.verification_status },
        newState: { verificationStatus: 'PENDING_REVIEW', requestedTier },
        details: { requestId: requestRow.id },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      client,
    )

    await client.query('COMMIT')

    await notifySeller({
      userId: profile.user_id,
      type: 'seller_application_submitted',
      title: 'Your seller application was submitted',
      message: "We've received your application and it's now in the review queue.",
    })

    return { sellerProfile: profile, verificationRequest: requestRow, noop: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

// -----------------------------------------------------------------
// Approve / reject / request-more-info / expire
// -----------------------------------------------------------------
export async function approveVerification(params: {
  requestId: string
  actor: TransitionActor
  grantedTier?: SellerTier
  reason?: string
  markPhoneVerified?: boolean
  markPaymentMethodVerified?: boolean
}): Promise<TransitionResult> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const requestResult = await client.query(
      `SELECT svr.*, sp.tier AS current_tier, sp.account_status AS current_account_status
       FROM seller_verification_requests svr
       INNER JOIN seller_profiles sp ON sp.id = svr.seller_profile_id
       WHERE svr.id = $1
       FOR UPDATE OF svr`,
      [params.requestId],
    )
    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Verification request not found')
    }
    const request = requestResult.rows[0]

    if (params.actor.actorId && params.actor.actorId === request.user_id) {
      await client.query('ROLLBACK')
      throw new SelfApprovalError()
    }

    if (request.status === 'APPROVED') {
      await client.query('ROLLBACK')
      return { sellerProfile: null as any, verificationRequest: request, noop: true }
    }
    if (request.status !== 'PENDING' && request.status !== 'MORE_INFORMATION_REQUIRED') {
      await client.query('ROLLBACK')
      throw new IllegalTransitionError('verification request', request.status, 'APPROVED')
    }

    const grantedTier = params.grantedTier || request.requested_tier

    const tierConfigResult = await client.query(
      `SELECT * FROM seller_tier_config WHERE tier = $1 LIMIT 1`,
      [grantedTier],
    )
    const tierConfig = tierConfigResult.rows[0]
    if (!tierConfig) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Requested tier configuration not found')
    }

    // THE FAIL-CLOSED FIX: a tier that requires ID verification needs an
    // actual document on file that is BOTH admin-accepted AND clean of
    // malware -- neither one alone is sufficient. A document sitting at
    // malware_scan_status = 'not_scanned' (every upload's starting
    // state), 'flagged', or 'error' can never satisfy this, regardless
    // of what an admin marks review_status as; an admin literally cannot
    // approve verification against an unscanned or flagged document. In
    // this phase no real scanner is wired in (scanDocumentForMalware in
    // seller-documents.service.ts is an explicit no-op), which means
    // malware_scan_status stays 'not_scanned' forever for every
    // document today -- so this path is CORRECTLY unusable in
    // production until a real scanner is integrated. That is the
    // intended fail-closed behavior, not a bug: document-based
    // verification is unavailable rather than insecure.
    if (tierConfig.requires_id_verification) {
      const acceptedDoc = await client.query(
        `SELECT id FROM seller_verification_documents
         WHERE seller_profile_id = $1 AND category = 'identity_document'
           AND review_status = 'accepted' AND malware_scan_status = 'clean' AND is_current = TRUE
         LIMIT 1`,
        [request.seller_profile_id],
      )
      if (acceptedDoc.rows.length === 0) {
        await client.query('ROLLBACK')
        throw new IllegalTransitionError(
          'verification request',
          request.status,
          'APPROVED (missing an accepted AND malware-scanned-clean identity document for a tier that requires one)',
        )
      }
    }

    // Auto-supersede any OTHER non-terminal case for the same profile
    // -- the orphan-prevention rule (this is exactly the class of bug
    // found live: a stale pending request left behind by a bypass).
    // Marked SUPERSEDED, not APPROVED -- these cases were never
    // themselves reviewed to a decision; a different, later case is
    // what actually got approved. Conflating the two would make the
    // audit trail claim a review happened that didn't.
    await client.query(
      `UPDATE seller_verification_requests
       SET status = 'SUPERSEDED', admin_decision_reason = COALESCE(admin_decision_reason, 'Superseded by a later approved request for the same seller'),
           reviewed_at = CURRENT_TIMESTAMP, reviewed_by_admin_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE seller_profile_id = $2 AND id <> $3 AND status IN ('PENDING', 'MORE_INFORMATION_REQUIRED')`,
      [params.actor.actorId, request.seller_profile_id, params.requestId],
    )

    const updatedRequest = await client.query(
      `UPDATE seller_verification_requests
       SET status = 'APPROVED',
           reviewed_by_admin_id = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           admin_decision_reason = COALESCE($2, admin_decision_reason),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [params.actor.actorId, params.reason || null, params.requestId],
    )

    const updatedProfile = await client.query(
      `UPDATE seller_profiles
       SET tier = $1,
           verification_status = 'APPROVED',
           max_active_listings = $2,
           max_product_price = $3,
           phone_verified = CASE WHEN $4 = true THEN true ELSE phone_verified END,
           id_verified = CASE WHEN $5 = true THEN true ELSE id_verified END,
           payment_method_verified = CASE WHEN $6 = true THEN true ELSE payment_method_verified END,
           verified_at = CURRENT_TIMESTAMP,
           verified_by_admin_id = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        grantedTier,
        tierConfig.max_active_listings,
        tierConfig.max_product_price,
        Boolean(params.markPhoneVerified),
        tierConfig.requires_id_verification, // id_verified is now backed by a real accepted document, checked above
        Boolean(params.markPaymentMethodVerified),
        params.actor.actorId,
        request.seller_profile_id,
      ],
    )

    await client.query(
      `UPDATE users SET is_business_account = true,
        business_mode_activated_at = COALESCE(business_mode_activated_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [request.user_id],
    )

    await appendSellerAuditLog(
      {
        profileId: request.seller_profile_id,
        userId: request.user_id,
        actorId: params.actor.actorId,
        action: 'seller_verification_approved',
        previousState: { tier: request.current_tier, verificationStatus: request.status },
        newState: { tier: grantedTier, verificationStatus: 'APPROVED' },
        details: { requestId: params.requestId },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      client,
    )

    await client.query('COMMIT')

    // account_status/onboarding_status transitions run as their own
    // short transactions after the core approval commits -- each is
    // independently idempotent, so a failure here never leaves the
    // core tier/verification approval half-applied.
    await setSellerAccountStatus({
      sellerProfileId: request.seller_profile_id,
      toStatus: 'ACTIVE',
      actor: params.actor,
      reason: params.reason,
      action: 'seller_verification_approved',
    }).catch((error) => {
      if (!(error instanceof IllegalTransitionError)) throw error
    })
    await transitionOnboardingStatus({
      sellerProfileId: request.seller_profile_id,
      toStatus: 'COMPLETED',
      actor: params.actor,
    }).catch((error) => {
      if (!(error instanceof IllegalTransitionError)) throw error
    })

    await notifySeller({
      userId: request.user_id,
      type: 'seller_verification_approved',
      title: 'Your seller application was approved',
      message: `Congratulations -- you're approved at the ${grantedTier} tier.`,
    })

    return { sellerProfile: updatedProfile.rows[0], verificationRequest: updatedRequest.rows[0], noop: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function rejectVerification(params: {
  requestId: string
  actor: TransitionActor
  reason: string
}): Promise<TransitionResult> {
  if (!params.reason?.trim()) {
    throw new Error('A reason is required to reject a verification request')
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const requestResult = await client.query(
      `SELECT * FROM seller_verification_requests WHERE id = $1 FOR UPDATE`,
      [params.requestId],
    )
    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Verification request not found')
    }
    const request = requestResult.rows[0]

    if (params.actor.actorId && params.actor.actorId === request.user_id) {
      await client.query('ROLLBACK')
      throw new SelfApprovalError()
    }

    if (request.status === 'REJECTED') {
      await client.query('ROLLBACK')
      return { sellerProfile: null as any, verificationRequest: request, noop: true }
    }
    if (request.status !== 'PENDING' && request.status !== 'MORE_INFORMATION_REQUIRED') {
      await client.query('ROLLBACK')
      throw new IllegalTransitionError('verification request', request.status, 'REJECTED')
    }

    const updatedRequest = await client.query(
      `UPDATE seller_verification_requests
       SET status = 'REJECTED', reviewed_by_admin_id = $1, reviewed_at = CURRENT_TIMESTAMP,
           admin_decision_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [params.actor.actorId, params.reason, params.requestId],
    )

    const profileResult = await client.query(`SELECT * FROM seller_profiles WHERE id = $1`, [
      request.seller_profile_id,
    ])
    const profile = profileResult.rows[0]

    // Rejecting a tier-UPGRADE request must never revoke an
    // already-ACTIVE seller's existing access -- only an initial
    // onboarding rejection moves the account itself to REJECTED.
    let updatedProfile = profile
    if (request.case_type === 'initial_onboarding' && profile.account_status !== 'ACTIVE') {
      await client.query(
        `UPDATE seller_profiles SET verification_status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [request.seller_profile_id],
      )
      const reloaded = await client.query(`SELECT * FROM seller_profiles WHERE id = $1`, [
        request.seller_profile_id,
      ])
      updatedProfile = reloaded.rows[0]
    }

    await appendSellerAuditLog(
      {
        profileId: request.seller_profile_id,
        userId: request.user_id,
        actorId: params.actor.actorId,
        action: 'seller_verification_rejected',
        previousState: { verificationStatus: request.status },
        newState: { verificationStatus: 'REJECTED' },
        details: { requestId: params.requestId, reason: params.reason },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      client,
    )

    await client.query('COMMIT')

    if (request.case_type === 'initial_onboarding' && profile.account_status !== 'ACTIVE') {
      await setSellerAccountStatus({
        sellerProfileId: request.seller_profile_id,
        toStatus: 'REJECTED',
        actor: params.actor,
        reason: params.reason,
        action: 'seller_verification_rejected',
      }).catch((error) => {
        if (!(error instanceof IllegalTransitionError)) throw error
      })
    }

    await notifySeller({
      userId: request.user_id,
      type: 'seller_verification_rejected',
      title: 'Your seller application was not approved',
      message: params.reason,
    })

    return { sellerProfile: updatedProfile, verificationRequest: updatedRequest.rows[0], noop: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function requestMoreInformation(params: {
  requestId: string
  actor: TransitionActor
  reason: string
}): Promise<TransitionResult> {
  if (!params.reason?.trim()) {
    throw new Error('A reason is required when requesting more information')
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const requestResult = await client.query(
      `SELECT * FROM seller_verification_requests WHERE id = $1 FOR UPDATE`,
      [params.requestId],
    )
    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Verification request not found')
    }
    const request = requestResult.rows[0]

    if (request.status === 'MORE_INFORMATION_REQUIRED') {
      await client.query('ROLLBACK')
      return { sellerProfile: null as any, verificationRequest: request, noop: true }
    }
    if (request.status !== 'PENDING') {
      await client.query('ROLLBACK')
      throw new IllegalTransitionError('verification request', request.status, 'MORE_INFORMATION_REQUIRED')
    }

    const updatedRequest = await client.query(
      `UPDATE seller_verification_requests
       SET status = 'MORE_INFORMATION_REQUIRED',
           more_information_requested_at = CURRENT_TIMESTAMP,
           admin_decision_reason = $1,
           reviewed_by_admin_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [params.reason, params.actor.actorId, params.requestId],
    )

    await client.query(
      `UPDATE seller_profiles SET verification_status = 'MORE_INFORMATION_REQUIRED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [request.seller_profile_id],
    )

    await appendSellerAuditLog(
      {
        profileId: request.seller_profile_id,
        userId: request.user_id,
        actorId: params.actor.actorId,
        action: 'seller_more_information_requested',
        previousState: { verificationStatus: 'PENDING_REVIEW' },
        newState: { verificationStatus: 'MORE_INFORMATION_REQUIRED' },
        details: { requestId: params.requestId, reason: params.reason },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      client,
    )

    await client.query('COMMIT')

    await transitionOnboardingStatus({
      sellerProfileId: request.seller_profile_id,
      toStatus: 'IN_PROGRESS',
      actor: params.actor,
    }).catch((error) => {
      if (!(error instanceof IllegalTransitionError)) throw error
    })

    await notifySeller({
      userId: request.user_id,
      type: 'seller_more_information_requested',
      title: 'We need more information from you',
      message: params.reason,
    })

    return { sellerProfile: null as any, verificationRequest: updatedRequest.rows[0], noop: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function expireVerification(params: {
  requestId: string
  actor: TransitionActor
}): Promise<TransitionResult> {
  // Manual-only escape hatch this phase -- no scheduler is built to
  // call this automatically (an explicit non-goal). Ready for a future
  // cron/queue job to invoke without any interface change.
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const requestResult = await client.query(
      `SELECT * FROM seller_verification_requests WHERE id = $1 FOR UPDATE`,
      [params.requestId],
    )
    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Verification request not found')
    }
    const request = requestResult.rows[0]
    if (!['PENDING', 'MORE_INFORMATION_REQUIRED'].includes(request.status)) {
      await client.query('ROLLBACK')
      throw new IllegalTransitionError('verification request', request.status, 'EXPIRED')
    }

    const updated = await client.query(
      `UPDATE seller_verification_requests
       SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [params.requestId],
    )

    await appendSellerAuditLog(
      {
        profileId: request.seller_profile_id,
        userId: request.user_id,
        actorId: params.actor.actorId,
        action: 'seller_verification_expired',
        previousState: { verificationStatus: request.status },
        newState: { verificationStatus: 'EXPIRED' },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      client,
    )

    await client.query('COMMIT')
    return { sellerProfile: null as any, verificationRequest: updated.rows[0], noop: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

// -----------------------------------------------------------------
// Tier -- THE BUG FIX. Touches tier + tier-derived limits only. Never
// reads or writes verification_status/account_status.
// -----------------------------------------------------------------
export async function setSellerTier(params: {
  sellerProfileId: string
  toTier: SellerTier
  actor: TransitionActor
  reason?: string
}): Promise<TransitionResult> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const current = await client.query(`SELECT * FROM seller_profiles WHERE id = $1 FOR UPDATE`, [
      params.sellerProfileId,
    ])
    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Seller profile not found')
    }
    const before = current.rows[0]

    const tierConfigResult = await client.query(`SELECT * FROM seller_tier_config WHERE tier = $1`, [
      params.toTier,
    ])
    const tierConfig = tierConfigResult.rows[0]
    if (!tierConfig) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Tier configuration not found')
    }

    if (before.tier === params.toTier) {
      await client.query('ROLLBACK')
      return { sellerProfile: before, noop: true }
    }

    const updated = await client.query(
      `UPDATE seller_profiles
       SET tier = $1, max_active_listings = $2, max_product_price = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [params.toTier, tierConfig.max_active_listings, tierConfig.max_product_price, params.sellerProfileId],
    )

    await appendSellerAuditLog(
      {
        profileId: params.sellerProfileId,
        userId: before.user_id,
        actorId: params.actor.actorId,
        action: 'seller_tier_changed_by_admin',
        previousState: { tier: before.tier },
        newState: { tier: params.toTier },
        details: { reason: params.reason || null },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      client,
    )

    await client.query('COMMIT')

    await notifySeller({
      userId: before.user_id,
      type: 'seller_tier_changed',
      title: 'Your seller tier has changed',
      message: `You are now on the ${params.toTier} tier.`,
    })

    return { sellerProfile: updated.rows[0], noop: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

// -----------------------------------------------------------------
// Admin bootstrap: create a seller_profiles row directly and activate
// it in one step, routed through the SAME primitive approveVerification
// uses for the account-status change (setSellerAccountStatus), instead
// of being a third hand-rolled writer.
// -----------------------------------------------------------------
export async function grantSellerAccess(params: {
  userId: string
  tier: SellerTier
  actor: TransitionActor
}): Promise<TransitionResult> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const existing = await client.query(`SELECT id FROM seller_profiles WHERE user_id = $1`, [
      params.userId,
    ])
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK')
      throw new Error('This user already has a seller profile')
    }

    const tierConfigResult = await client.query(`SELECT * FROM seller_tier_config WHERE tier = $1`, [
      params.tier,
    ])
    const tierConfig = tierConfigResult.rows[0]
    if (!tierConfig) {
      await client.query('ROLLBACK')
      throw new NotFoundError('Tier configuration not found')
    }

    await client.query(
      `UPDATE users SET is_business_account = true,
        business_mode_activated_at = COALESCE(business_mode_activated_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [params.userId],
    )

    const inserted = await client.query(
      `INSERT INTO seller_profiles (
        user_id, tier, verification_status, account_status, onboarding_status, store_status,
        max_active_listings, max_product_price,
        terms_accepted, terms_accepted_at, verified_at, verified_by_admin_id,
        account_status_updated_at, store_status_updated_at
      )
      VALUES (
        $1, $2, 'APPROVED', 'ACTIVE', 'COMPLETED', 'LIVE',
        $3, $4,
        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *`,
      [params.userId, params.tier, tierConfig.max_active_listings, tierConfig.max_product_price, params.actor.actorId],
    )
    const profile = inserted.rows[0]

    await appendSellerAuditLog(
      {
        profileId: profile.id,
        userId: params.userId,
        actorId: params.actor.actorId,
        action: 'seller_granted_by_admin',
        previousState: null,
        newState: { tier: params.tier, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
        ip: params.actor.ip,
        userAgent: params.actor.userAgent,
      },
      client,
    )

    await client.query('COMMIT')
    return { sellerProfile: profile, noop: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

// -----------------------------------------------------------------
// Suspend / restrict / reactivate / close -- all route through
// setSellerAccountStatus. Suspend/restrict also force the storefront
// off (a suspended/restricted seller's store cannot stay LIVE);
// reactivate recalculates readiness rather than blindly restoring LIVE.
// -----------------------------------------------------------------
export async function suspendSellerAccount(params: {
  sellerProfileId: string
  actor: TransitionActor
  reason: string
}): Promise<TransitionResult> {
  if (!params.reason?.trim()) {
    throw new Error('A reason is required to suspend a seller')
  }
  const result = await setSellerAccountStatus({
    sellerProfileId: params.sellerProfileId,
    toStatus: 'SUSPENDED',
    actor: params.actor,
    reason: params.reason,
    action: 'seller_suspended',
  })
  if (!result.noop) {
    await setStoreStatus({
      sellerProfileId: params.sellerProfileId,
      toStatus: 'SUSPENDED',
      actor: params.actor,
      reason: params.reason,
    }).catch((error) => {
      if (!(error instanceof IllegalTransitionError)) throw error
    })
    await notifySeller({
      userId: (result.sellerProfile as any).user_id,
      type: 'seller_account_suspended',
      title: 'Your seller account has been suspended',
      message: params.reason,
    })
  }
  return result
}

export async function restrictSellerAccount(params: {
  sellerProfileId: string
  actor: TransitionActor
  reason: string
}): Promise<TransitionResult> {
  if (!params.reason?.trim()) {
    throw new Error('A reason is required to restrict a seller')
  }
  const result = await setSellerAccountStatus({
    sellerProfileId: params.sellerProfileId,
    toStatus: 'RESTRICTED',
    actor: params.actor,
    reason: params.reason,
    action: 'seller_restricted',
  })
  if (!result.noop) {
    await setStoreStatus({
      sellerProfileId: params.sellerProfileId,
      toStatus: 'PAUSED',
      actor: params.actor,
      reason: params.reason,
    }).catch((error) => {
      if (!(error instanceof IllegalTransitionError)) throw error
    })
    await notifySeller({
      userId: (result.sellerProfile as any).user_id,
      type: 'seller_account_restricted',
      title: 'Your seller account has been restricted',
      message: params.reason,
    })
  }
  return result
}

export async function reactivateSellerAccount(params: {
  sellerProfileId: string
  actor: TransitionActor
  reason?: string
}): Promise<TransitionResult> {
  const result = await setSellerAccountStatus({
    sellerProfileId: params.sellerProfileId,
    toStatus: 'ACTIVE',
    actor: params.actor,
    reason: params.reason,
    action: 'seller_reactivated_by_admin',
  })
  if (!result.noop) {
    const readiness = await evaluateStoreReadiness(params.sellerProfileId)
    await setStoreStatus({
      sellerProfileId: params.sellerProfileId,
      toStatus: readiness.eligible ? 'LIVE' : 'READY',
      actor: params.actor,
      reason: params.reason,
    }).catch((error) => {
      if (!(error instanceof IllegalTransitionError)) throw error
    })
    await notifySeller({
      userId: (result.sellerProfile as any).user_id,
      type: 'seller_account_reactivated',
      title: 'Your seller account has been reactivated',
      message: 'Your seller account is active again.',
    })
  }
  return result
}

export async function closeSellerAccount(params: {
  sellerProfileId: string
  actor: TransitionActor
  reason: string
}): Promise<TransitionResult> {
  if (!params.reason?.trim()) {
    throw new Error('A reason is required to close a seller account')
  }
  const result = await setSellerAccountStatus({
    sellerProfileId: params.sellerProfileId,
    toStatus: 'CLOSED',
    actor: params.actor,
    reason: params.reason,
    action: 'seller_closed',
  })
  if (!result.noop) {
    await setStoreStatus({
      sellerProfileId: params.sellerProfileId,
      toStatus: 'CLOSED',
      actor: params.actor,
      reason: params.reason,
    }).catch((error) => {
      if (!(error instanceof IllegalTransitionError)) throw error
    })
  }
  return result
}
