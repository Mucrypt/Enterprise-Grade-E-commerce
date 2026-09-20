// =====================================================
// Pure reads for the seller lifecycle -- store readiness, submission
// eligibility, onboarding progress, and the single capability/
// entitlement response the frontend is meant to trust instead of
// re-deriving eligibility per page (replacing the inconsistent
// canBecomeSeller / requireAdminOrOnboardedSeller / getCreatorAccessContext
// checks, each of which reads slightly different columns today).
//
// One-directional dependency only: seller-lifecycle.service.ts imports
// from this file (for evaluateStoreReadiness), this file never imports
// back from it.
// =====================================================

import { query } from '../database/connection'

export interface ReadinessResult {
  eligible: boolean
  missing: string[]
}

// The one, minimal go-live rule this phase defines. No payouts/finance
// requirement invented -- those systems don't exist yet as real gates.
export async function evaluateStoreReadiness(sellerProfileId: string): Promise<ReadinessResult> {
  const result = await query(
    `SELECT account_status, terms_accepted FROM seller_profiles WHERE id = $1 LIMIT 1`,
    [sellerProfileId],
  )
  const profile = result.rows[0]
  if (!profile) {
    return { eligible: false, missing: ['seller_profile_not_found'] }
  }

  const missing: string[] = []
  if (profile.account_status !== 'ACTIVE') missing.push('seller_account_must_be_active')
  if (!profile.terms_accepted) missing.push('marketplace_terms_not_accepted')

  return { eligible: missing.length === 0, missing }
}

export async function evaluateSubmissionEligibility(sellerProfileId: string): Promise<ReadinessResult> {
  const profileResult = await query(`SELECT * FROM seller_profiles WHERE id = $1 LIMIT 1`, [
    sellerProfileId,
  ])
  const profile = profileResult.rows[0]
  if (!profile) {
    return { eligible: false, missing: ['seller_profile_not_found'] }
  }

  const missing: string[] = []
  if (!profile.seller_type) missing.push('seller_type_not_selected')

  if (profile.seller_type) {
    const details = profile.seller_type_details || {}
    const requiredFields: string[] =
      profile.seller_type === 'registered_business'
        ? ['legalBusinessName', 'registrationNumber', 'countryOfRegistration', 'registeredAddress']
        : ['legalFirstName', 'legalLastName', 'dateOfBirth', 'country', 'residentialAddress']
    for (const field of requiredFields) {
      if (!details[field]) missing.push(`seller_type_details.${field}_missing`)
    }
  }

  if (!profile.terms_accepted) missing.push('marketplace_terms_not_accepted')

  const documentsResult = await query(
    `SELECT category FROM seller_verification_documents
     WHERE seller_profile_id = $1 AND is_current = TRUE AND upload_status = 'uploaded'`,
    [sellerProfileId],
  )
  const uploadedCategories = new Set(documentsResult.rows.map((r) => r.category))

  if (!uploadedCategories.has('identity_document')) missing.push('identity_document_not_uploaded')
  if (profile.seller_type === 'registered_business') {
    if (!uploadedCategories.has('business_registration')) missing.push('business_registration_not_uploaded')
  } else if (profile.seller_type === 'individual') {
    if (!uploadedCategories.has('proof_of_address')) missing.push('proof_of_address_not_uploaded')
  }

  return { eligible: missing.length === 0, missing }
}

export interface OnboardingProgressDTO {
  accountMode: 'CUSTOMER' | 'BUSINESS'
  onboardingStatus: string
  verificationStatus: string
  sellerAccountStatus: string
  storeStatus: string | null
  sellerTier: string | null
  percentComplete: number
  steps: { key: string; label: string; done: boolean; required: boolean }[]
  currentRecommendedStep: string
  canSubmit: boolean
  missingRequirements: string[]
}

