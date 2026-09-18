'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  supportTicketService,
  type SupportReportingSummary,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketStatus,
} from '@/services/support-ticket.service'
import { announcementService, type SellerTier } from '@/services/announcement.service'
import { staffService } from '@/services/staff.service'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BarChart3, LifeBuoy, Megaphone, Search, Send, UserCog } from 'lucide-react'

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_VARIANT: Record<SupportTicketStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'destructive',
  in_progress: 'default',
  resolved: 'secondary',
  closed: 'outline',
}

function TicketDrawer({ ticket, onClose }: { ticket: SupportTicket; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('support.manage')
  const [replyBody, setReplyBody] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-support-ticket', ticket.id],
    queryFn: () => supportTicketService.getById(ticket.id),
  })
  const messages = data?.data?.messages || []
  const liveTicket = data?.data?.ticket || ticket

  const { data: staffData } = useQuery({
    queryKey: ['admin-staff-list-for-assign'],
    queryFn: () => staffService.list({ status: 'ACTIVE', limit: 100 }),
    enabled: canManage,
  })
  const staffMembers = staffData?.data?.staff || []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-support-ticket', ticket.id] })
    queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] })
  }

  const replyMutation = useMutation({
    mutationFn: () => supportTicketService.reply(ticket.id, { body: replyBody, isInternalNote }),
    onSuccess: () => {
      setReplyBody('')
      setIsInternalNote(false)
      invalidate()
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to send reply'),
  })

  const assignMutation = useMutation({
    mutationFn: (userId: string | null) => supportTicketService.assign(ticket.id, userId),
    onSuccess: () => {
      toast.success('Ticket assignment updated')
      invalidate()
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to assign ticket'),
  })

  const statusMutation = useMutation({
    mutationFn: (status: SupportTicketStatus) => supportTicketService.updateStatus(ticket.id, status),
    onSuccess: () => {
      toast.success('Ticket status updated')
      invalidate()
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to update status'),
  })

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className='max-w-2xl max-h-[85vh] flex flex-col'>
        <DialogHeader>
          <DialogTitle>{liveTicket.subject}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-wrap items-center gap-2 border-b pb-3'>
          <Select
            value={liveTicket.status}
            onValueChange={(value: SupportTicketStatus) => statusMutation.mutate(value)}
            disabled={!canManage || statusMutation.isPending}
          >
            <SelectTrigger className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABEL) as SupportTicketStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={liveTicket.assigned_to_user_id || 'unassigned'}
            onValueChange={(value: string) => assignMutation.mutate(value === 'unassigned' ? null : value)}
            disabled={!canManage || assignMutation.isPending}
          >
            <SelectTrigger className='w-52'>
              <UserCog className='mr-1 h-4 w-4' />
              <SelectValue placeholder='Assign to...' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='unassigned'>Unassigned</SelectItem>
              {staffMembers.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {`${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant='outline' className='capitalize'>
            {liveTicket.category.replace('_', ' ')}
          </Badge>
        </div>

        <div className='flex-1 space-y-3 overflow-y-auto'>
          {isLoading ? (
            <Skeleton className='h-24 w-full' />
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg p-3 text-sm ${
                  message.is_internal_note
                    ? 'border border-amber-200 bg-amber-50'
                    : message.sender_type === 'staff'
                      ? 'ml-8 bg-primary/10'
                      : 'mr-8 bg-muted'
                }`}
              >
                <div className='mb-1 flex items-center justify-between text-xs text-muted-foreground'>
                  <span className='font-medium'>
                    {message.is_internal_note
                      ? 'Internal note'
                      : message.sender_type === 'staff'
                        ? 'Staff'
                        : 'Seller'}
                  </span>
                  <span>{format(parseISO(message.created_at), 'MMM d, h:mm a')}</span>
                </div>
                <p className='whitespace-pre-wrap'>{message.body}</p>
              </div>
            ))
          )}
        </div>

        {canManage && (
          <div className='space-y-2 border-t pt-3'>
            <Textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={isInternalNote ? 'Internal note (seller never sees this)...' : 'Reply to the seller...'}
              rows={3}
            />
            <div className='flex items-center justify-between'>
              <label className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Checkbox checked={isInternalNote} onCheckedChange={(checked: boolean) => setIsInternalNote(Boolean(checked))} />
                Internal note only
              </label>
              <Button
                size='sm'
                disabled={!replyBody.trim() || replyMutation.isPending}
                onClick={() => replyMutation.mutate()}
              >
                <Send className='mr-2 h-4 w-4' />
                {replyMutation.isPending ? 'Sending...' : isInternalNote ? 'Add note' : 'Send reply'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TicketsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-support-tickets', statusFilter, categoryFilter, search],
    queryFn: () =>
      supportTicketService.list({
        status: statusFilter === 'all' ? undefined : (statusFilter as SupportTicketStatus),
        category: categoryFilter === 'all' ? undefined : (categoryFilter as SupportTicketCategory),
        search: search || undefined,
        limit: 50,
      }),
  })
  const tickets = data?.data?.items || []

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <LifeBuoy className='h-5 w-5 text-primary' />
            Seller Support Tickets
          </CardTitle>
          <CardDescription>
            A real threaded conversation with sellers -- assignable to a specific staff member.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='relative w-64'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search subject or seller...'
                className='pl-9'
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='w-40'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as SupportTicketStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className='w-45'>
                <SelectValue placeholder='Category' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All categories</SelectItem>
                <SelectItem value='payouts'>Payouts</SelectItem>
                <SelectItem value='verification'>Verification</SelectItem>
                <SelectItem value='product_listing'>Product listing</SelectItem>
                <SelectItem value='technical'>Technical</SelectItem>
                <SelectItem value='other'>Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading tickets...</TableCell>
                </TableRow>
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No support tickets match these filters.</TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className='cursor-pointer'
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <TableCell className='font-medium'>{ticket.subject}</TableCell>
                    <TableCell>{ticket.seller_display_name || ticket.seller_handle || '—'}</TableCell>
                    <TableCell className='capitalize'>{ticket.category.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(ticket.last_message_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedTicket && (
        <TicketDrawer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  )
}

function AnnouncementsTab() {
  const queryClient = useQueryClient()
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('support.manage')

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [targetTier, setTargetTier] = useState<SellerTier | 'all'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: () => announcementService.list({ limit: 20 }),
  })
  const announcements = data?.data?.items || []

  const createMutation = useMutation({
    mutationFn: () =>
      announcementService.create({ subject, body, targetTier: targetTier === 'all' ? null : targetTier }),
    onSuccess: () => {
      toast.success('Announcement sent')
      setSubject('')
      setBody('')
      setTargetTier('all')
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to send announcement'),
  })

  return (
    <div className='space-y-6'>
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Megaphone className='h-5 w-5 text-primary' />
              New announcement
            </CardTitle>
            <CardDescription>
              A one-to-many message to sellers -- in-app only for now, no bulk email.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder='Subject' />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder='Message' />
            <div className='flex items-center gap-3'>
              <Select value={targetTier} onValueChange={(value: SellerTier | 'all') => setTargetTier(value)}>
                <SelectTrigger className='w-48'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All sellers</SelectItem>
                  <SelectItem value='unverified'>Unverified tier only</SelectItem>
                  <SelectItem value='basic'>Basic tier only</SelectItem>
                  <SelectItem value='trusted'>Trusted tier only</SelectItem>
                  <SelectItem value='pro'>Pro tier only</SelectItem>
                </SelectContent>
              </Select>
              <Button
                disabled={!subject.trim() || !body.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Sending...' : 'Send announcement'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Past announcements</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {isLoading ? (
            <Skeleton className='h-16 w-full' />
          ) : announcements.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No announcements sent yet.</p>
          ) : (
            announcements.map((announcement) => (
              <div key={announcement.id} className='rounded-lg border p-3'>
                <div className='flex items-center justify-between gap-3'>
                  <p className='font-medium'>{announcement.subject}</p>
                  <Badge variant='outline'>{announcement.target_tier ? `${announcement.target_tier} tier` : 'All sellers'}</Badge>
                </div>
                <p className='mt-1 text-sm text-muted-foreground'>{announcement.body}</p>
                <p className='mt-2 text-xs text-muted-foreground'>
                  {format(parseISO(announcement.created_at), 'MMM d, yyyy')} &middot; {announcement.readCount} of{' '}
                  {announcement.totalRecipients} read
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReportingTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-support-reporting'],
    queryFn: () => supportTicketService.getReportingSummary(),
  })
  const summary: SupportReportingSummary | undefined = data?.data

  if (isLoading) {
    return <Skeleton className='h-64 w-full' />
  }
  if (!summary) {
    return <p className='text-sm text-muted-foreground'>Reporting data isn&apos;t available right now.</p>
  }

  const maxStatusCount = Math.max(...summary.byStatus.map((s) => s.count), 1)
  const maxCategoryCount = Math.max(...summary.byCategory.map((c) => c.count), 1)

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Tickets by status (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {summary.byStatus.length === 0 ? (
              <p className='text-sm text-muted-foreground'>No tickets in range.</p>
            ) : (
              summary.byStatus.map((row) => (
                <div key={row.status} className='space-y-1'>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='capitalize'>{row.status.replace('_', ' ')}</span>
                    <span className='text-muted-foreground'>{row.count}</span>
                  </div>
                  <div className='h-2 rounded-full bg-muted'>
                    <div
                      className='h-2 rounded-full bg-primary'
                      style={{ width: `${Math.max((row.count / maxStatusCount) * 100, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Tickets by category (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {summary.byCategory.length === 0 ? (
              <p className='text-sm text-muted-foreground'>No tickets in range.</p>
            ) : (
              summary.byCategory.map((row) => (
                <div key={row.category} className='space-y-1'>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='capitalize'>{row.category.replace('_', ' ')}</span>
                    <span className='text-muted-foreground'>{row.count}</span>
                  </div>
                  <div className='h-2 rounded-full bg-muted'>
                    <div
                      className='h-2 rounded-full bg-primary'
                      style={{ width: `${Math.max((row.count / maxCategoryCount) * 100, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Average time to first staff reply</CardTitle>
          <CardDescription>Only counted over tickets that have received at least one staff reply.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-2xl font-semibold'>
            {summary.averageFirstReplyHours !== null ? `${summary.averageFirstReplyHours.toFixed(1)}h` : 'No replies yet'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Current ticket load per staff member</CardTitle>
          <CardDescription>Open and in-progress tickets only.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.ticketsPerStaffMember.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No tickets currently assigned to staff.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead className='text-right'>Open tickets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.ticketsPerStaffMember.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className='text-right'>{row.count}</TableCell>
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

function SupportTicketsContent() {
  return (
    <Tabs defaultValue='tickets' className='space-y-6'>
      <TabsList>
        <TabsTrigger value='tickets'>
          <LifeBuoy className='mr-2 h-4 w-4' /> Tickets
        </TabsTrigger>
        <TabsTrigger value='announcements'>
          <Megaphone className='mr-2 h-4 w-4' /> Announcements
        </TabsTrigger>
        <TabsTrigger value='reporting'>
          <BarChart3 className='mr-2 h-4 w-4' /> Reporting
        </TabsTrigger>
      </TabsList>
      <TabsContent value='tickets'>
        <TicketsTab />
      </TabsContent>
      <TabsContent value='announcements'>
        <AnnouncementsTab />
      </TabsContent>
      <TabsContent value='reporting'>
        <ReportingTab />
      </TabsContent>
    </Tabs>
  )
}

export default function SupportTicketsPage() {
  return (
    <RequirePagePermission permission='support.view'>
      <SupportTicketsContent />
    </RequirePagePermission>
  )
}
