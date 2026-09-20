// Single source of truth for seller-lifecycle domain values in the admin
// dashboard. Each field below is backed by its OWN dedicated Postgres
// enum (see tech-tools-api/src/database/migrations/074_seller_lifecycle_enums.sql)
// -- they must never be compared against each other's values, and none of
// them are lowercase on the wire (unlike seller_document_review_status /
// seller_document_scan_status, which really are lowercase by design, and
// seller tier, which stays lowercase too).
//
// This file exists because the admin dashboard shipped comparing every
// one of these against pre-migration lowercase values ('pending',
// 'approved', ...) -- which silently never matched the real uppercase
// values the API has returned since the lifecycle migration, disabling
// the Approve/Reject buttons entirely and zeroing every count. Centralizing
// the valid-value lists and the reviewable/terminal predicates here means
// an unrecognized or stale value now fails closed (no actions shown, not
// counted as pending) instead of silently miscomparing.
//
// The six types below are re-exported from types/generated.ts (run
// `npm run generate:types` / server-scripts/generate-types-prod.sh to
// regenerate) rather than hand-declared -- they used to be hand-written
// here too, which is exactly the class of bug this file exists to fix:
// a hand-copied enum silently drifting from the real one. Now there is
// exactly one place these values come from (pg_enum, read live off the
// database), and every app that imports them gets the same file.
export type {
  SellerProfileVerificationStatus,
  SellerVerificationCaseStatus,
  SellerAccountStatus,
  SellerStoreStatus,
  SellerOnboardingStatus,
  SellerTier,
} from '@/types/generated'

import type {
  SellerProfileVerificationStatus,
  SellerVerificationCaseStatus,
} from '@/types/generated'

const REVIEWABLE_CASE_STATUSES: readonly SellerVerificationCaseStatus[] = [
  'PENDING',
  'MORE_INFORMATION_REQUIRED',
]

const TERMINAL_CASE_STATUSES: readonly SellerVerificationCaseStatus[] = [
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED',
]

// Matches exactly what the backend's approveVerification/rejectVerification
// transitions permit (seller-lifecycle.service.ts): only PENDING or
// MORE_INFORMATION_REQUIRED cases can move to APPROVED/REJECTED. An
// unrecognized string (a stale lowercase value, or any future value this
// file hasn't been updated for) is NOT reviewable -- fail closed rather
// than guessing.
export function isVerificationCaseReviewable(status: string): boolean {
  return REVIEWABLE_CASE_STATUSES.includes(status as SellerVerificationCaseStatus)
}

export function isVerificationCaseTerminal(status: string): boolean {
  return TERMINAL_CASE_STATUSES.includes(status as SellerVerificationCaseStatus)
}

// Presentation only -- never an authorization decision. The backend is
// the real gate (and will still reject, e.g., an approval blocked by the
// fail-closed malware/document rule even when this returns true).
export function canShowApprovalActions(status: string): boolean {
  return isVerificationCaseReviewable(status)
}

export function isSellerAccountOperational(accountStatus?: string | null): boolean {
  return accountStatus != null && accountStatus !== 'SUSPENDED' && accountStatus !== 'CLOSED'
}

export type BadgeTone = 'default' | 'secondary' | 'destructive' | 'outline'

export interface StatusPresentation {
  label: string
  variant: BadgeTone
}

// Case-status (per verification-request) presentation -- distinct from
// the profile-status presentation below on purpose (they are different
// concepts with overlapping value names, e.g. both have 'APPROVED').
export function getCaseStatusPresentation(status: string): StatusPresentation {
  switch (status as SellerVerificationCaseStatus) {
    case 'PENDING':
      return { label: 'Pending review', variant: 'secondary' }
    case 'MORE_INFORMATION_REQUIRED':
      return { label: 'More info requested', variant: 'secondary' }
    case 'APPROVED':
      return { label: 'Approved', variant: 'default' }
    case 'REJECTED':
      return { label: 'Rejected', variant: 'destructive' }
    case 'EXPIRED':
      return { label: 'Expired', variant: 'outline' }
    case 'SUPERSEDED':
      return { label: 'Superseded', variant: 'outline' }
    default:
      // Unrecognized value (e.g. a stale lowercase string) -- shown
      // verbatim rather than mislabeled as something it isn't.
      return { label: status, variant: 'outline' }
  }
}

// Profile-level verification-standing presentation.
export function getProfileVerificationPresentation(status: string): StatusPresentation {
  switch (status as SellerProfileVerificationStatus) {
    case 'NOT_STARTED':
      return { label: 'Not started', variant: 'outline' }
    case 'IN_PROGRESS':
      return { label: 'In progress', variant: 'secondary' }
    case 'PENDING_REVIEW':
      return { label: 'Pending review', variant: 'secondary' }
    case 'MORE_INFORMATION_REQUIRED':
      return { label: 'More info requested', variant: 'secondary' }
    case 'APPROVED':
      return { label: 'Verified', variant: 'default' }
    case 'REJECTED':
      return { label: 'Rejected', variant: 'destructive' }
    case 'EXPIRED':
      return { label: 'Expired', variant: 'outline' }
    default:
      return { label: status, variant: 'outline' }
  }
}

export const REVIEW_CASE_STATUS_VALUES: readonly SellerVerificationCaseStatus[] = [
  'PENDING',
  'MORE_INFORMATION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED',
]
