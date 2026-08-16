'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import channelService from '@/services/channel.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

const MAPPING_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  MAPPED: 'default',
  UNMAPPED: 'secondary',
  CHANNEL_ONLY: 'outline',
  CONFLICT: 'destructive',
}

/**
 * Preview-then-commit product/SKU mapping UI -- same two-step pattern as
 * the supplier CSV-import flow. "Preview sync" is safe (read + diff only,
 * writes nothing outside channel_sync_runs); "Commit" is the one action
 * that actually writes channel_product_mappings, and is a deliberate,
 * separate click -- never automatic, per the founder's explicit
 * "do not automatically overwrite TikTok listings" instruction (which
 * applies symmetrically here: TechTools never auto-applies what it read
 * from TikTok either, without a human reviewing the diff first).
 */
function ProductMappingsPageContent() {
  const queryClient = useQueryClient()
  const [activeRun, setActiveRun] = useState<{ runId: string; toCreate: number; toUpdate: number; unmapped: number } | null>(null)

  const { data: accountsData } = useQuery({
    queryKey: ['channels', 'accounts'],
    queryFn: () => channelService.listAccounts(),
  })
  const account = accountsData?.accounts.find((a) => a.channelType === 'TIKTOK_SHOP')

  const { data: mappingsData, isLoading } = useQuery({
    queryKey: ['channels', 'products', account?.id],
    queryFn: () => channelService.listProductMappings(account?.id),
    enabled: !!account,
  })

  const previewMutation = useMutation({
    mutationFn: () => channelService.previewProductSync(account!.id),
    onSuccess: (result) => {
      if (result.success) {
        setActiveRun({ runId: result.data.runId, toCreate: result.data.toCreate, toUpdate: result.data.toUpdate, unmapped: result.data.unmapped })
        toast.success(`Preview ready: ${result.data.toCreate} new, ${result.data.toUpdate} updated, ${result.data.unmapped} unmapped.`)
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to preview product sync.'),
  })

  const commitMutation = useMutation({
    mutationFn: () => channelService.commitProductSync(account!.id, activeRun!.runId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Committed: ${result.data.createdCount} created, ${result.data.updatedCount} updated.`)
        setActiveRun(null)
        queryClient.invalidateQueries({ queryKey: ['channels', 'products'] })
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to commit product sync.'),
  })

  const { data: diffsData } = useQuery({
    queryKey: ['channels', 'inventory-diffs', account?.id],
    queryFn: () => channelService.listInventoryDiffs(account?.id),
    enabled: !!account,
  })

  const inventoryDiffMutation = useMutation({
    mutationFn: () => channelService.runInventoryDiff(account!.id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Compared ${result.data.comparedCount} SKU(s) -- ${result.data.flaggedCount} mismatch(es) flagged.`)
        queryClient.invalidateQueries({ queryKey: ['channels', 'inventory-diffs'] })
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to run inventory diff.'),
  })

  const flaggedDiffs = (diffsData?.diffs || []).filter((d) => d.action_taken === 'FLAGGED')

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Product Mappings</h1>
          <p className='text-muted-foreground'>TechTools product ↔ TikTok Shop listing/SKU links, with the last observed diff.</p>
        </div>
        {account && (
          <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} className='gap-1.5'>
            <RefreshCw className='h-4 w-4' /> {previewMutation.isPending ? 'Comparing...' : 'Preview sync'}
          </Button>
        )}
      </div>

      {!account && (
        <Card className='border-dashed'>
          <CardContent className='py-8 text-center text-sm text-muted-foreground'>
            No TikTok Shop connected yet. <a href='/dashboard/channels/tiktok/connection' className='underline'>Connect a shop</a> first.
          </CardContent>
        </Card>
      )}

      {activeRun && (
        <Card className='border-orange-200 bg-orange-50/50 dark:bg-orange-950/20'>
          <CardHeader>
            <CardTitle className='text-base'>Preview ready</CardTitle>
            <CardDescription>
              {activeRun.toCreate} new mapping(s), {activeRun.toUpdate} update(s), {activeRun.unmapped} unmapped listing(s). Nothing has
              been applied yet.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex gap-2'>
            <Button onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending}>
              {commitMutation.isPending ? 'Committing...' : 'Commit'}
            </Button>
            <Button variant='outline' onClick={() => setActiveRun(null)}>Discard</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className='h-64 rounded-lg' />
      ) : (
        <Card>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TechTools Product</TableHead>
                  <TableHead>TikTok Listing</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mappingsData?.mappings || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='py-8 text-center text-sm text-muted-foreground'>
                      No mappings yet -- run a preview sync to compare TechTools products against TikTok Shop listings.
                    </TableCell>
                  </TableRow>
                ) : (
                  mappingsData!.mappings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.product_name || <span className='text-muted-foreground'>Unmapped</span>}</TableCell>
                      <TableCell className='font-mono text-xs'>{m.channel_product_id}</TableCell>
                      <TableCell className='font-mono text-xs'>{m.channel_sku || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={MAPPING_STATUS_VARIANT[m.mapping_status] || 'outline'}>{m.mapping_status}</Badge>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {m.last_synced_at ? new Date(m.last_synced_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {account && (
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <div>
              <CardTitle className='text-base'>Inventory diff</CardTitle>
              <CardDescription>TechTools stock (the authoritative source) versus what TikTok Shop currently reports. Read-only -- never writes to either side.</CardDescription>
            </div>
            <Button variant='outline' size='sm' onClick={() => inventoryDiffMutation.mutate()} disabled={inventoryDiffMutation.isPending} className='gap-1.5'>
              <RefreshCw className='h-4 w-4' /> {inventoryDiffMutation.isPending ? 'Comparing...' : 'Run diff'}
            </Button>
          </CardHeader>
          <CardContent className='p-0'>
            {flaggedDiffs.length === 0 ? (
              <p className='px-6 pb-6 text-sm text-muted-foreground'>No stock mismatches flagged.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className='text-right'>TechTools Stock</TableHead>
                    <TableHead className='text-right'>TikTok Reported Stock</TableHead>
                    <TableHead className='text-right'>Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flaggedDiffs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.product_name || d.channel_sku || d.channel_product_id}</TableCell>
                      <TableCell className='text-right'>{d.techtools_available_stock ?? '—'}</TableCell>
                      <TableCell className='text-right'>{d.channel_reported_stock ?? '—'}</TableCell>
                      <TableCell className='text-right'>
                        <Badge variant='destructive'>{d.delta !== null && d.delta > 0 ? `+${d.delta}` : d.delta}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ProductMappingsPage() {
  return (
    <RequirePagePermission permission='channels.tiktok.products'>
      <ProductMappingsPageContent />
    </RequirePagePermission>
  )
}
