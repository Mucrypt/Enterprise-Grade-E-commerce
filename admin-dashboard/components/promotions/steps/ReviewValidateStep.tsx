'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import promotionService, { CampaignDetail, ChannelValidationResult, SocialPlatform } from '@/services/promotion.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

interface StepProps {
  campaign: CampaignDetail
  onValidated: () => void
}

export function ReviewValidateStep({ campaign, onValidated }: StepProps) {
  const [results, setResults] = useState<Record<string, ChannelValidationResult> | null>(null)

  const mutation = useMutation({
    mutationFn: () => promotionService.validateCampaign(campaign.id),
    onSuccess: (data) => {
      setResults(data.results)
      onValidated()
    },
  })

  if (campaign.channels.length === 0) {
    return <p className='text-sm text-muted-foreground'>Select at least one channel in the previous step before validating.</p>
  }

  return (
    <div className='space-y-4'>
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Validating...' : 'Run validation'}
      </Button>

      <Tabs defaultValue={campaign.channels[0]?.channel}>
        <TabsList>
          {campaign.channels.map((c) => (
            <TabsTrigger key={c.channel} value={c.channel}>
              {c.channel}
              {results?.[c.channel] && (
                results[c.channel].valid ? (
                  <CheckCircle2 className='ml-1.5 h-3.5 w-3.5 text-green-600' />
                ) : (
                  <XCircle className='ml-1.5 h-3.5 w-3.5 text-destructive' />
                )
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {campaign.channels.map((c) => (
          <TabsContent key={c.channel} value={c.channel}>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Preview -- {c.channel}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='rounded-md border p-3 text-sm'>
                  <p className='whitespace-pre-wrap'>{c.messageOverride || campaign.masterMessage}</p>
                  {c.linkUrl && <p className='mt-2 truncate text-xs text-blue-600'>{c.linkUrl}</p>}
                  {c.hashtags.length > 0 && <p className='mt-1 text-xs text-muted-foreground'>{c.hashtags.join(' ')}</p>}
                </div>
                {campaign.creativeAssets.length > 0 && (
                  <div className='flex gap-2'>
                    {campaign.creativeAssets.map((a) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={a.key} src={a.url} alt='' className='h-20 w-20 rounded object-cover' />
                    ))}
                  </div>
                )}
                <ValidationList result={results?.[c.channel as SocialPlatform]} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function ValidationList({ result }: { result?: ChannelValidationResult }) {
  if (!result) return <p className='text-xs text-muted-foreground'>Run validation to see channel-specific checks.</p>
  return (
    <div className='space-y-1'>
      {result.errors.map((e, i) => (
        <p key={`e-${i}`} className='flex items-start gap-1.5 text-xs text-destructive'>
          <XCircle className='mt-0.5 h-3.5 w-3.5 shrink-0' /> {e}
        </p>
      ))}
      {result.warnings.map((w, i) => (
        <p key={`w-${i}`} className='flex items-start gap-1.5 text-xs text-amber-600'>
          <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0' /> {w}
        </p>
      ))}
      {result.valid && result.errors.length === 0 && result.warnings.length === 0 && (
        <p className='flex items-center gap-1.5 text-xs text-green-600'>
          <CheckCircle2 className='h-3.5 w-3.5' /> Ready
        </p>
      )}
    </div>
  )
}
