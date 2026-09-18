'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { sellerService, type SellerVerificationQueueItem } from '@/services/seller.service'
import { customerService, type Customer } from '@/services/customer.service'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  ChevronRight,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Store,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react'

const parseQueue = (response: unknown): SellerVerificationQueueItem[] => {
  const data = (response as { data?: { data?: unknown } })?.data?.data
  const payload = data as { items?: SellerVerificationQueueItem[] } | undefined

  return payload?.items || []
}

function GrantSellerAccessDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<Customer | null>(null)
  const [tier, setTier] = useState('unverified')

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['grant-seller-user-search', search],
    queryFn: () => customerService.getCustomers({ search, limit: 8, userType: 'all' }),
    enabled: search.trim().length >= 2 && !selectedUser,
  })
  const users = searchResults?.data?.customers || []

  const grantMutation = useMutation({
    mutationFn: () => sellerService.grantSellerAccess({ userId: selectedUser!.id, tier }),
    onSuccess: () => {
      toast.success(`${selectedUser?.fullName || selectedUser?.email} is now an approved seller`)
      queryClient.invalidateQueries({ queryKey: ['admin-all-sellers'] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to grant seller access')
    },
  })

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Grant seller access</DialogTitle>
          <DialogDescription>
            Makes this user an approved seller immediately, at the tier you choose -- no
            verification request needed.
          </DialogDescription>
        </DialogHeader>

        {!selectedUser ? (
          <div className='space-y-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search by name or email...'
                className='pl-9'
              />
            </div>
            {isFetching && <p className='text-sm text-muted-foreground'>Searching...</p>}
            {users.length > 0 && (
              <div className='max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1'>
                {users.map((customer) => (
                  <button
                    key={customer.id}
                    type='button'
                    onClick={() => setSelectedUser(customer)}
                    className='flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-muted'
                  >
                    <span className='font-medium'>{customer.fullName || customer.email}</span>
                    <span className='text-xs text-muted-foreground'>{customer.email}</span>
                  </button>
                ))}
              </div>
            )}
            {search.trim().length >= 2 && !isFetching && users.length === 0 && (
              <p className='text-sm text-muted-foreground'>No matching users found.</p>
            )}
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2'>
              <div>
                <p className='text-sm font-medium'>{selectedUser.fullName || selectedUser.email}</p>
                <p className='text-xs text-muted-foreground'>{selectedUser.email}</p>
              </div>
              <Button variant='ghost' size='sm' onClick={() => setSelectedUser(null)}>
                Change
              </Button>
            </div>

            <div className='space-y-2'>
              <Label>Starting tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='unverified'>Unverified</SelectItem>
                  <SelectItem value='basic'>Basic</SelectItem>
                  <SelectItem value='trusted'>Trusted</SelectItem>
                  <SelectItem value='pro'>Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selectedUser || grantMutation.isPending}
            onClick={() => grantMutation.mutate()}
          >
            {grantMutation.isPending ? 'Granting...' : 'Grant seller access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AllSellersSection({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [grantDialogOpen, setGrantDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-all-sellers', search, tierFilter, statusFilter],
    queryFn: () =>
      sellerService.getAllSellers({
        search: search || undefined,
        tier: tierFilter === 'all' ? undefined : tierFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50,
      }),
  })
  const sellers = data?.data?.items || []

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Store className='h-5 w-5 text-primary' />
              All Sellers
            </CardTitle>
            <CardDescription>Search, filter, and directly manage every seller profile.</CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setGrantDialogOpen(true)}>
              <UserPlus className='mr-2 h-4 w-4' /> Grant seller access
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative w-64'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search name, handle, or email...'
              className='pl-9'
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Tier' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All tiers</SelectItem>
              <SelectItem value='unverified'>Unverified</SelectItem>
              <SelectItem value='basic'>Basic</SelectItem>
              <SelectItem value='trusted'>Trusted</SelectItem>
              <SelectItem value='pro'>Pro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-45'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All statuses</SelectItem>
              <SelectItem value='approved'>Approved</SelectItem>
              <SelectItem value='pending'>Pending</SelectItem>
              <SelectItem value='rejected'>Rejected</SelectItem>
              <SelectItem value='suspended'>Suspended</SelectItem>
              <SelectItem value='none'>None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Seller</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Listings limit</TableHead>
              <TableHead className='text-right'>&nbsp;</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>Loading sellers...</TableCell>
              </TableRow>
            ) : sellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No sellers match these filters.</TableCell>
              </TableRow>
            ) : (
              sellers.map((seller) => (
                <TableRow key={seller.id}>
                  <TableCell>
                    <div>
                      <p className='font-medium'>
                        {seller.display_name || `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email}
                      </p>
                      <p className='text-xs text-muted-foreground'>{seller.handle ? `@${seller.handle}` : seller.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>{seller.tier}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        seller.is_suspended
                          ? 'destructive'
                          : seller.verification_status === 'approved'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {seller.is_suspended ? 'suspended' : seller.verification_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{seller.max_active_listings}</TableCell>
                  <TableCell className='text-right'>
                    <Button asChild size='sm' variant='ghost'>
                      <Link href={`/sellers/${seller.id}`}>
                        View <ChevronRight className='ml-1 h-4 w-4' />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {grantDialogOpen && <GrantSellerAccessDialog onClose={() => setGrantDialogOpen(false)} />}
    </Card>
  )
}

function VerificationQueueSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'suspended' | 'none'>('pending')
  const [moderationNotes, setModerationNotes] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [accessReason, setAccessReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-seller-verification-queue', statusFilter],
    queryFn: async () =>
      sellerService.getVerificationQueue({ status: statusFilter, limit: 100 }),
  })

  const queue = useMemo(() => parseQueue(data), [data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-seller-verification-queue'] })
    queryClient.invalidateQueries({ queryKey: ['admin-all-sellers'] })
  }

  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      sellerService.approveVerificationRequest(requestId, {
        adminNotes: moderationNotes || undefined,
        phoneVerified: true,
        paymentMethodVerified: true,
      }),
    onSuccess: () => {
      toast.success('Seller verification approved')
      invalidate()
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
      invalidate()
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
      invalidate()
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
      invalidate()
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
                        disabled={!canManage || item.status !== 'pending' || approveMutation.isPending}
                      >
                        <CheckCircle2 className='mr-1 h-4 w-4' /> Approve
                      </Button>
                      <Button
                        size='sm'
                        variant='secondary'
                        onClick={() => rejectMutation.mutate(item.id)}
                        disabled={!canManage || item.status !== 'pending' || rejectMutation.isPending}
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
                          !canManage ||
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
                          !canManage ||
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
                          !canManage ||
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
  )
}

function SellersPageContent() {
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('sellers.manage')

  return (
    <div className='space-y-6'>
      <AllSellersSection canManage={canManage} />
      <VerificationQueueSection canManage={canManage} />
    </div>
  )
}

export default function SellersPage() {
  return (
    <RequirePagePermission permission='sellers.view'>
      <SellersPageContent />
    </RequirePagePermission>
  )
}
