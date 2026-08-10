'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import promotionService from '@/services/promotion.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

/**
 * Composer step 1 (Basics). Creates a DRAFT campaign row on submit, then
 * routes to [id]/edit for steps 2-6 -- the wizard shell
 * (CampaignComposerWizard) always operates on an existing campaignId, so
 * campaign creation itself lives here rather than inside the wizard.
 */
function NewPromotionPageContent() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [masterMessage, setMasterMessage] = useState('')

  const mutation = useMutation({
    mutationFn: () => promotionService.createCampaign({ name, objective: objective || undefined, masterMessage: masterMessage || undefined }),
    onSuccess: (data) => {
      toast.success('Campaign created.')
      router.push(`/dashboard/promotions/${data.campaign.id}/edit`)
    },
    onError: () => toast.error('Failed to create campaign.'),
  })

  return (
    <div className='mx-auto max-w-2xl space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>New Promotion</h1>
        <p className='text-muted-foreground'>Start with the basics -- you&apos;ll pick products, channels, and creative next.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Campaign basics</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label htmlFor='campaign-name'>Campaign name</Label>
            <Input id='campaign-name' value={name} onChange={(e) => setName(e.target.value)} placeholder='Cordless Tools Weekend Sale' />
          </div>
          <div>
            <Label htmlFor='campaign-objective'>Objective (optional)</Label>
            <Input id='campaign-objective' value={objective} onChange={(e) => setObjective(e.target.value)} placeholder='SALES, PRODUCT_LAUNCH, AWARENESS...' />
          </div>
          <div>
            <Label htmlFor='campaign-message'>Starting message (optional -- refine per-channel later)</Label>
            <Textarea
              id='campaign-message'
              rows={4}
              value={masterMessage}
              onChange={(e) => setMasterMessage(e.target.value)}
              placeholder='Promote the cordless impact drill this weekend...'
            />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewPromotionPage() {
  return (
    <RequirePagePermission permission='campaigns.manage'>
      <NewPromotionPageContent />
    </RequirePagePermission>
  )
}
