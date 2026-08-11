import { Badge } from '@/components/ui/badge'
import type { CampaignStatus } from '@/services/promotion.service'

const STATUS_STYLE: Record<CampaignStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  SCHEDULED: { label: 'Scheduled', variant: 'secondary' },
  PUBLISHING: { label: 'Publishing', variant: 'secondary' },
  PARTIAL_SUCCESS: { label: 'Partial Success', variant: 'destructive' },
  PUBLISHED: { label: 'Published', variant: 'default' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
  // Distinct, unmissable label -- a dry-run completion must never read as
  // (or be visually confusable with) a real PUBLISHED campaign.
  DRY_RUN_COMPLETED: { label: 'Dry Run Completed', variant: 'outline' },
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const style = STATUS_STYLE[status]
  return <Badge variant={style.variant}>{style.label}</Badge>
}
