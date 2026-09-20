-- Seller onboarding/activation lifecycle -- new enum types only.
--
-- Split into its own file (074) separate from the schema that uses these
-- values (075) because CREATE TYPE + immediate use in the same
-- transaction is fine in Postgres, but this file is kept as the "types
-- only" file for readability -- 075 is where every column that uses
-- these actually gets added/migrated.
--
-- Today "is this seller allowed to sell" is answered by an ad hoc mix of
-- seller_profiles.verification_status + is_active + is_suspended, with
-- "suspended" living inside verification_status even though suspension
-- is an account-standing concept, not an identity-verification concept.
--
-- Two SEPARATE state machines were previously conflated onto one shared
-- enum (`seller_verification_status`, used by BOTH
-- `seller_profiles.verification_status` and
-- `seller_verification_requests.status`) -- a profile's own overall
-- verification STANDING is a different concept from an individual
-- review CASE's lifecycle (a profile can have exactly one standing at a
-- time; it can have many historical cases, most of them terminal). This
-- migration gives each its own dedicated enum instead of layering more
-- values onto the one they used to share -- see 075 for the column
-- migration (with an explicit value mapping, preserving every existing
-- row) that actually switches to these.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_account_status') THEN
    CREATE TYPE seller_account_status AS ENUM (
      'DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'REJECTED', 'CLOSED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_store_status') THEN
    CREATE TYPE seller_store_status AS ENUM (
      'DRAFT', 'READY', 'LIVE', 'PAUSED', 'SUSPENDED', 'CLOSED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_onboarding_status') THEN
    CREATE TYPE seller_onboarding_status AS ENUM (
      'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_applicant_type') THEN
    CREATE TYPE seller_applicant_type AS ENUM ('individual', 'registered_business');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_document_category') THEN
    CREATE TYPE seller_document_category AS ENUM (
      'identity_document', 'proof_of_address', 'business_registration', 'tax_document', 'additional_requested'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_document_review_status') THEN
    CREATE TYPE seller_document_review_status AS ENUM ('pending', 'accepted', 'rejected');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_document_scan_status') THEN
    CREATE TYPE seller_document_scan_status AS ENUM ('not_scanned', 'clean', 'flagged', 'error');
  END IF;
END
$$;

-- A seller PROFILE's own current verification standing. Non-terminal:
-- NOT_STARTED, IN_PROGRESS, PENDING_REVIEW, MORE_INFORMATION_REQUIRED.
-- Terminal (for now -- a seller can still be moved back to
-- PENDING_REVIEW by a fresh submission): APPROVED, REJECTED, EXPIRED.
-- This column no longer has a 'suspended' value at all -- suspension is
-- an account-standing concept (seller_account_status.SUSPENDED), not a
-- verification-standing one; a suspended seller's underlying identity
-- verification standing is untouched by the suspension itself.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_profile_verification_status') THEN
    CREATE TYPE seller_profile_verification_status AS ENUM (
      'NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'MORE_INFORMATION_REQUIRED',
      'APPROVED', 'REJECTED', 'EXPIRED'
    );
  END IF;
END
$$;

-- An individual review CASE's lifecycle (one row in
-- seller_verification_requests). Non-terminal: PENDING,
-- MORE_INFORMATION_REQUIRED. Terminal: APPROVED, REJECTED, EXPIRED, and
-- SUPERSEDED -- a case that was never itself reviewed to a decision, but
-- was closed out because a different, later case for the same profile
-- was approved instead (this is a real, previously-mismodeled situation:
-- production has exactly one such case, a stale 'pending' request left
-- behind when an admin bypassed the review queue via a direct grant --
-- see 076's backfill). SUPERSEDED is deliberately distinct from APPROVED
-- so the audit trail never implies a case was reviewed and approved on
-- its own merits when it wasn't.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_verification_case_status') THEN
    CREATE TYPE seller_verification_case_status AS ENUM (
      'PENDING', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'
    );
  END IF;
END
$$;
