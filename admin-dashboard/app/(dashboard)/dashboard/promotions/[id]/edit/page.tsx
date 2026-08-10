'use client'

import { useParams } from 'next/navigation'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { CampaignComposerWizard } from '@/components/promotions/CampaignComposerWizard'

function EditPromotionPageContent() {
  const params = useParams<{ id: string }>()
  return <CampaignComposerWizard campaignId={params.id} />
}

export default function EditPromotionPage() {
  return (
    <RequirePagePermission permission='campaigns.manage'>
      <EditPromotionPageContent />
    </RequirePagePermission>
  )
}
