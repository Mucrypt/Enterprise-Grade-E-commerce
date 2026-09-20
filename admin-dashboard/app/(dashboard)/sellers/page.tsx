'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  sellerService,
  type SellerProfileStatusFilter,
  type SellerVerificationQueueItem,
  type SellerVerificationQueueStatusFilter,
} from '@/services/seller.service'
import { customerService, type Customer } from '@/services/customer.service'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import {
  getCaseStatusPresentation,
  getProfileVerificationPresentation,
  isVerificationCaseReviewable,
  isVerificationCaseTerminal,
} from '@/lib/seller-lifecycle'
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

// `sellerService.getVerificationQueue()` resolves to the API's
// `{ success, data: { items, pagination } }` body directly -- apiClient's
// `get<T>()` already unwraps axios's own response.data, so this is ONE
// `.data` away from `items`, not two. The previous `.data?.data` here
// silently resolved to undefined on every call, meaning this table
// showed "No seller verification requests found" regardless of what was
// actually pending -- a second, independent bug from the enum-casing one
// (confirmed by re-deriving this from the real return type below rather
// than an `unknown` cast, which is what hid it).
const parseQueue = (
  response: Awaited<ReturnType<typeof sellerService.getVerificationQueue>> | undefined,
): SellerVerificationQueueItem[] => response?.data?.items || []

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
  // 'all' | a real SellerProfileStatusFilter value -- 'suspended' is
  // deliberately NOT one of these anymore. Suspension moved to
  // seller_account_status in the lifecycle migration; it was never a
  // real seller_profile_verification_status value the backend's `status`
  // filter understood, so picking "Suspended" here used to silently
  // apply no filter at all (matching every seller). It's now its own
  // dedicated toggle below, wired to the `suspended` boolean param the
  // backend actually supports.
  const [statusFilter, setStatusFilter] = useState<'all' | SellerProfileStatusFilter>('all')
  const [suspendedFilter, setSuspendedFilter] = useState<'all' | 'suspended' | 'active'>('all')
  const [grantDialogOpen, setGrantDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-all-sellers', search, tierFilter, statusFilter, suspendedFilter],
    queryFn: () =>
      sellerService.getAllSellers({
        search: search || undefined,
        tier: tierFilter === 'all' ? undefined : tierFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        suspended:
          suspendedFilter === 'all' ? undefined : suspendedFilter === 'suspended',
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
          <Select
            value={statusFilter}
            onValueChange={(value: string) =>
              setStatusFilter(value as 'all' | SellerProfileStatusFilter)
            }
          >
            <SelectTrigger className='w-52'>
              <SelectValue placeholder='Verification status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All verification statuses</SelectItem>
              <SelectItem value='approved'>Verified</SelectItem>
              <SelectItem value='pending'>Pending review</SelectItem>
              <SelectItem value='more_information_required'>More info requested</SelectItem>
              <SelectItem value='rejected'>Rejected</SelectItem>
              <SelectItem value='expired'>Expired</SelectItem>
              <SelectItem value='none'>Not started</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={suspendedFilter}
            onValueChange={(value: string) =>
              setSuspendedFilter(value as 'all' | 'suspended' | 'active')
            }
          >
            <SelectTrigger className='w-36'>
              <SelectValue placeholder='Suspension' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Any standing</SelectItem>
              <SelectItem value='active'>Not suspended</SelectItem>
              <SelectItem value='suspended'>Suspended</SelectItem>
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
                    {seller.is_suspended ? (
                      <Badge variant='destructive'>Suspended</Badge>
                    ) : (
                      (() => {
                        const presentation = getProfileVerificationPresentation(
                          seller.verification_status,
                        )
                        return <Badge variant={presentation.variant}>{presentation.label}</Badge>
                      })()
                    )}
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

// The backend's fail-closed document rule (seller-lifecycle.service.ts's
// approveVerification) rejects an approval that requires ID verification
// but has no document that is BOTH admin-accepted AND malware-scanned
// clean -- correct behavior in a phase with no real scanner wired in yet,
// not a bug. Its IllegalTransitionError message names this explicitly;
// detect it here to show a specific, honest explanation instead of a
// generic "failed" toast that would read as a transient error an admin
// might just retry.
const MALWARE_GATE_MESSAGE_FRAGMENT = 'malware-scanned-clean'

function describeApprovalError(rawMessage: string | undefined): string {
  if (rawMessage && rawMessage.includes(MALWARE_GATE_MESSAGE_FRAGMENT)) {
    return (
      'Cannot approve: this tier requires an identity document that has been ' +
      'both accepted by an admin and confirmed clean by malware scanning. No ' +
      'automated scanner is connected yet, so document-based approval for this ' +
      'tier is intentionally unavailable until one is. This is not an error to ' +
      'retry -- it will keep failing until a scanner is integrated.'
    )
  }
  return rawMessage || 'Failed to approve verification'
}

export function VerificationQueueSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<SellerVerificationQueueStatusFilter>('pending')
  const [moderationNotes, setModerationNotes] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [accessReason, setAccessReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-seller-verification-queue', statusFilter],
    queryFn: async () =>
      sellerService.getVerificationQueue({ status: statusFilter, limit: 100 }),
  })

  // Independent of the currently-selected filter above -- a real
  // breakdown across every case status, not just a client-side count of
  // whatever page happens to be loaded (which is undefined/misleading
  // the moment the filter isn't 'pending').
  const { data: counts } = useQuery({
    queryKey: ['admin-seller-verification-queue-counts'],
    queryFn: () => sellerService.getVerificationQueueCounts(),
  })

  const queue = useMemo(() => parseQueue(data), [data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-seller-verification-queue'] })
    queryClient.invalidateQueries({ queryKey: ['admin-seller-verification-queue-counts'] })
    queryClient.invalidateQueries({ queryKey: ['admin-all-sellers'] })
  }

  // No optimistic update anywhere in this mutation: onSuccess only
  // re-fetches from the server (`invalidate()`), and onError only shows
  // the real backend message -- the case's displayed status never
  // changes locally unless the server actually confirms it did.
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
      toast.error(describeApprovalError(error?.response?.data?.error), { duration: 10000 })
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

  // Real counts across every case status, fetched independently of
  // whichever filter is currently selected below (see
  // getVerificationQueueCounts) -- not a client-side count of the
  // currently-loaded page, which would silently read 0 for every status
  // except whichever one the dropdown happens to be set to.
  const pendingCount = counts?.pending ?? 0
  const moreInfoCount = counts?.more_information_required ?? 0
  const approvedCount = counts?.approved ?? 0
  const rejectedCount = counts?.rejected ?? 0
  const expiredCount = counts?.expired ?? 0
  const supersededCount = counts?.superseded ?? 0
  const activeCount = pendingCount + moreInfoCount

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
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='secondary'>Active review cases: {activeCount}</Badge>
          <Badge variant='secondary'>Pending review: {pendingCount}</Badge>
          <Badge variant='secondary'>More info requested: {moreInfoCount}</Badge>
          <Badge variant='outline'>Approved (historical): {approvedCount}</Badge>
          <Badge variant='outline'>Rejected (historical): {rejectedCount}</Badge>
          <Badge variant='outline'>Expired (historical): {expiredCount}</Badge>
          <Badge variant='outline'>Superseded (historical): {supersededCount}</Badge>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <Select
            value={statusFilter}
            onValueChange={(value: string) =>
              setStatusFilter(value as SellerVerificationQueueStatusFilter)
            }
          >
            <SelectTrigger className='w-64'>
              <SelectValue placeholder='Filter by status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='pending'>Pending review (active)</SelectItem>
              <SelectItem value='more_information_required'>
                More info requested (active)
              </SelectItem>
              <SelectItem value='approved'>Approved (historical)</SelectItem>
              <SelectItem value='rejected'>Rejected (historical)</SelectItem>
              <SelectItem value='expired'>Expired (historical)</SelectItem>
              <SelectItem value='superseded'>Superseded (historical)</SelectItem>
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
              <TableHead>Tier (requested / current)</TableHead>
              <TableHead>Case status</TableHead>
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
              queue.map((item) => {
                // This request's OWN case lifecycle -- separate from
                // item.verification_status (the seller PROFILE's overall
                // standing) used below for the Grant/Revoke access
                // buttons. Conflating them would describe a tier-upgrade
                // request as identity approval, or vice versa.
                const reviewable = isVerificationCaseReviewable(item.status)
                const terminal = isVerificationCaseTerminal(item.status)
                const casePresentation = getCaseStatusPresentation(item.status)

                return (
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
                      <div className='flex items-center gap-2'>
                        <Badge variant='outline'>{item.requested_tier}</Badge>
                        <span className='text-xs text-muted-foreground'>
                          current: {item.tier || 'unverified'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='space-y-1'>
                        <Badge variant={casePresentation.variant}>{casePresentation.label}</Badge>
                        {terminal && (
                          <p className='text-[11px] text-muted-foreground'>
                            Historical -- not actionable
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.created_at
                        ? formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })
                        : 'Unknown'}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='inline-flex flex-wrap justify-end gap-2'>
                        <Button
                          size='sm'
                          onClick={() => approveMutation.mutate(item.id)}
                          disabled={!canManage || !reviewable || approveMutation.isPending}
                        >
                          <CheckCircle2 className='mr-1 h-4 w-4' /> Approve
                        </Button>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => rejectMutation.mutate(item.id)}
                          disabled={!canManage || !reviewable || rejectMutation.isPending}
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
                            item.verification_status === 'APPROVED' ||
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
                            item.verification_status !== 'APPROVED' ||
                            setAccessMutation.isPending
                          }
                        >
                          <ShieldX className='mr-1 h-4 w-4' /> Revoke access
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
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