export async function computeOnboardingProgress(userId: string): Promise<OnboardingProgressDTO> {
  const userResult = await query(
    `SELECT is_business_account FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  )
  const isBusinessAccount = Boolean(userResult.rows[0]?.is_business_account)

  const profileResult = await query(`SELECT * FROM seller_profiles WHERE user_id = $1 LIMIT 1`, [
    userId,
  ])
  const profile = profileResult.rows[0]

  if (!profile) {
    return {
      accountMode: isBusinessAccount ? 'BUSINESS' : 'CUSTOMER',
      onboardingStatus: 'NOT_STARTED',
      verificationStatus: 'NOT_STARTED',
      sellerAccountStatus: 'DRAFT',
      storeStatus: null,
      sellerTier: null,
      percentComplete: 0,
      steps: [
        { key: 'seller_type', label: 'Choose seller type', done: false, required: true },
        { key: 'profile', label: 'Personal or business information', done: false, required: true },
        { key: 'documents', label: 'Identity verification', done: false, required: true },
        { key: 'terms', label: 'Marketplace agreements', done: false, required: true },
        { key: 'submit', label: 'Review and submit', done: false, required: true },
      ],
      currentRecommendedStep: 'seller_type',
      canSubmit: false,
      missingRequirements: ['onboarding_not_started'],
    }
  }

  const eligibility = await evaluateSubmissionEligibility(profile.id)

  const documentsResult = await query(
    `SELECT category FROM seller_verification_documents
     WHERE seller_profile_id = $1 AND is_current = TRUE AND upload_status = 'uploaded'`,
    [profile.id],
  )
  const hasAnyDocument = documentsResult.rows.length > 0

  const steps = [
    { key: 'seller_type', label: 'Choose seller type', done: Boolean(profile.seller_type), required: true },
    {
      key: 'profile',
      label: 'Personal or business information',
      done: !eligibility.missing.some((m) => m.startsWith('seller_type_details')),
      required: true,
    },
    { key: 'documents', label: 'Identity verification', done: hasAnyDocument, required: true },
    { key: 'terms', label: 'Marketplace agreements', done: Boolean(profile.terms_accepted), required: true },
    {
      key: 'submit',
      label: 'Review and submit',
      done: ['SUBMITTED', 'COMPLETED'].includes(profile.onboarding_status),
      required: true,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const percentComplete = Math.round((doneCount / steps.length) * 100)
  const currentRecommendedStep = steps.find((s) => !s.done)?.key || 'submit'

  return {
    accountMode: isBusinessAccount ? 'BUSINESS' : 'CUSTOMER',
    onboardingStatus: profile.onboarding_status,
    verificationStatus: profile.verification_status,
    sellerAccountStatus: profile.account_status,
    storeStatus: profile.store_status,
    sellerTier: profile.tier,
    percentComplete,
    steps,
    currentRecommendedStep,
    canSubmit: eligibility.eligible && profile.onboarding_status === 'IN_PROGRESS',
    missingRequirements: eligibility.missing,
  }
}

export interface CapabilitiesDTO {
  accountMode: 'CUSTOMER' | 'BUSINESS'
  onboardingStatus: string
  verificationStatus: string
  sellerAccountStatus: string
  storeStatus: string | null
  sellerTier: string | null
  canAccessSellerCenter: boolean
  canManageProducts: boolean
  canPublishProducts: boolean
  canReceiveOrders: boolean
  canUseCreatorTools: boolean
  canViewFinances: boolean
  canOpenStorefront: boolean
  requiredNextAction: string
  blockingReasons: string[]
}

export async function resolveSellerCapabilities(userId: string): Promise<CapabilitiesDTO> {
  const result = await query(
    `SELECT sp.*, u.is_business_account,
            EXISTS(SELECT 1 FROM creator_profiles cp WHERE cp.user_id = u.id) AS has_creator_profile
     FROM users u
     LEFT JOIN seller_profiles sp ON sp.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId],
  )
  const row = result.rows[0]
  // The query is a LEFT JOIN from users, so `row` itself is always
  // truthy for any real userId -- "no seller profile yet" shows up as
  // `row.id` (seller_profiles.id) being null/undefined, not as a
  // missing row. Checking `!row` here was dead code that could never
  // run; this is the actual, reachable signal for "never started."
  const hasSellerProfile = Boolean(row?.id)

  const isBusinessAccount = Boolean(row?.is_business_account)
  const accountStatus: string = row?.account_status || 'DRAFT'
  const storeStatus: string | null = row?.store_status || null
  const onboardingStatus: string = row?.onboarding_status || 'NOT_STARTED'
  const verificationStatus: string = row?.verification_status || 'NOT_STARTED'
  const hasCreatorProfile = Boolean(row?.has_creator_profile)

  const isActive = accountStatus === 'ACTIVE'
  // Business-strategy gate (not a security one): let anyone who has
  // started onboarding in to build immediately -- create/edit products,
  // manage content, see their own (possibly $0) balance -- so they
  // spend time on the platform instead of waiting on a review queue
  // before they can do anything at all. SUSPENDED/CLOSED are the only
  // states that actually cut a seller off from their own workspace; a
  // REJECTED seller still needs in to see why and resubmit, and a
  // PENDING_REVIEW/DRAFT seller needs in to have something worth
  // reviewing in the first place. The one thing that still requires
  // real verification is going PUBLIC: a storefront customers can find
  // and buy from (canOpenStorefront, below) -- untouched by this.
  const isInGoodStanding = accountStatus !== 'SUSPENDED' && accountStatus !== 'CLOSED'

  const blockingReasons: string[] = []
  let requiredNextAction = 'NONE'

  // Account-standing checks come first, deliberately: they describe a
  // decision that was already made about this seller (suspended,
  // closed, restricted, rejected), which is always more specific and
  // more actionable than a generic progress-based status like "still
  // submitted, awaiting review" -- several of these states legitimately
  // overlap with onboardingStatus='SUBMITTED' && !isActive, so getting
  // this order right is what keeps a rejected seller from being told
  // they're merely "awaiting review".
  if (!hasSellerProfile) {
    requiredNextAction = 'START_ONBOARDING'
    blockingReasons.push('No seller application has been started yet.')
  } else if (accountStatus === 'SUSPENDED') {
    requiredNextAction = 'CONTACT_SUPPORT'
    blockingReasons.push('Your seller account is suspended.')
  } else if (accountStatus === 'CLOSED') {
    requiredNextAction = 'NONE'
    blockingReasons.push('Your seller account is closed.')
  } else if (accountStatus === 'RESTRICTED') {
    requiredNextAction = 'CONTACT_SUPPORT'
    blockingReasons.push('Your seller account is restricted.')
  } else if (accountStatus === 'REJECTED') {
    requiredNextAction = 'REVIEW_REJECTION'
    blockingReasons.push('Your seller application was not approved.')
  } else if (onboardingStatus === 'NOT_STARTED' || onboardingStatus === 'IN_PROGRESS') {
    requiredNextAction = 'COMPLETE_ONBOARDING'
    blockingReasons.push('Finish and submit your seller application to go public and start selling.')
  } else if (verificationStatus === 'MORE_INFORMATION_REQUIRED') {
    requiredNextAction = 'PROVIDE_MORE_INFORMATION'
    blockingReasons.push('We need more information before your storefront can go live.')
  } else if (onboardingStatus === 'SUBMITTED' && !isActive) {
    requiredNextAction = 'AWAIT_REVIEW'
    blockingReasons.push('Your application is submitted and awaiting review before your storefront can go live.')
  }

  return {
    accountMode: isBusinessAccount ? 'BUSINESS' : 'CUSTOMER',
    onboardingStatus,
    verificationStatus,
    sellerAccountStatus: accountStatus,
    storeStatus,
    sellerTier: row?.tier || null,
    canAccessSellerCenter: hasSellerProfile && isInGoodStanding,
    canManageProducts: hasSellerProfile && isInGoodStanding,
    canPublishProducts: hasSellerProfile && isInGoodStanding,
    canReceiveOrders: isActive,
    canUseCreatorTools: hasSellerProfile && isInGoodStanding && hasCreatorProfile,
    canViewFinances: hasSellerProfile && isInGoodStanding,
    canOpenStorefront: storeStatus === 'LIVE',
    requiredNextAction,
    blockingReasons,
  }
}
