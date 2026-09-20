-- Seller onboarding/activation lifecycle -- new columns/tables that use
-- the enum types added in 074. Purely additive: every new column has a
-- safe default, nothing existing is renamed or dropped, and no code
-- outside the new seller-lifecycle service reads these columns yet.

ALTER TABLE seller_profiles
  ADD COLUMN IF NOT EXISTS account_status seller_account_status NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS store_status seller_store_status NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS onboarding_status seller_onboarding_status NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS seller_type seller_applicant_type,
  ADD COLUMN IF NOT EXISTS seller_type_details JSONB,
  ADD COLUMN IF NOT EXISTS account_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_status_updated_at TIMESTAMPTZ;

-- Move seller_profiles.verification_status off the enum it used to share
-- with seller_verification_requests.status, onto its own dedicated
-- profile-standing enum (074). Explicit value mapping, preserving every
-- existing row -- nothing is dropped or guessed:
--   none      -> NOT_STARTED
--   pending   -> PENDING_REVIEW
--   approved  -> APPROVED
--   rejected  -> REJECTED
--   suspended -> APPROVED  (judgment call, documented: suspension in this
--                app has only ever followed a prior real approval --
--                confirmed against production, where the one existing
--                seller is verification_status='approved' with
--                is_suspended=false, i.e. never actually hit this case --
--                and the authoritative "is this seller allowed to
--                operate" signal going forward is account_status =
--                'SUSPENDED', set independently in the backfill below
--                from the pre-existing is_suspended column, not from
--                this value. This mapping only affects what a suspended
--                seller's *underlying identity verification standing*
--                reads as, never whether they can currently operate.)
-- Guarded on the column's CURRENT type, not just wrapped in a bare
-- ALTER -- rehearsal against a real production snapshot caught that an
-- unguarded version of this statement is NOT safely re-runnable: run it
-- a second time (e.g. an operator manually replaying this file after a
-- later migration in the same deploy failed) and it re-applies this
-- OLD-lowercase-to-NEW-uppercase mapping to rows that are ALREADY on the
-- new enum, silently mangling them through the `ELSE` branch (a real
-- 'SUPERSEDED' case round-tripped back to 'PENDING' in the rehearsal).
-- This check makes the conversion itself a true one-time operation,
-- independent of the migration-tracking table.
DO $$
BEGIN
  IF (
    SELECT udt_name FROM information_schema.columns
    WHERE table_name = 'seller_profiles' AND column_name = 'verification_status'
  ) = 'seller_verification_status' THEN
    ALTER TABLE seller_profiles ALTER COLUMN verification_status DROP DEFAULT;
    ALTER TABLE seller_profiles
      ALTER COLUMN verification_status TYPE seller_profile_verification_status
      USING (
        CASE verification_status::text
          WHEN 'none' THEN 'NOT_STARTED'
          WHEN 'pending' THEN 'PENDING_REVIEW'
          WHEN 'approved' THEN 'APPROVED'
          WHEN 'rejected' THEN 'REJECTED'
          WHEN 'suspended' THEN 'APPROVED'
          ELSE 'NOT_STARTED'
        END
      )::seller_profile_verification_status;
    ALTER TABLE seller_profiles ALTER COLUMN verification_status SET DEFAULT 'NOT_STARTED';
  END IF;
END
$$;

ALTER TABLE seller_verification_requests
  ADD COLUMN IF NOT EXISTS case_type VARCHAR(20) NOT NULL DEFAULT 'tier_upgrade',
  ADD COLUMN IF NOT EXISTS more_information_requested_at TIMESTAMPTZ;

