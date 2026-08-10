'use client'

import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import promotionService from '@/services/promotion.service'
import { CampaignStatusBadge } from '@/components/promotions/CampaignStatusBadge'
import { ChannelStatusBadge } from '@/components/promotions/ChannelStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Pencil, ExternalLink } from 'lucide-react'

function CampaignDetailPageContent() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'campaign', params.id],
    queryFn: () => promotionService.getCampaign(params.id),
  })

  const cancelMutation = useMutation({
    mutationFn: () => promotionService.cancelCampaign(params.id),
    onSuccess: () => {
      toast.success('Campaign cancelled.')
      queryClient.invalidateQueries({ queryKey: ['promotions', 'campaign', params.id] })
    },
    onError: () => toast.error('Failed to cancel campaign.'),
  })

  if (isLoading || !data) {
    return <Skeleton className='h-96 rounded-lg' />
  }

  const campaign = data.campaign
  const canCancel = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED'
  const canEdit = campaign.status === 'DRAFT'

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>{campaign.name}</h1>
          <p className='text-sm text-muted-foreground'>{campaign.campaignKey}</p>
        </div>
        <div className='flex items-center gap-2'>
          <CampaignStatusBadge status={campaign.status} />
          {canEdit && (
            <Button variant='outline' onClick={() => router.push(`/dashboard/promotions/${campaign.id}/edit`)}>
              <Pencil className='mr-1.5 h-4 w-4' /> Edit
            </Button>
          )}
          {canCancel && (
            <Button variant='destructive' onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Cancel campaign
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue='overview'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='channels'>Channels</TabsTrigger>
          <TabsTrigger value='performance'>Performance</TabsTrigger>
          <TabsTrigger value='activity'>Activity</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-4'>
          <div className='grid gap-4 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Details</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-sm'>
                <Row label='Objective' value={campaign.objective || '—'} />
                <Row label='Coupon' value={campaign.couponId || 'None attached'} />
                <Row label='Landing URL' value={campaign.landingUrl || '—'} />
                <Row label='Timezone' value={campaign.timezone} />
                <Row label='Scheduled' value={campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : '—'} />
                <Row label='Published' value={campaign.publishedAt ? new Date(campaign.publishedAt).toLocaleString() : '—'} />
                <Row label='Mode' value={campaign.dryRun ? 'DRY RUN (simulated)' : 'Live'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Products ({campaign.products.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.products.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No products attached.</p>
                ) : (
                  <ul className='space-y-1 text-sm'>
                    {campaign.products.map((p) => (
                      <li key={p.id} className='flex justify-between'>
                        <span>{p.name}</span>
                        <span className='text-muted-foreground'>{p.price != null ? `€${Number(p.price).toFixed(2)}` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Master message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap text-sm'>{campaign.masterMessage || '—'}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='channels'>
          <div className='rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last error</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.channels.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className='font-medium'>{c.channel}</TableCell>
                    <TableCell>
                      <ChannelStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>
                      {c.attemptCount} / {c.maxRetries}
                    </TableCell>
                    <TableCell className='max-w-xs truncate text-sm text-muted-foreground'>{c.lastError || '—'}</TableCell>
                    <TableCell>
                      {c.remotePermalink ? (
                        <a href={c.remotePermalink} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1 text-blue-600 hover:underline'>
                          View <ExternalLink className='h-3 w-3' />
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value='performance'>
          <PerformanceTab campaignId={campaign.id} />
        </TabsContent>

        <TabsContent value='activity'>
          <ActivityTab campaignId={campaign.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between border-b py-1 last:border-0'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='max-w-[60%] truncate text-right'>{value}</span>
    </div>
  )
}

function PerformanceTab({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'campaign', campaignId, 'metrics'],
    queryFn: () => promotionService.getCampaignMetrics(campaignId),
  })

  if (isLoading) return <Skeleton className='h-64 rounded-lg' />
  if (!data) return null

  return (
    <div className='space-y-3'>
      <div className='grid gap-3 md:grid-cols-2'>
        {data.channels.map((c) => (
          <Card key={c.channel}>
            <CardHeader>
              <CardTitle className='flex items-center justify-between text-base'>
                {c.channel}
                <ChannelStatusBadge status={c.status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {c.metrics ? (
                <ul className='space-y-1 text-sm'>
                  <li className='flex justify-between'><span>Impressions</span><span>{c.metrics.impressions ?? '—'}</span></li>
                  <li className='flex justify-between'><span>Reach</span><span>{c.metrics.reach ?? '—'}</span></li>
                  <li className='flex justify-between'><span>Likes</span><span>{c.metrics.likes ?? '—'}</span></li>
                  <li className='flex justify-between'><span>Comments</span><span>{c.metrics.comments ?? '—'}</span></li>
                  <li className='flex justify-between'><span>Shares</span><span>{c.metrics.shares ?? '—'}</span></li>
                  <li className='flex justify-between'><span>Clicks</span><span>{c.metrics.clicks ?? '—'}</span></li>
                </ul>
              ) : (
                <p className='text-sm text-muted-foreground'>No metric snapshot yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className='text-xs text-muted-foreground'>{data.dataQuality.note}</p>
    </div>
  )
}

function ActivityTab({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'campaign', campaignId, 'activity'],
    queryFn: () => promotionService.getCampaignActivity(campaignId),
  })

  if (isLoading) return <Skeleton className='h-64 rounded-lg' />
  if (!data || data.activity.length === 0) return <p className='text-sm text-muted-foreground'>No activity recorded yet.</p>

  return (
    <ul className='space-y-2'>
      {data.activity.map((entry) => (
        <li key={entry.id} className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
          <span>
            <span className='font-medium'>{entry.action.replace(/_/g, ' ').toLowerCase()}</span>
            {!entry.actorUserId && <span className='ml-2 text-xs text-muted-foreground'>(system)</span>}
          </span>
          <span className='text-xs text-muted-foreground'>{new Date(entry.createdAt).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  )
}

export default function CampaignDetailPage() {
  return (
    <RequirePagePermission permission='campaigns.view'>
      <CampaignDetailPageContent />
    </RequirePagePermission>
  )
}
