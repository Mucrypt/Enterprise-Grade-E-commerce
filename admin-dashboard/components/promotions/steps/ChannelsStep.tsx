'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import promotionService, { CampaignDetail, SocialPlatform, SOCIAL_PLATFORMS } from '@/services/promotion.service'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlatformReadinessBadge } from '../ChannelStatusBadge'
import { toast } from 'sonner'

interface StepProps {
  campaign: CampaignDetail
  isEditable: boolean
  onSaved: () => void
}

interface ChannelDraft {
  channel: SocialPlatform
  selected: boolean
  connectionId: string | null
  messageOverride: string
  hashtags: string
}

function buildInitialDrafts(campaign: CampaignDetail): Record<SocialPlatform, ChannelDraft> {
  const byChannel = new Map(campaign.channels.map((c) => [c.channel, c]))
  const drafts = {} as Record<SocialPlatform, ChannelDraft>
  for (const channel of SOCIAL_PLATFORMS) {
    const existing = byChannel.get(channel)
    drafts[channel] = {
      channel,
      selected: Boolean(existing),
      connectionId: existing?.connectionId || null,
      messageOverride: existing?.messageOverride || '',
      hashtags: existing?.hashtags.join(' ') || '',
    }
  }
  return drafts
}

export function ChannelsStep({ campaign, isEditable, onSaved }: StepProps) {
  const [drafts, setDrafts] = useState<Record<SocialPlatform, ChannelDraft>>(() => buildInitialDrafts(campaign))

  const { data: capabilitiesData } = useQuery({
    queryKey: ['promotions', 'capabilities'],
    queryFn: () => promotionService.getCapabilities(),
  })
  const { data: connectionsData } = useQuery({
    queryKey: ['promotions', 'connections-for-picker'],
    queryFn: () => promotionService.listConnections(),
  })

  const capabilities = capabilitiesData?.capabilities || []
  const connections = connectionsData?.connections || []

  const mutation = useMutation({
    mutationFn: () =>
      promotionService.updateCampaign(campaign.id, {
        channels: Object.values(drafts)
          .filter((d) => d.selected)
          .map((d) => ({
            channel: d.channel,
            connectionId: d.connectionId,
            messageOverride: d.messageOverride || null,
            hashtags: d.hashtags.split(/\s+/).filter(Boolean),
          })),
      }),
    onSuccess: () => {
      toast.success('Channels saved.')
      onSaved()
    },
    onError: () => toast.error('Failed to save -- please try again.'),
  })

  const updateDraft = (channel: SocialPlatform, patch: Partial<ChannelDraft>) => {
    setDrafts((prev) => ({ ...prev, [channel]: { ...prev[channel], ...patch } }))
  }

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 lg:grid-cols-2'>
        {SOCIAL_PLATFORMS.map((channel) => {
          const capability = capabilities.find((c) => c.platform === channel)
          const draft = drafts[channel]
          const channelConnections = connections.filter((c) => c.platform === channel && !c.disabledByAdmin)

          return (
            <Card key={channel} className={draft.selected ? '' : 'opacity-70'}>
              <CardHeader className='pb-2'>
                <CardTitle className='flex items-center justify-between text-base'>
                  <span className='flex items-center gap-2'>
                    <Checkbox
                      checked={draft.selected}
                      onCheckedChange={(checked: boolean) => updateDraft(channel, { selected: Boolean(checked) })}
                      disabled={!isEditable}
                      id={`channel-${channel}`}
                    />
                    <label htmlFor={`channel-${channel}`} className='cursor-pointer capitalize'>
                      {channel.charAt(0) + channel.slice(1).toLowerCase()}
                    </label>
                  </span>
                  {capability && <PlatformReadinessBadge readiness={capability.readiness} />}
                </CardTitle>
              </CardHeader>
              {draft.selected && (
                <CardContent className='space-y-2'>
                  <Select
                    value={draft.connectionId || 'none'}
                    onValueChange={(value: string) => updateDraft(channel, { connectionId: value === 'none' ? null : value })}
                    disabled={!isEditable}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select connected account' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>No account selected</SelectItem>
                      {channelConnections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.displayName || c.externalAccountId || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {channelConnections.length === 0 && (
                    <p className='text-xs text-muted-foreground'>
                      No connected {channel.toLowerCase()} account -- connect one under Marketing &gt; Connections.
                    </p>
                  )}
                  <Textarea
                    rows={3}
                    placeholder='Customize the master message for this channel (optional)'
                    value={draft.messageOverride}
                    onChange={(e) => updateDraft(channel, { messageOverride: e.target.value })}
                    disabled={!isEditable}
                  />
                  <input
                    className='w-full rounded-md border bg-transparent px-3 py-1.5 text-sm'
                    placeholder='#hashtags #space-separated'
                    value={draft.hashtags}
                    onChange={(e) => updateDraft(channel, { hashtags: e.target.value })}
                    disabled={!isEditable}
                  />
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
      {isEditable && (
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save channels'}
        </Button>
      )}
    </div>
  )
}
