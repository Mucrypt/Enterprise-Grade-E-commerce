-- Seller onboarding/activation lifecycle -- backfill existing rows into
-- the new status columns added in 075. Nothing here is invented -- every
-- new value is derived purely from columns that already existed before
-- this migration. By the time this file runs, 075 has already converted
-- verification_status/status to the new dedicated enums (074), so every
-- comparison below uses the new UPPERCASE values, not the old lowercase
-- ones.
--
-- account_status/store_status are guarded by their own `_updated_at IS
-- NULL` columns, NOT by "= 'DRAFT'" -- rehearsal against a real
-- production snapshot caught that DRAFT is both this migration's
-- not-yet-touched sentinel AND a legitimate, ongoing value (a seller who
-- started onboarding but never got approved stays DRAFT/DRAFT
-- indefinitely). Guarding on the value meant every re-run kept
-- "updating" such a row forever -- recomputing the same DRAFT result
-- every time, so not data-corrupting, but not a true no-op either,
-- contradicting this file's own re-runnability guarantee. `_updated_at
-- IS NULL` is a real one-time marker: this migration is the only writer
-- that leaves it null, so once set, a row is never matched again.
-- onboarding_status has no equivalent timestamp column, but does not
-- need one: unlike DRAFT, NOT_STARTED is never a legitimate value for a
-- seller_profiles row that already exists (a row existing at all means
-- onboarding was at least started), so guarding on the value alone is
-- already a true one-time condition there.

-- account_status, derived from the existing tri-state combination of
-- verification_status/is_active/is_suspended.
UPDATE seller_profiles SET
  account_status = CASE
    WHEN is_suspended THEN 'SUSPENDED'
    WHEN verification_status = 'APPROVED' AND is_active THEN 'ACTIVE'
    WHEN verification_status = 'PENDING_REVIEW' THEN 'PENDING_REVIEW'
    WHEN verification_status = 'REJECTED' THEN 'REJECTED'
    ELSE 'DRAFT'
  END::seller_account_status,
  account_status_updated_at = CURRENT_TIMESTAMP
WHERE account_status_updated_at IS NULL;

-- onboarding_status: a seller_profiles row existing at all means
-- onboarding was at least started.
UPDATE seller_profiles SET
  onboarding_status = CASE
    WHEN verification_status = 'APPROVED' THEN 'COMPLETED'
    WHEN verification_status = 'PENDING_REVIEW' THEN 'SUBMITTED'
    ELSE 'IN_PROGRESS'
  END::seller_onboarding_status
WHERE onboarding_status = 'NOT_STARTED';

-- store_status: the one, minimal go-live rule this phase defines
-- (ACTIVE account + terms already accepted). No payouts/finance
-- requirement invented -- those don't exist as real gates yet.
UPDATE seller_profiles SET
  store_status = CASE
    WHEN account_status = 'ACTIVE' AND terms_accepted THEN 'LIVE'
    WHEN account_status = 'SUSPENDED' THEN 'SUSPENDED'
    ELSE 'DRAFT'
  END::seller_store_status,
  store_status_updated_at = CURRENT_TIMESTAMP
WHERE store_status_updated_at IS NULL;

-- Resolve the one known orphaned case found live in production: a
-- seller_verification_requests row stuck at status='PENDING' while its
-- seller_profiles row is already 'APPROVED', caused by an admin
-- bypassing the request queue via a direct grant/tier-set. This specific
-- case was never itself reviewed to a decision -- the profile was
-- approved by an entirely different action -- so it is marked
-- SUPERSEDED, not APPROVED, matching the same distinction
-- approveVerification's own auto-supersede logic makes for this exact
-- situation going forward. Guarded so a second run is a no-op, and no
-- admin identity is invented for reviewed_by_admin_id (left NULL --
-- honestly "the system", not a specific person who never actually
-- reviewed this specific request).
UPDATE seller_verification_requests svr SET
  status = 'SUPERSEDED',
  reviewed_at = COALESCE(svr.reviewed_at, CURRENT_TIMESTAMP),
  admin_decision_reason = COALESCE(
    svr.admin_decision_reason,
    'Auto-resolved by seller-lifecycle migration 076: seller_profiles was already approved via a direct admin action that bypassed this request.'
  ),
  updated_at = CURRENT_TIMESTAMP
FROM seller_profiles sp
WHERE svr.seller_profile_id = sp.id
  AND svr.status = 'PENDING'
  AND sp.verification_status = 'APPROVED';

-- A visible, once-only audit trail entry for the patch above, so the fix
-- itself is auditable rather than a silent data edit.
INSERT INTO seller_audit_log (seller_profile_id, user_id, actor_id, action, previous_state, new_state, details)
SELECT sp.id, sp.user_id, NULL, 'verification_request_auto_resolved_by_migration',
       jsonb_build_object('requestStatus', 'PENDING'),
       jsonb_build_object('requestStatus', 'SUPERSEDED'),
       jsonb_build_object('migration', '076_seller_lifecycle_backfill')
FROM seller_profiles sp
WHERE sp.verification_status = 'APPROVED'
  AND EXISTS (
    SELECT 1 FROM seller_verification_requests svr2
    WHERE svr2.seller_profile_id = sp.id
      AND svr2.admin_decision_reason LIKE 'Auto-resolved by seller-lifecycle migration 076%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM seller_audit_log sal
    WHERE sal.seller_profile_id = sp.id
      AND sal.action = 'verification_request_auto_resolved_by_migration'
  );
