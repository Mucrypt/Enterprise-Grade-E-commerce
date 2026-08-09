'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  staffService,
  type StaffMembership,
  type StaffRole,
  type StaffMembershipStatus,
} from '@/services/staff.service'
import { PermissionGate } from '@/components/auth/PermissionGate'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { UserPlus, ShieldOff, ShieldCheck, ShieldX, History } from 'lucide-react'

const ROLE_OPTIONS: StaffRole[] = [
  'OWNER',
  'SUPER_ADMIN',
  'ADMIN',
  'MARKET_MANAGER',
  'CATALOG_MANAGER',
  'ORDER_MANAGER',
  'MARKETING_MANAGER',
  'SUPPORT_AGENT',
]

const STATUS_BADGE_VARIANT: Record<StaffMembershipStatus, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  SUSPENDED: 'secondary',
  REVOKED: 'destructive',
}

function parseMarketScopeInput(value: string): string[] | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)
}

function StaffOrganizationPageInner() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StaffMembershipStatus | 'ALL'>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [grantOpen, setGrantOpen] = useState(false)

  const [grantIdentifier, setGrantIdentifier] = useState('')
  const [grantRole, setGrantRole] = useState<StaffRole>('SUPPORT_AGENT')
  const [grantScope, setGrantScope] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['staff-list', statusFilter],
    queryFn: () =>
      staffService.list(statusFilter === 'ALL' ? undefined : { status: statusFilter }),
  })

  const staff = data?.data?.staff || []
  const selected = staff.find((s) => s.id === selectedId) || null

  const invalidateStaff = () => {
    queryClient.invalidateQueries({ queryKey: ['staff-list'] })
  }

  const grantMutation = useMutation({
    mutationFn: () => {
      const isEmail = grantIdentifier.includes('@')
      return staffService.grant({
        ...(isEmail ? { email: grantIdentifier } : { userId: grantIdentifier }),
        role: grantRole,
        marketScope: parseMarketScopeInput(grantScope),
      })
    },
    onSuccess: () => {
      toast.success('Staff access granted')
      invalidateStaff()
      setGrantOpen(false)
      setGrantIdentifier('')
      setGrantScope('')
      setGrantRole('SUPPORT_AGENT')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to grant staff access')
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (id: string) => staffService.suspend(id),
    onSuccess: () => {
      toast.success('Staff access suspended')
      invalidateStaff()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to suspend staff access')
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => staffService.reactivate(id),
    onSuccess: () => {
      toast.success('Staff access reactivated')
      invalidateStaff()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to reactivate staff access')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => staffService.revoke(id),
    onSuccess: () => {
      toast.success('Staff access revoked')
      invalidateStaff()
      setSelectedId(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to revoke staff access')
    },
  })

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Staff</h1>
          <p className='text-muted-foreground'>
            People with scoped operational access, separate from their customer account.
          </p>
        </div>
        <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className='mr-2 h-4 w-4' />
              Grant Staff Access
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant Staff Access</DialogTitle>
              <DialogDescription>
                Targets an existing user by email or ID -- this never creates a new account.
                The person keeps their normal customer identity and gains staff access
                additively.
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4 py-2'>
              <div className='space-y-2'>
                <Label htmlFor='grant-identifier'>User email or ID</Label>
                <Input
                  id='grant-identifier'
                  placeholder='manager@example.com'
                  value={grantIdentifier}
                  onChange={(e) => setGrantIdentifier(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label>Role</Label>
                <Select
                  value={grantRole}
                  onValueChange={(v: string) => setGrantRole(v as StaffRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='grant-scope'>
                  Market scope (comma-separated ISO country codes, blank = global)
                </Label>
                <Input
                  id='grant-scope'
                  placeholder='CM  or  US,CA'
                  value={grantScope}
                  onChange={(e) => setGrantScope(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => grantMutation.mutate()}
                disabled={!grantIdentifier || grantMutation.isPending}
              >
                Grant Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div>
            <CardTitle>Staff members</CardTitle>
            <CardDescription>{staff.length} shown</CardDescription>
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v: string) => setStatusFilter(v as StaffMembershipStatus | 'ALL')}
          >
            <SelectTrigger className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL'>All statuses</SelectItem>
              <SelectItem value='ACTIVE'>Active</SelectItem>
              <SelectItem value='SUSPENDED'>Suspended</SelectItem>
              <SelectItem value='REVOKED'>Revoked</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-2'>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <p className='py-8 text-center text-sm text-muted-foreground'>
              No staff members match this filter yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Market scope</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow
                    key={member.id}
                    className='cursor-pointer'
                    onClick={() => setSelectedId(member.id)}
                  >
                    <TableCell>
                      <div className='font-medium'>
                        {member.firstName} {member.lastName}
                      </div>
                      <div className='text-xs text-muted-foreground'>{member.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>{member.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[member.status]}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.marketScope && member.marketScope.length > 0
                        ? member.marketScope.join(', ')
                        : 'Global'}
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(member.grantedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedId(member.id)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open: boolean) => !open && setSelectedId(null)}>
        <SheetContent className='w-full sm:max-w-lg overflow-y-auto'>
          {selected && (
            <StaffDetail
              staff={selected}
              onSuspend={() => suspendMutation.mutate(selected.id)}
              onReactivate={() => reactivateMutation.mutate(selected.id)}
              onRevoke={() => revokeMutation.mutate(selected.id)}
              busy={
                suspendMutation.isPending ||
                reactivateMutation.isPending ||
                revokeMutation.isPending
              }
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function StaffDetail({
  staff,
  onSuspend,
  onReactivate,
  onRevoke,
  busy,
}: {
  staff: StaffMembership
  onSuspend: () => void
  onReactivate: () => void
  onRevoke: () => void
  busy: boolean
}) {
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['staff-audit-log', staff.id],
    queryFn: () => staffService.getAuditLog(staff.id, 25),
  })

  const entries = auditData?.data?.entries || []

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {staff.firstName} {staff.lastName}
        </SheetTitle>
        <SheetDescription>{staff.email}</SheetDescription>
      </SheetHeader>

      <div className='space-y-6 px-4 pb-4'>
        <div className='grid grid-cols-2 gap-4 text-sm'>
          <div>
            <div className='text-muted-foreground'>Role</div>
            <div className='font-medium'>{staff.role}</div>
          </div>
          <div>
            <div className='text-muted-foreground'>Status</div>
            <Badge variant={STATUS_BADGE_VARIANT[staff.status]}>{staff.status}</Badge>
          </div>
          <div>
            <div className='text-muted-foreground'>Market scope</div>
            <div className='font-medium'>
              {staff.marketScope && staff.marketScope.length > 0
                ? staff.marketScope.join(', ')
                : 'Global'}
            </div>
          </div>
          <div>
            <div className='text-muted-foreground'>Granted</div>
            <div className='font-medium'>
              {formatDistanceToNow(new Date(staff.grantedAt), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div>
          <h4 className='mb-2 flex items-center text-sm font-semibold'>
            <History className='mr-2 h-4 w-4' />
            Recent audit activity
          </h4>
          {auditLoading ? (
            <Skeleton className='h-24 w-full' />
          ) : entries.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No audit entries yet.</p>
          ) : (
            <ul className='space-y-2 text-sm'>
              {entries.map((entry) => (
                <li key={entry.id} className='rounded-md border p-2'>
                  <div className='font-medium'>{entry.action}</div>
                  <div className='text-xs text-muted-foreground'>
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SheetFooter className='flex-row justify-start gap-2'>
        {staff.status === 'ACTIVE' && (
          <Button variant='outline' onClick={onSuspend} disabled={busy}>
            <ShieldOff className='mr-2 h-4 w-4' />
            Suspend
          </Button>
        )}
        {staff.status === 'SUSPENDED' && (
          <Button variant='outline' onClick={onReactivate} disabled={busy}>
            <ShieldCheck className='mr-2 h-4 w-4' />
            Reactivate
          </Button>
        )}
        {staff.status !== 'REVOKED' && (
          <Button variant='destructive' onClick={onRevoke} disabled={busy}>
            <ShieldX className='mr-2 h-4 w-4' />
            Revoke
          </Button>
        )}
      </SheetFooter>
    </>
  )
}

export default function StaffOrganizationPage() {
  return (
    <PermissionGate
      permission='staff.view'
      fallback={
        <div className='flex h-64 items-center justify-center text-muted-foreground'>
          You don&apos;t have access to Staff management.
        </div>
      }
    >
      <StaffOrganizationPageInner />
    </PermissionGate>
  )
}
