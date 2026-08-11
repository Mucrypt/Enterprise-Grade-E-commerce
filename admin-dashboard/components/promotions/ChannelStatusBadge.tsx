import { Badge } from '@/components/ui/badge'
import type { ChannelPostStatus, PlatformReadiness } from '@/services/promotion.service'

const STATUS_STYLE: Record<ChannelPostStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  QUEUED: { label: 'Queued', variant: 'secondary' },
  PUBLISHING: { label: 'Publishing', variant: 'secondary' },
  PUBLISHED: { label: 'Published', variant: 'default' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
  // Distinct from PUBLISHED -- a simulated publish must never be
  // confusable with a genuine one (Production Review Round 1 §3).
  DRY_RUN_SUCCEEDED: { label: 'Dry Run Succeeded', variant: 'outline' },
  // The outcome is genuinely unknown (e.g. a network failure with no
  // definitive response) -- never auto-retried, needs a human decision
  // (Production Review Round 1 §4).
  REQUIRES_ACTION: { label: 'Requires Action', variant: 'destructive' },
}

export function ChannelStatusBadge({ status }: { status: ChannelPostStatus }) {
  const style = STATUS_STYLE[status]
  return <Badge variant={style.variant}>{style.label}</Badge>
}

const READINESS_STYLE: Record<PlatformReadiness, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  NOT_CONFIGURED: { label: 'Not configured', variant: 'outline' },
  NEEDS_CREDENTIALS: { label: 'Needs credentials', variant: 'secondary' },
  AVAILABLE: { label: 'Available', variant: 'default' },
}

export function PlatformReadinessBadge({ readiness }: { readiness: PlatformReadiness }) {
  const style = READINESS_STYLE[readiness]
  return <Badge variant={style.variant}>{style.label}</Badge>
}
