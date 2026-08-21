'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import sourcingService from '@/services/sourcing.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Copy, Download, Plus, Trash2 } from 'lucide-react'

/**
 * SOURCING-1 -- personal-access tokens for the browser extension. A raw
 * token is shown exactly once, right after generation, and never again --
 * matches this codebase's existing "shown once" precedent for secrets.
 */
function SourcingTokensPageContent() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [tokenName, setTokenName] = useState('')
  const [issuedToken, setIssuedToken] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await sourcingService.downloadExtensionZip()
    } catch {
      toast.error('Failed to download the extension. Try again in a moment.')
    } finally {
      setDownloading(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['sourcing', 'tokens'],
    queryFn: () => sourcingService.listTokens(),
  })

  const issueMutation = useMutation({
    mutationFn: () => sourcingService.issueToken(tokenName || 'Browser extension'),
    onSuccess: (result) => {
      if (result.success) {
        setIssuedToken(result.data.token)
        queryClient.invalidateQueries({ queryKey: ['sourcing', 'tokens'] })
      } else {
        toast.error('Failed to issue token.')
      }
    },
    onError: () => toast.error('Failed to issue token.'),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => sourcingService.revokeToken(id),
    onSuccess: () => {
      toast.success('Token revoked.')
      queryClient.invalidateQueries({ queryKey: ['sourcing', 'tokens'] })
    },
    onError: () => toast.error('Failed to revoke token.'),
  })

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Extension Tokens</h1>
          <p className='text-muted-foreground'>Credentials the sourcing browser extension uses to import products -- never a login password.</p>
        </div>
        <Button
          className='gap-1.5'
          onClick={() => {
            setTokenName('')
            setIssuedToken(null)
            setCreateOpen(true)
          }}
        >
          <Plus className='h-4 w-4' /> Generate token
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Extension package</CardTitle>
          <CardDescription>
            Always the current build, straight from TechTools -- log in from any computer or browser and download it again any time
            without hunting for files. Unzip it, then load it as an unpacked extension in Chrome/Edge/Brave
            (chrome://extensions -&gt; Developer mode -&gt; Load unpacked).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant='outline' className='gap-1.5' onClick={handleDownload} disabled={downloading}>
            <Download className='h-4 w-4' /> {downloading ? 'Preparing download...' : 'Download Extension (.zip)'}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? null : (
        <Card>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.tokens || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className='py-8 text-center text-sm text-muted-foreground'>
                      No tokens yet -- generate one to install the extension.
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.tokens.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell className='font-mono text-xs'>{t.token_prefix}...</TableCell>
                      <TableCell>
                        {t.revoked_at ? (
                          <Badge variant='destructive'>Revoked</Badge>
                        ) : t.expires_at && new Date(t.expires_at) < new Date() ? (
                          <Badge variant='outline'>Expired</Badge>
                        ) : (
                          <Badge variant='default'>Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : 'Never'}</TableCell>
                      <TableCell className='text-sm text-muted-foreground'>{new Date(t.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {!t.revoked_at && (
                          <Button variant='ghost' size='sm' className='gap-1.5 text-destructive' onClick={() => revokeMutation.mutate(t.id)}>
                            <Trash2 className='h-3.5 w-3.5' /> Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{issuedToken ? 'Copy your token now' : 'Generate an extension token'}</DialogTitle>
          </DialogHeader>

          {issuedToken ? (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                This is shown only once. Paste it into the extension's options page now -- you won't be able to see it again.
              </p>
              <div className='flex items-center gap-2'>
                <Input readOnly value={issuedToken} className='font-mono text-xs' />
                <Button
                  size='icon'
                  variant='outline'
                  onClick={() => {
                    navigator.clipboard.writeText(issuedToken)
                    toast.success('Copied.')
                  }}
                >
                  <Copy className='h-4 w-4' />
                </Button>
              </div>
            </div>
          ) : (
            <Input placeholder='e.g. "Laptop Chrome extension"' value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
          )}

          <DialogFooter>
            {issuedToken ? (
              <Button onClick={() => setCreateOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant='outline' onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending}>
                  {issueMutation.isPending ? 'Generating...' : 'Generate'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SourcingTokensPage() {
  return (
    <RequirePagePermission permission='sourcing.manage'>
      <SourcingTokensPageContent />
    </RequirePagePermission>
  )
}
