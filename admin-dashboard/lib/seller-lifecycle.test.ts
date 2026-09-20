import { describe, it, expect } from 'vitest'
import {
  canShowApprovalActions,
  getCaseStatusPresentation,
  getProfileVerificationPresentation,
  isVerificationCaseReviewable,
  isVerificationCaseTerminal,
} from './seller-lifecycle'

describe('seller-lifecycle -- verification CASE status (seller_verification_case_status)', () => {
  it('treats PENDING as reviewable and contributing to an active/pending count', () => {
    expect(isVerificationCaseReviewable('PENDING')).toBe(true)
    expect(isVerificationCaseTerminal('PENDING')).toBe(false)
  })

  it('treats MORE_INFORMATION_REQUIRED as reviewable, matching the backend transition rules', () => {
    // seller-lifecycle.service.ts's approveVerification/rejectVerification
    // both permit PENDING or MORE_INFORMATION_REQUIRED as source states.
    expect(isVerificationCaseReviewable('MORE_INFORMATION_REQUIRED')).toBe(true)
    expect(canShowApprovalActions('MORE_INFORMATION_REQUIRED')).toBe(true)
  })

  it('never shows approval actions for terminal states', () => {
    for (const terminal of ['APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED']) {
      expect(isVerificationCaseTerminal(terminal)).toBe(true)
      expect(isVerificationCaseReviewable(terminal)).toBe(false)
      expect(canShowApprovalActions(terminal)).toBe(false)
    }
  })

  it('never counts SUPERSEDED as reviewable/pending -- it was never itself decided', () => {
    expect(isVerificationCaseReviewable('SUPERSEDED')).toBe(false)
    expect(isVerificationCaseTerminal('SUPERSEDED')).toBe(true)
  })

  it('a stale lowercase legacy value fails closed instead of masquerading as a valid current status', () => {
    // This is the exact regression: the admin dashboard used to compare
    // against 'pending'/'approved' (lowercase). A value in that shape
    // must never be treated as reviewable NOR as terminal -- it should
    // be recognizably neither, not silently coerced into one.
    expect(isVerificationCaseReviewable('pending')).toBe(false)
    expect(isVerificationCaseTerminal('pending')).toBe(false)
    expect(canShowApprovalActions('pending')).toBe(false)
    expect(isVerificationCaseReviewable('approved')).toBe(false)
    expect(isVerificationCaseTerminal('approved')).toBe(false)
  })

  it('displays MORE_INFORMATION_REQUIRED distinctly from a plain pending review', () => {
    const moreInfo = getCaseStatusPresentation('MORE_INFORMATION_REQUIRED')
    const pending = getCaseStatusPresentation('PENDING')
    expect(moreInfo.label).not.toBe(pending.label)
    expect(moreInfo.label.toLowerCase()).toContain('more info')
  })

  it('labels an unrecognized case status verbatim rather than mislabeling it', () => {
    const presentation = getCaseStatusPresentation('some_future_value')
    expect(presentation.label).toBe('some_future_value')
  })
})

describe('seller-lifecycle -- PROFILE verification status is a separate domain from case status', () => {
  it('uses different presentation output for the same-named APPROVED value in each domain', () => {
    // Both enums happen to share the literal string 'APPROVED', but they
    // describe different things (a profile's overall standing vs one
    // review case's outcome) -- the case label is generic ("Approved"),
    // the profile label is identity-specific ("Verified"), on purpose.
    const caseLabel = getCaseStatusPresentation('APPROVED').label
    const profileLabel = getProfileVerificationPresentation('APPROVED').label
    expect(profileLabel).toBe('Verified')
    expect(caseLabel).toBe('Approved')
    expect(profileLabel).not.toBe(caseLabel)
  })

  it('recognizes profile-only states that do not exist on the case enum', () => {
    // NOT_STARTED and IN_PROGRESS are valid seller_profile_verification_status
    // values with no equivalent on seller_verification_case_status.
    expect(getProfileVerificationPresentation('NOT_STARTED').label).toBe('Not started')
    expect(getProfileVerificationPresentation('IN_PROGRESS').label).toBe('In progress')
  })
})
