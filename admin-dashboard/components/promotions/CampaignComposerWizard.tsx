'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import promotionService, { CampaignDetail } from '@/services/promotion.service'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CampaignStatusBadge } from './CampaignStatusBadge'
import { ProductsCouponStep } from './steps/ProductsCouponStep'
import { MessageCreativeStep } from './steps/MessageCreativeStep'
import { ChannelsStep } from './steps/ChannelsStep'
import { ReviewValidateStep } from './steps/ReviewValidateStep'
import { ScheduleStep } from './steps/ScheduleStep'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const STEPS = [
  { key: 'products', label: 'Products & Offer' },
  { key: 'creative', label: 'Message & Creative' },
  { key: 'channels', label: 'Channels' },
  { key: 'review', label: 'Review & Validate' },
  { key: 'schedule', label: 'Schedule / Publish' },
] as const

type StepKey = (typeof STEPS)[number]['key']

interface CampaignComposerWizardProps {
  campaignId: string
}

/**
 * Steps 2-6 of the composer (step 1, Basics, is new/page.tsx's create
 * form -- see that file's header comment for why campaign creation itself
 * isn't part of this wizard). Not a pixel-match of every wireframe section
 * in the founder's spec, but every functional requirement in the chain
 * (products/coupon -> message -> channel overrides -> validate -> preview
 * -> schedule/publish-now with per-channel status) is real here, not
 * simulated -- see docs/PROMOTION-OPS-1-IMPLEMENTATION-REPORT.md.
 */
export function CampaignComposerWizard({ campaignId }: CampaignComposerWizardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'campaign', campaignId],
    queryFn: () => promotionService.getCampaign(campaignId),
  })

  const campaign = data?.campaign

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['promotions', 'campaign', campaignId] })

  if (isLoading || !campaign) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-96 rounded-lg' />
      </div>
    )
  }

  const isEditable = campaign.status === 'DRAFT'

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>{campaign.name}</h1>
          <p className='text-sm text-muted-foreground'>{campaign.campaignKey}</p>
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      {!isEditable && (
        <div className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'>
          This campaign is {campaign.status.toLowerCase().replace('_', ' ')} and can no longer be edited. View its{' '}
          <button className='underline' onClick={() => router.push(`/dashboard/promotions/${campaignId}`)}>
            detail page
          </button>{' '}
          for status and performance.
        </div>
      )}

      <nav className='flex items-center gap-1 overflow-x-auto border-b pb-2'>
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStepIndex(i)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              i === stepIndex ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </nav>

      <div>{renderStep(step.key, campaign, isEditable, refetch)}</div>

      <div className='flex items-center justify-between border-t pt-4'>
        <Button variant='outline' onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>
          <ChevronLeft className='mr-1 h-4 w-4' /> Back
        </Button>
        {stepIndex < STEPS.length - 1 ? (
          <Button onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}>
            Next <ChevronRight className='ml-1 h-4 w-4' />
          </Button>
        ) : (
          <Button variant='ghost' onClick={() => router.push(`/dashboard/promotions/${campaignId}`)}>
            Go to campaign detail
          </Button>
        )}
      </div>
    </div>
  )
}

function renderStep(step: StepKey, campaign: CampaignDetail, isEditable: boolean, refetch: () => void) {
  switch (step) {
    case 'products':
      return <ProductsCouponStep campaign={campaign} isEditable={isEditable} onSaved={refetch} />
    case 'creative':
      return <MessageCreativeStep campaign={campaign} isEditable={isEditable} onSaved={refetch} />
    case 'channels':
      return <ChannelsStep campaign={campaign} isEditable={isEditable} onSaved={refetch} />
    case 'review':
      return <ReviewValidateStep campaign={campaign} onValidated={refetch} />
    case 'schedule':
      return <ScheduleStep campaign={campaign} onChanged={refetch} />
    default:
      return null
  }
}
