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

// A seller PROFILE's own current verification standing.
export type SellerProfileVerificationStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'MORE_INFORMATION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'

// An individual review CASE's lifecycle (one row in
// seller_verification_requests) -- a DIFFERENT enum from the profile
// status above. A profile can be APPROVED overall while a later
// tier-upgrade case is independently PENDING; a SUPERSEDED case was never
// itself reviewed to a decision (see 074's migration comment), so it is
// deliberately distinct from APPROVED/REJECTED.
export type SellerVerificationCaseStatus =
  | 'PENDING'
  | 'MORE_INFORMATION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED'

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

// Tier stays lowercase by design -- it was never part of the enum split.
export type SellerTier = 'unverified' | 'basic' | 'trusted' | 'pro'

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
