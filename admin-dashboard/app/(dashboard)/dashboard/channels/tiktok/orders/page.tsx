'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import channelService from '@/services/channel.service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { RefreshCw, History, AlertTriangle } from 'lucide-react'

/**
 * Read-only imported-order list, an issue-reconciliation queue
 * (Production Review Round 1 §5/§33 -- "a real TikTok order must never
 * disappear silently"), and manual "Import now"/"Backfill" triggers for
 * the same reconciliation the background worker runs automatically (see
 * channel-order-import.worker.ts). No fulfilment/status-write actions
 * here this phase -- these are TikTok Shop orders reflected into
 * TechTools for visibility, not a second order-management surface.
 * techtools_order_id is deliberately never shown/linked -- this phase does
 * not materialize a canonical TechTools order per TikTok sale (see
 * docs/TIKTOK-SHOP-INTEGRATION-ARCHITECTURE.md).
 */
function ChannelOrdersPageContent() {
  const queryClient = useQueryClient()
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [backfillDate, setBackfillDate] = useState('')

  const { data: accountsData } = useQuery({
    queryKey: ['channels', 'accounts'],
    queryFn: () => channelService.listAccounts(),
  })
  const account = accountsData?.accounts.find((a) => a.channelType === 'TIKTOK_SHOP')

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['channels', 'orders', account?.id],
    queryFn: () => channelService.listChannelOrders(account?.id),
    enabled: !!account,
  })

  const { data: issuesData } = useQuery({
    queryKey: ['channels', 'order-issues', account?.id],
    queryFn: () => channelService.listOrderImportIssues(account?.id),
    enabled: !!account,
  })
  const openIssues = issuesData?.issues || []

  const importMutation = useMutation({
    mutationFn: (fromDate?: string) => channelService.runOrderImport(account!.id, fromDate),
    onSuccess: (result) => {
      if (result.success) {
        const d = result.data
        toast.success(
          `${d.importedCount} new, ${d.updatedCount} updated, ${d.staleIgnoredCount} stale ignored, ${d.issueCount} need reconciliation.` +
            (d.complete ? '' : ' Some pages failed -- will retry on the next run.'),
        )
        queryClient.invalidateQueries({ queryKey: ['channels', 'orders'] })
        queryClient.invalidateQueries({ queryKey: ['channels', 'order-issues'] })
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to import orders.'),
  })

  const resolveIssueMutation = useMutation({
    mutationFn: (issueId: string) => channelService.resolveOrderImportIssue(issueId),
    onSuccess: () => {
      toast.success('Issue marked resolved.')
      queryClient.invalidateQueries({ queryKey: ['channels', 'order-issues'] })
    },
    onError: () => toast.error('Failed to resolve issue.'),
  })

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>TikTok Shop Orders</h1>
          <p className='text-muted-foreground'>Orders imported from TikTok Shop, kept current by a background poll every few minutes.</p>
        </div>
        {account && (
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => setBackfillOpen(true)} className='gap-1.5'>
              <History className='h-4 w-4' /> Backfill
            </Button>
            <Button onClick={() => importMutation.mutate(undefined)} disabled={importMutation.isPending} className='gap-1.5'>
              <RefreshCw className='h-4 w-4' /> {importMutation.isPending ? 'Importing...' : 'Import now'}
            </Button>
          </div>
        )}
      </div>

      {!account && (
        <Card className='border-dashed'>
          <CardContent className='py-8 text-center text-sm text-muted-foreground'>
            No TikTok Shop connected yet. <a href='/dashboard/channels/tiktok/connection' className='underline'>Connect a shop</a> first.
          </CardContent>
        </Card>
      )}

      {account && (
        <Tabs defaultValue='orders'>
          <TabsList>
            <TabsTrigger value='orders'>Orders</TabsTrigger>
            <TabsTrigger value='issues'>
              Needs reconciliation {openIssues.length > 0 && <Badge variant='destructive' className='ml-1.5'>{openIssues.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='orders'>
            {isLoading ? (
              <Skeleton className='h-64 rounded-lg' />
            ) : (
              <Card>
                <CardContent className='p-0'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TikTok Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead className='text-right'>Gross Amount</TableHead>
                        <TableHead>Imported</TableHead>
                        <TableHead>Last Synced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ordersData?.orders || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className='py-8 text-center text-sm text-muted-foreground'>
                            No orders imported yet -- run an import, or wait for the next scheduled poll.
                          </TableCell>
                        </TableRow>
                      ) : (
                        ordersData!.orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className='font-mono text-xs'>{o.channel_order_id}</TableCell>
                            <TableCell className='flex items-center gap-1.5'>
                              <Badge variant='outline'>{o.channel_order_status}</Badge>
                              {o.needs_mapping && (
                                <Badge variant='secondary' title='At least one line item has no matching TechTools product yet'>
                                  Needs mapping
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {o.buyer_display_name || '—'} {o.buyer_country ? <span className='text-muted-foreground'>({o.buyer_country})</span> : null}
                            </TableCell>
                            <TableCell className='text-right'>
                              {Number(o.gross_amount).toFixed(2)} {o.currency}
                            </TableCell>
                            <TableCell className='text-sm text-muted-foreground'>{new Date(o.imported_at).toLocaleString()}</TableCell>
                            <TableCell className='text-sm text-muted-foreground'>
                              {o.last_synced_at ? new Date(o.last_synced_at).toLocaleString() : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value='issues'>
            <Card>
              <CardContent className='p-0'>
                {openIssues.length === 0 ? (
                  <p className='px-6 py-8 text-center text-sm text-muted-foreground'>
                    No orders currently require reconciliation -- every fetched order was imported successfully.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>External Order ID</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead>Discovered</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openIssues.map((issue) => (
                        <TableRow key={issue.id}>
                          <TableCell className='font-mono text-xs'>{issue.external_order_id}</TableCell>
                          <TableCell>
                            <Badge variant='destructive' className='gap-1'>
                              <AlertTriangle className='h-3 w-3' /> {issue.reason_code}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-sm text-muted-foreground'>{issue.reason_detail || '—'}</TableCell>
                          <TableCell className='text-sm text-muted-foreground'>{new Date(issue.discovered_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => resolveIssueMutation.mutate(issue.id)}
                              disabled={resolveIssueMutation.isPending}
                            >
                              Mark resolved
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={backfillOpen} onOpenChange={setBackfillOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backfill orders from a date</DialogTitle>
          </DialogHeader>
          <p className='text-sm text-muted-foreground'>
            A one-off historical import from the date you choose through now. This does not affect the regular incremental
            poll's checkpoint -- it runs independently and never skips future scheduled imports.
          </p>
          <Input type='date' value={backfillDate} onChange={(e) => setBackfillDate(e.target.value)} />
          <DialogFooter>
            <Button variant='outline' onClick={() => setBackfillOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!backfillDate || importMutation.isPending}
              onClick={() => {
                importMutation.mutate(new Date(backfillDate).toISOString())
                setBackfillOpen(false)
              }}
            >
              Run backfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ChannelOrdersPage() {
  return (
    <RequirePagePermission permission='channels.tiktok.orders'>
      <ChannelOrdersPageContent />
    </RequirePagePermission>
  )
}
