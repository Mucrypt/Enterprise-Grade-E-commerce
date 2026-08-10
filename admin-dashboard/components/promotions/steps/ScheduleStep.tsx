'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import promotionService, { CampaignDetail } from '@/services/promotion.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'

interface StepProps {
  campaign: CampaignDetail
  onChanged: () => void
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return fallback
}

export function ScheduleStep({ campaign, onChanged }: StepProps) {
  const router = useRouter()
  const [scheduledAt, setScheduledAt] = useState('')
  const isEditable = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED'

  const scheduleMutation = useMutation({
    mutationFn: () => promotionService.scheduleCampaign(campaign.id, new Date(scheduledAt).toISOString()),
    onSuccess: () => {
      toast.success('Campaign scheduled.')
      onChanged()
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to schedule campaign.')),
  })

  const publishNowMutation = useMutation({
    mutationFn: () => promotionService.publishCampaignNow(campaign.id),
    onSuccess: () => {
      toast.success('Publication started -- channels are publishing in the background.')
      onChanged()
      router.push(`/dashboard/promotions/${campaign.id}`)
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to publish campaign.')),
  })

  return (
    <div className='space-y-4'>
      {campaign.dryRun && (
        <div className='flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'>
          <AlertTriangle className='h-4 w-4' /> DRY RUN mode -- publishing will simulate every channel without calling any real
          social platform. No content will actually appear online.
        </div>
      )}

      {!isEditable ? (
        <p className='text-sm text-muted-foreground'>
          This campaign is {campaign.status.toLowerCase().replace('_', ' ')} -- scheduling/publishing actions are no longer
          available here.
        </p>
      ) : (
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Schedule for later</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div>
                <Label htmlFor='scheduled-at'>Date &amp; time ({campaign.timezone})</Label>
                <Input id='scheduled-at' type='datetime-local' value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <Button
                variant='outline'
                onClick={() => scheduleMutation.mutate()}
                disabled={!scheduledAt || scheduleMutation.isPending}
              >
                {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule'}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Publish now</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                Publishes to {campaign.channels.length} connected channel{campaign.channels.length === 1 ? '' : 's'} in the
                background. Each channel succeeds or fails independently -- a failure on one never rolls back another.
              </p>
              <Button onClick={() => publishNowMutation.mutate()} disabled={campaign.channels.length === 0 || publishNowMutation.isPending}>
                {publishNowMutation.isPending ? 'Starting...' : `Publish to ${campaign.channels.length} channel(s)${campaign.dryRun ? ' (DRY RUN)' : ''}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
