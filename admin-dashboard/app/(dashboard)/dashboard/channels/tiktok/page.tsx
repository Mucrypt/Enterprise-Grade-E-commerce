'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import channelService from '@/services/channel.service'
import { PlatformReadinessBadge } from '@/components/promotions/ChannelStatusBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Link2, Package, ShoppingCart, Store } from 'lucide-react'

/**
 * TIKTOK-COMMERCE-1 landing page. Shows connection status plus real
 * cross-section counts drawn from the product-mapping/order/inventory-diff
 * lists this phase actually built -- never a fabricated summary number.
 * Finance/affiliate/ads sections stay an honest "not built yet" notice
 * (deferred to a later build step, per the plan) rather than a half-built
 * placeholder with invented figures.
 */
function ChannelOverviewPageContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['channels', 'accounts'],
    queryFn: () => channelService.listAccounts(),
  })

  const account = data?.accounts.find((a) => a.channelType === 'TIKTOK_SHOP')

  const { data: mappingsData } = useQuery({
    queryKey: ['channels', 'products', account?.id],
    queryFn: () => channelService.listProductMappings(account?.id),
    enabled: !!account,
  })
  const { data: ordersData } = useQuery({
    queryKey: ['channels', 'orders', account?.id],
    queryFn: () => channelService.listChannelOrders(account?.id),
    enabled: !!account,
  })
  const { data: diffsData } = useQuery({
    queryKey: ['channels', 'inventory-diffs', account?.id],
    queryFn: () => channelService.listInventoryDiffs(account?.id),
    enabled: !!account,
  })
  const { data: issuesData } = useQuery({
    queryKey: ['channels', 'order-issues', account?.id],
    queryFn: () => channelService.listOrderImportIssues(account?.id),
    enabled: !!account,
  })

  if (isLoading || !data) {
    return <Skeleton className='h-64 rounded-lg' />
  }

  const capability = data.capabilities.find((c) => c.channelType === 'TIKTOK_SHOP')
  const unmappedCount = mappingsData?.mappings.filter((m) => m.mapping_status === 'CHANNEL_ONLY').length ?? null
  const flaggedDiffCount = diffsData?.diffs.filter((d) => d.action_taken === 'FLAGGED').length ?? null
  const orderIssueCount = issuesData?.issues.length ?? null
  const orderCount = ordersData?.orders.length ?? null
  const needsAttention =
    (unmappedCount ?? 0) > 0 ||
    (flaggedDiffCount ?? 0) > 0 ||
    (orderIssueCount ?? 0) > 0 ||
    (account && ['TOKEN_EXPIRED', 'NEEDS_CREDENTIALS', 'ERROR'].includes(account.status))

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>TikTok Shop</h1>
        <p className='text-muted-foreground'>TikTok Shop as one external sales channel, operated from TechTools.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Store className='h-5 w-5' /> Connection
          </CardTitle>
          <CardDescription>Real-time connection status for this deployment.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {account ? (
            <div className='flex items-center gap-3'>
              <span className='font-medium'>{account.displayName || account.externalShopId}</span>
              <Badge variant='outline'>{account.status}</Badge>
              <Badge variant='outline'>{account.marketCountry} / {account.marketCurrency}</Badge>
              <Badge variant='outline'>{account.syncMode}</Badge>
            </div>
          ) : (
            <div className='flex items-center gap-3'>
              <p className='text-sm text-muted-foreground'>No TikTok Shop connected in this environment.</p>
              {capability && <PlatformReadinessBadge readiness={capability.readiness} />}
            </div>
          )}
          <Link href='/dashboard/channels/tiktok/connection'>
            <Button variant='outline' size='sm' className='gap-1.5'>
              <Link2 className='h-3.5 w-3.5' /> Manage connection
            </Button>
          </Link>
        </CardContent>
      </Card>

      {account && (
        <>
          {needsAttention && (
            <Card className='border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <AlertTriangle className='h-4 w-4 text-amber-600' /> Needs attention
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-1 text-sm'>
                {['TOKEN_EXPIRED', 'NEEDS_CREDENTIALS', 'ERROR'].includes(account.status) && (
                  <p>Connection status is <span className='font-medium'>{account.status}</span> -- reconnect from the Connection page.</p>
                )}
                {(unmappedCount ?? 0) > 0 && (
                  <p><Link href='/dashboard/channels/tiktok/products' className='underline'>{unmappedCount} TikTok listing(s)</Link> have no matching TechTools product yet.</p>
                )}
                {(flaggedDiffCount ?? 0) > 0 && (
                  <p><Link href='/dashboard/channels/tiktok/products' className='underline'>{flaggedDiffCount} SKU(s)</Link> have a stock mismatch flagged for review.</p>
                )}
                {(orderIssueCount ?? 0) > 0 && (
                  <p><Link href='/dashboard/channels/tiktok/orders' className='underline'>{orderIssueCount} TikTok order(s)</Link> require reconciliation -- could not be imported as-is.</p>
                )}
              </CardContent>
            </Card>
          )}

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <Link href='/dashboard/channels/tiktok/products'>
              <Card className='transition-colors hover:border-primary'>
                <CardContent className='flex items-center justify-between p-6'>
                  <div>
                    <p className='text-sm text-muted-foreground'>Product mappings</p>
                    <p className='text-2xl font-bold'>{mappingsData ? mappingsData.mappings.length : '—'}</p>
                  </div>
                  <Package className='h-8 w-8 text-muted-foreground' />
                </CardContent>
              </Card>
            </Link>
            <Link href='/dashboard/channels/tiktok/orders'>
              <Card className='transition-colors hover:border-primary'>
                <CardContent className='flex items-center justify-between p-6'>
                  <div>
                    <p className='text-sm text-muted-foreground'>Orders imported</p>
                    <p className='text-2xl font-bold'>{orderCount ?? '—'}</p>
                  </div>
                  <ShoppingCart className='h-8 w-8 text-muted-foreground' />
                </CardContent>
              </Card>
            </Link>
            <Link href='/dashboard/channels/tiktok/products'>
              <Card className='transition-colors hover:border-primary'>
                <CardContent className='flex items-center justify-between p-6'>
                  <div>
                    <p className='text-sm text-muted-foreground'>Inventory mismatches</p>
                    <p className='text-2xl font-bold'>{flaggedDiffCount ?? '—'}</p>
                  </div>
                  <AlertTriangle className='h-8 w-8 text-muted-foreground' />
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}

      <Card className='border-dashed'>
        <CardHeader>
          <CardTitle className='text-base'>Finance, affiliates, and ads reporting</CardTitle>
          <CardDescription>Not built yet -- deferred until real, verified TikTok Shop Finance/Affiliate API access exists.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            This page will never show estimated fees, commissions, or ad spend. These sections appear only once genuinely
            verified figures can be synced.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ChannelOverviewPage() {
  return (
    <RequirePagePermission permission='channels.tiktok.view'>
      <ChannelOverviewPageContent />
    </RequirePagePermission>
  )
}
