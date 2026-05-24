'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { sellerService, type SellerVerificationQueueItem } from '@/services/seller.service'
import { useAuthStore } from '@/lib/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UserCheck,
  XCircle,
} from 'lucide-react'

const parseQueue = (response: unknown): SellerVerificationQueueItem[] => {
  const data = (response as { data?: { data?: unknown } })?.data?.data
  const payload = data as { items?: SellerVerificationQueueItem[] } | undefined

  return payload?.items || []
}

export default function SellersPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'suspended' | 'none'>('pending')
  const [moderationNotes, setModerationNotes] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [accessReason, setAccessReason] = useState('')

  const userType =
    (user as any)?.user_type || (user as any)?.userType || 'admin'
  const canSuspend = userType === 'super_admin' || userType === 'admin'

  const { data, isLoading } = useQuery({
    queryKey: ['admin-seller-verification-queue', statusFilter],
    queryFn: async () =>
      sellerService.getVerificationQueue({ status: statusFilter, limit: 100 }),
  })

  const queue = useMemo(() => parseQueue(data), [data])

  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      sellerService.approveVerificationRequest(requestId, {
        adminNotes: moderationNotes || undefined,
        phoneVerified: true,
        paymentMethodVerified: true,
      }),
    onSuccess: () => {
      toast.success('Seller verification approved')
      queryClient.invalidateQueries({ queryKey: ['admin-seller-verification-queue'] })
      setModerationNotes('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to approve verification')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) =>
      sellerService.rejectVerificationRequest(requestId, {
        adminNotes: moderationNotes || undefined,
        decisionReason: moderationNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Seller verification rejected')
      queryClient.invalidateQueries({ queryKey: ['admin-seller-verification-queue'] })
      setModerationNotes('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to reject verification')
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (sellerProfileId: string) =>
      sellerService.suspendSellerProfile(sellerProfileId, {
        suspensionReason: suspendReason || 'Suspended by moderation policy',
      }),
    onSuccess: () => {
      toast.success('Seller profile suspended')
      queryClient.invalidateQueries({ queryKey: ['admin-seller-verification-queue'] })
      setSuspendReason('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to suspend seller')
    },
  })

  const setAccessMutation = useMutation({
    mutationFn: ({
      sellerProfileId,
      accessEnabled,
    }: {
      sellerProfileId: string
      accessEnabled: boolean
    }) =>
      sellerService.setCreatorAccess(sellerProfileId, {
        accessEnabled,
        reason: accessReason || moderationNotes || undefined,
      }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.accessEnabled
          ? 'Creator access granted'
          : 'Creator access revoked',
      )
      queryClient.invalidateQueries({ queryKey: ['admin-seller-verification-queue'] })
      setAccessReason('')
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ||
          'Failed to update creator dashboard access',
      )
    },
  })

  const pendingCount = queue.filter((item) => item.status === 'pending').length

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <UserCheck className='h-5 w-5 text-primary' />
            Seller Verification Queue
          </CardTitle>
          <CardDescription>
            Low-friction onboarding with controlled trust upgrades and moderation auditability.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <Badge variant='secondary'>Pending: {pendingCount}</Badge>
            <Select
              value={statusFilter}
              onValueChange={(value: string) =>
                setStatusFilter(
                  value as 'pending' | 'approved' | 'rejected' | 'suspended' | 'none',
                )
              }
            >
              <SelectTrigger className='w-55'>
                <SelectValue placeholder='Filter by status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='pending'>Pending</SelectItem>
                <SelectItem value='approved'>Approved</SelectItem>
                <SelectItem value='rejected'>Rejected</SelectItem>
                <SelectItem value='suspended'>Suspended</SelectItem>
                <SelectItem value='none'>None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            <div className='space-y-2'>
              <Label htmlFor='seller-moderation-notes'>Moderation notes</Label>
              <Textarea
                id='seller-moderation-notes'
                value={moderationNotes}
                onChange={(event) => setModerationNotes(event.target.value)}
                placeholder='Optional review notes for approval or rejection.'
                rows={3}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='seller-suspend-reason'>Suspend reason</Label>
              <Input
                id='seller-suspend-reason'
                value={suspendReason}
                onChange={(event) => setSuspendReason(event.target.value)}
                placeholder='Use only when immediate risk is detected.'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='seller-access-reason'>Access override reason</Label>
              <Input
                id='seller-access-reason'
                value={accessReason}
                onChange={(event) => setAccessReason(event.target.value)}
                placeholder='Reason for granting/revoking creator access.'
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Requested Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading queue...</TableCell>
                </TableRow>
              ) : queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No seller verification requests found.</TableCell>
                </TableRow>
              ) : (
                queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className='space-y-1'>
                        <p className='font-medium'>
                          {item.display_name ||
                            `${item.first_name || ''} ${item.last_name || ''}`.trim() ||
                            item.email ||
                            'Unknown Seller'}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {item.handle ? `@${item.handle}` : item.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>{item.requested_tier}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === 'approved'
                            ? 'default'
                            : item.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.created_at
                        ? formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })
                        : 'Unknown'}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='inline-flex gap-2'>
                        <Button
                          size='sm'
                          onClick={() => approveMutation.mutate(item.id)}
                          disabled={item.status !== 'pending' || approveMutation.isPending}
                        >
                          <CheckCircle2 className='mr-1 h-4 w-4' /> Approve
                        </Button>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => rejectMutation.mutate(item.id)}
                          disabled={item.status !== 'pending' || rejectMutation.isPending}
                        >
                          <XCircle className='mr-1 h-4 w-4' /> Reject
                        </Button>
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={() =>
                            item.seller_profile_id
                              ? suspendMutation.mutate(item.seller_profile_id)
                              : null
                          }
                          disabled={
                            !canSuspend ||
                            !item.seller_profile_id ||
                            suspendMutation.isPending
                          }
                        >
                          <ShieldAlert className='mr-1 h-4 w-4' /> Suspend
                        </Button>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() =>
                            item.seller_profile_id
                              ? setAccessMutation.mutate({
                                  sellerProfileId: item.seller_profile_id,
                                  accessEnabled: true,
                                })
                              : null
                          }
                          disabled={
                            !item.seller_profile_id ||
                            item.verification_status === 'approved' ||
                            setAccessMutation.isPending
                          }
                        >
                          <ShieldCheck className='mr-1 h-4 w-4' /> Grant access
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() =>
                            item.seller_profile_id
                              ? setAccessMutation.mutate({
                                  sellerProfileId: item.seller_profile_id,
                                  accessEnabled: false,
                                })
                              : null
                          }
                          disabled={
                            !item.seller_profile_id ||
                            item.verification_status !== 'approved' ||
                            setAccessMutation.isPending
                          }
                        >
                          <ShieldX className='mr-1 h-4 w-4' /> Revoke access
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
