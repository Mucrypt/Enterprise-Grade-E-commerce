// One shared mapping from a seller's real verification_status/is_suspended
// to a label + color -- reused in the topbar and anywhere else a status
// chip is needed, so "approved" never looks different in two places.

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  approved: { label: 'Verified seller', className: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Verification pending', className: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Verification rejected', className: 'bg-red-100 text-red-700' },
  suspended: { label: 'Suspended', className: 'bg-red-100 text-red-700' },
  none: { label: 'Not verified', className: 'bg-gray-100 text-gray-600' },
}

export default function SellerStatusBadge({
  verificationStatus,
  isSuspended,
}: {
  verificationStatus: string
  isSuspended?: boolean
}) {
  const status = isSuspended ? 'suspended' : STATUS_STYLES[verificationStatus] ? verificationStatus : 'none'
  const style = STATUS_STYLES[status]

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  )
}
