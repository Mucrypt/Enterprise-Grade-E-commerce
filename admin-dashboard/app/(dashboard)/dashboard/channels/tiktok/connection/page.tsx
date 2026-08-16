'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import channelService, { CommerceChannelAccount, ChannelType } from '@/services/channel.service'
import { PlatformReadinessBadge } from '@/components/promotions/ChannelStatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const OAUTH_REDIRECT_PATH = '/dashboard/channels/tiktok/connection/callback'

function ChannelConnectionPageContent() {
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('channels.tiktok.connections')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['channels', 'accounts'],
    queryFn: () => channelService.listAccounts(),
  })

  const startOAuthMutation = useMutation({
    mutationFn: (channelType: ChannelType) => {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`
      return channelService.startOAuth(channelType, redirectUri)
    },
    onSuccess: (result) => {
      if (result.success) {
        window.location.href = result.authorizeUrl
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to start connection flow.'),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => channelService.disconnectAccount(id),
    onSuccess: () => {
      toast.success('Disconnected.')
      queryClient.invalidateQueries({ queryKey: ['channels', 'accounts'] })
    },
  })

  if (isLoading || !data) {
    return <Skeleton className='h-96 rounded-lg' />
  }

  const accountsByType = new Map<string, CommerceChannelAccount[]>()
  for (const a of data.accounts) {
    const existing = accountsByType.get(a.channelType) || []
    existing.push(a)
    accountsByType.set(a.channelType, existing)
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>TikTok Shop Connection</h1>
        <p className='text-muted-foreground'>
          Connect the company&apos;s TikTok Shop. {!canManage && 'You can view connection status but connecting/disconnecting requires OWNER or SUPER_ADMIN.'}
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {data.capabilities.map((capability) => {
          const accounts = accountsByType.get(capability.channelType) || []
          return (
            <Card key={capability.channelType}>
              <CardHeader>
                <CardTitle className='flex items-center justify-between text-base'>
                  <span>TikTok Shop</span>
                  <PlatformReadinessBadge readiness={capability.readiness} />
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {accounts.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>Not connected.</p>
                ) : (
                  <ul className='space-y-2'>
                    {accounts.map((a) => (
                      <li key={a.id} className='rounded-md border p-2 text-sm'>
                        <div className='flex items-center justify-between'>
                          <span className='font-medium'>{a.displayName || a.externalShopId || 'Connected shop'}</span>
                          <span className='text-xs text-muted-foreground'>{a.status}</span>
                        </div>
                        <div className='mt-1 flex items-center gap-2'>
                          <Badge variant='outline' className='text-xs'>{a.marketCountry}</Badge>
                          <Badge variant='outline' className='text-xs'>{a.marketCurrency}</Badge>
                          <Badge variant='outline' className='text-xs'>{a.syncMode}</Badge>
                        </div>
                        {a.lastError && <p className='mt-1 text-xs text-destructive'>{a.lastError}</p>}
                        {a.accessTokenExpiresAt && (
                          <p className='mt-1 text-xs text-muted-foreground'>Token expires {new Date(a.accessTokenExpiresAt).toLocaleDateString()}</p>
                        )}
                        {canManage && (
                          <Button
                            variant='ghost'
                            size='sm'
                            className='mt-1 h-7 px-2 text-xs text-destructive'
                            onClick={() => disconnectMutation.mutate(a.id)}
                          >
                            Disconnect
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <p className='text-xs text-muted-foreground'>{capability.notes}</p>

                {canManage && (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={capability.readiness !== 'AVAILABLE' || startOAuthMutation.isPending}
                    onClick={() => startOAuthMutation.mutate(capability.channelType)}
                    title={capability.readiness !== 'AVAILABLE' ? `TikTok Shop is ${capability.readiness.toLowerCase().replace('_', ' ')} in this environment` : undefined}
                  >
                    {capability.readiness === 'AVAILABLE' ? 'Connect shop' : capability.readiness.replace(/_/g, ' ')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default function ChannelConnectionPage() {
  return (
    <RequirePagePermission permission='channels.tiktok.connections'>
      <ChannelConnectionPageContent />
    </RequirePagePermission>
  )
}