-- Same split, the other side: seller_verification_requests.status onto
-- its own dedicated per-case enum (074). 'suspended'/'none' are not
-- values this table's rows have ever actually held (only
-- seller_profiles used them) -- mapped defensively rather than assumed
-- absent, so this migration can never fail on an unexpected value.
--
-- Migration 034's idx_seller_verification_requests_pending is a PARTIAL
-- index whose predicate (`WHERE status = 'pending'`) was resolved against
-- the OLD enum type at CREATE INDEX time -- changing the column's type
-- without dropping this index first fails with "operator does not
-- exist: seller_verification_case_status = seller_verification_status"
-- (Postgres has to re-validate the predicate against the new column
-- type). Recreated below with the new value once the type change lands.
DROP INDEX IF EXISTS idx_seller_verification_requests_pending;

-- Same re-run guard as above, and for the identical reason.
DO $$
BEGIN
  IF (
    SELECT udt_name FROM information_schema.columns
    WHERE table_name = 'seller_verification_requests' AND column_name = 'status'
  ) = 'seller_verification_status' THEN
    ALTER TABLE seller_verification_requests ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE seller_verification_requests
      ALTER COLUMN status TYPE seller_verification_case_status
      USING (
        CASE status::text
          WHEN 'pending' THEN 'PENDING'
          WHEN 'approved' THEN 'APPROVED'
          WHEN 'rejected' THEN 'REJECTED'
          WHEN 'suspended' THEN 'REJECTED'
          WHEN 'none' THEN 'PENDING'
          ELSE 'PENDING'
        END
      )::seller_verification_case_status;
    ALTER TABLE seller_verification_requests ALTER COLUMN status SET DEFAULT 'PENDING';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_seller_verification_requests_pending
  ON seller_verification_requests(status, created_at DESC)
  WHERE status = 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seller_verification_requests_case_type_check'
  ) THEN
    ALTER TABLE seller_verification_requests
    ADD CONSTRAINT seller_verification_requests_case_type_check
    CHECK (case_type IN ('initial_onboarding', 'tier_upgrade', 'reverification'));
  END IF;
END
$$;

-- DB-level backstop against the exact orphan class found live in
-- production (a request stuck 'pending' while its profile was already
-- 'approved', caused by an admin bypassing the request queue via a
-- direct grant/tier-set): at most one non-terminal review case per
-- seller profile at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_verification_requests_one_active_case
  ON seller_verification_requests(seller_profile_id)
  WHERE status IN ('PENDING', 'MORE_INFORMATION_REQUIRED');

-- Identity/business documents. Deliberately no filename column at all --
-- the client-supplied filename is never trusted or persisted anywhere,
-- per the "never trust client filenames" / "no sensitive identifiers in
-- logs or storage" requirement. storage_key is always server-generated.
CREATE TABLE IF NOT EXISTS seller_verification_documents (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_profile_id         UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_request_id   UUID REFERENCES seller_verification_requests(id) ON DELETE SET NULL,

  category                  seller_document_category NOT NULL,

  storage_provider          VARCHAR(20) NOT NULL,
  storage_key               TEXT NOT NULL,
  content_type              VARCHAR(100) NOT NULL,
  byte_size                 INTEGER NOT NULL,
  checksum_sha256           VARCHAR(64),

  upload_status             VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  review_status             seller_document_review_status NOT NULL DEFAULT 'pending',
  review_notes              TEXT,  -- admin-internal only, never returned to the seller
  reviewed_by_admin_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at               TIMESTAMPTZ,

  malware_scan_status       seller_document_scan_status NOT NULL DEFAULT 'not_scanned',

  is_current                BOOLEAN NOT NULL DEFAULT TRUE,
  replaces_document_id      UUID REFERENCES seller_verification_documents(id) ON DELETE SET NULL,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seller_verification_documents_profile_current
  ON seller_verification_documents(seller_profile_id, category)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_seller_verification_documents_user
  ON seller_verification_documents(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_verification_documents_request
  ON seller_verification_documents(verification_request_id)
  WHERE verification_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seller_profiles_account_status ON seller_profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_store_status ON seller_profiles(store_status);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_onboarding_status ON seller_profiles(onboarding_status);
