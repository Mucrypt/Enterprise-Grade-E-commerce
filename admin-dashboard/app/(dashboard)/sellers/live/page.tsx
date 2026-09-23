'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Radio, ShieldAlert } from 'lucide-react'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import { liveService, type LiveSession } from '@/services/live.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function ForceEndDialog({ session, onClose }: { session: LiveSession; onClose: () => void }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => liveService.forceEnd(session.id),
    onSuccess: () => {
      toast.success(`Stream "${session.title}" ended`)
      queryClient.invalidateQueries({ queryKey: ['admin-live-sessions'] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to end this stream')
    },
  })

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ShieldAlert className='h-5 w-5 text-destructive' /> Force end this stream?
          </DialogTitle>
          <DialogDescription>
            This immediately stops the AWS IVS stream for &quot;{session.title}&quot;
            ({session.sellerDisplayName || 'unknown seller'}) and disconnects every viewer. Use
            this for a policy violation or abuse report -- it cannot be undone from here.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Ending...' : 'Force end stream'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LiveSessionsMonitor() {
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('sellers.manage')
  const [endingSession, setEndingSession] = useState<LiveSession | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-live-sessions'],
    queryFn: () => liveService.getLiveNow(),
    // Live sessions can start/end at any moment -- a short poll keeps
    // this monitor honest without needing a dedicated admin socket room.
    refetchInterval: 15_000,
  })

  const sessions = data?.data?.sessions || []

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Live Sessions</h1>
        <p className='text-muted-foreground'>
          Every currently-live stream, with an emergency force-end control.
        </p>
      </div>

      {endingSession && (
        <ForceEndDialog session={endingSession} onClose={() => setEndingSession(null)} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Radio className='h-5 w-5 text-red-600' /> Live now
            {sessions.length > 0 && <Badge variant='destructive'>{sessions.length}</Badge>}
          </CardTitle>
          <CardDescription>Refreshes automatically every 15 seconds.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-2'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
            </div>
          ) : sessions.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No one is live right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className='text-right'>Peak viewers</TableHead>
                  <TableHead className='text-right'>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className='font-medium'>{session.sellerDisplayName || 'Unknown'}</div>
                      {session.sellerHandle && (
                        <div className='text-xs text-muted-foreground'>@{session.sellerHandle}</div>
                      )}
                    </TableCell>
                    <TableCell>{session.title}</TableCell>
                    <TableCell>
                      {session.startedAt ? format(parseISO(session.startedAt), 'MMM d, h:mm a') : '—'}
                    </TableCell>
                    <TableCell className='text-right'>{session.viewerCountPeak}</TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='destructive'
                        size='sm'
                        disabled={!canManage}
                        onClick={() => setEndingSession(session)}
                      >
                        Force end
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LiveSessionsPage() {
  return (
    <RequirePagePermission permission='sellers.manage'>
      <LiveSessionsMonitor />
    </RequirePagePermission>
  )
}
