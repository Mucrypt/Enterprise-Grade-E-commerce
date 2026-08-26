'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import promotionService, { SocialConnection, PlatformCapabilities } from '@/services/promotion.service'
import { PlatformReadinessBadge } from '@/components/promotions/ChannelStatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const OAUTH_REDIRECT_PATH = '/dashboard/promotions/connections/callback'

function ConnectionsPageContent() {
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('social.accounts.manage')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'connections'],
    queryFn: () => promotionService.listConnections(),
  })

  const startOAuthMutation = useMutation({
    mutationFn: (platform: PlatformCapabilities['platform']) => {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`
      sessionStorage.setItem('promotion_oauth_platform', platform)
      return promotionService.startOAuth(platform, redirectUri)
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
    mutationFn: (id: string) => promotionService.disconnectConnection(id),
    onSuccess: () => {
      toast.success('Disconnected.')
      queryClient.invalidateQueries({ queryKey: ['promotions', 'connections'] })
    },
    onError: () => toast.error('Failed to disconnect.'),
  })

  if (isLoading || !data) {
    return <Skeleton className='h-96 rounded-lg' />
  }

  const connectionsByPlatform = new Map<string, SocialConnection[]>()
  for (const c of data.connections) {
    const existing = connectionsByPlatform.get(c.platform) || []
    existing.push(c)
    connectionsByPlatform.set(c.platform, existing)
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Connections</h1>
        <p className='text-muted-foreground'>
          Connect the company&apos;s social accounts. {!canManage && 'You can view connection status but connecting/disconnecting accounts requires OWNER or SUPER_ADMIN.'}
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {data.capabilities.map((capability) => {
          const connections = connectionsByPlatform.get(capability.platform) || []
          return (
            <Card key={capability.platform}>
              <CardHeader>
                <CardTitle className='flex items-center justify-between text-base'>
                  <span className='capitalize'>{capability.platform.charAt(0) + capability.platform.slice(1).toLowerCase()}</span>
                  <PlatformReadinessBadge readiness={capability.readiness} />
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {connections.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>Not connected.</p>
                ) : (
                  <ul className='space-y-2'>
                    {connections.map((c) => (
                      <li key={c.id} className='rounded-md border p-2 text-sm'>
                        <div className='flex items-center justify-between'>
                          <span className='font-medium'>{c.displayName || c.externalAccountId || 'Connected account'}</span>
                          <span className='text-xs text-muted-foreground'>{c.status}</span>
                        </div>
                        {c.lastError && <p className='mt-1 text-xs text-destructive'>{c.lastError}</p>}
                        {c.tokenExpiresAt && (
                          <p className='mt-1 text-xs text-muted-foreground'>Token expires {new Date(c.tokenExpiresAt).toLocaleDateString()}</p>
                        )}
                        {canManage && (
                          <Button
                            variant='ghost'
                            size='sm'
                            className='mt-1 h-7 px-2 text-xs text-destructive'
                            onClick={() => disconnectMutation.mutate(c.id)}
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
                    onClick={() => startOAuthMutation.mutate(capability.platform)}
                    title={capability.readiness !== 'AVAILABLE' ? `${capability.platform} is ${capability.readiness.toLowerCase().replace('_', ' ')} in this environment` : undefined}
                  >
                    {capability.readiness === 'AVAILABLE' ? 'Connect account' : capability.readiness.replace(/_/g, ' ')}
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

export default function ConnectionsPage() {
  return (
    <RequirePagePermission permission='social.accounts.view'>
      <ConnectionsPageContent />
    </RequirePagePermission>
  )
}
