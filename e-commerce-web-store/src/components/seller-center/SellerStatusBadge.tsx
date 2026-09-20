// One shared mapping from a seller's real verification_status/is_suspended
// to a label + color -- reused in the topbar and anywhere else a status
// chip is needed, so "APPROVED" never looks different in two places.
// Keys match the `seller_profile_verification_status` Postgres enum
// exactly (uppercase) -- see types/index.ts's SellerVerificationStatus.

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  APPROVED: { label: 'Verified seller', className: 'bg-emerald-100 text-emerald-700' },
  PENDING_REVIEW: { label: 'Verification pending', className: 'bg-amber-100 text-amber-700' },
  MORE_INFORMATION_REQUIRED: { label: 'More info needed', className: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS: { label: 'Verification in progress', className: 'bg-blue-100 text-blue-700' },
  REJECTED: { label: 'Verification rejected', className: 'bg-red-100 text-red-700' },
  EXPIRED: { label: 'Verification expired', className: 'bg-red-100 text-red-700' },
  SUSPENDED: { label: 'Suspended', className: 'bg-red-100 text-red-700' },
  NOT_STARTED: { label: 'Not verified', className: 'bg-gray-100 text-gray-600' },
}

export default function SellerStatusBadge({
  verificationStatus,
  isSuspended,
}: {
  verificationStatus: string
  isSuspended?: boolean
}) {
  const status = isSuspended
    ? 'SUSPENDED'
    : STATUS_STYLES[verificationStatus]
    ? verificationStatus
    : 'NOT_STARTED'
  const style = STATUS_STYLES[status]

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  )
}
