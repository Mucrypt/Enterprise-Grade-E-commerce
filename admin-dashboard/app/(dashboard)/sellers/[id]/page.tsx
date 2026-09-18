'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { sellerService } from '@/services/seller.service'
import { supportTicketService, type SupportTicketCategory } from '@/services/support-ticket.service'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import { formatCurrency } from '@/components/analytics/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  ArrowLeft,
  BadgeCheck,
  Clapperboard,
  MessageSquarePlus,
  Package,
  RotateCcw,
  ShieldAlert,
  Wallet,
} from 'lucide-react'

function NewTicketDialog({ sellerProfileId, onClose }: { sellerProfileId: string; onClose: () => void }) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<SupportTicketCategory>('other')
  const [body, setBody] = useState('')

  const mutation = useMutation({
    mutationFn: () => supportTicketService.createForSeller({ sellerProfileId, subject, category, body }),
    onSuccess: () => {
      toast.success('Ticket opened -- the seller has been notified')
      router.push('/support-tickets')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to open ticket')
    },
  })

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Open a ticket with this seller</DialogTitle>
          <DialogDescription>Starts a new support conversation -- the seller is notified immediately.</DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='space-y-2'>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder='e.g. Please update your product photos' />
          </div>
          <div className='space-y-2'>
            <Label>Category</Label>
            <Select value={category} onValueChange={(value: SupportTicketCategory) => setCategory(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='payouts'>Payouts</SelectItem>
                <SelectItem value='verification'>Verification</SelectItem>
                <SelectItem value='product_listing'>Product listing</SelectItem>
                <SelectItem value='technical'>Technical</SelectItem>
                <SelectItem value='other'>Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder='What do you need from the seller?' />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!subject.trim() || !body.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Opening...' : 'Open ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SellerDetailContent() {
  const params = useParams()
  const router = useRouter()
  const sellerProfileId = params.id as string
  const queryClient = useQueryClient()
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('sellers.manage')

  const [pendingTier, setPendingTier] = useState<string | null>(null)
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-seller-detail', sellerProfileId],
    queryFn: () => sellerService.getSellerDetail(sellerProfileId),
  })
  const detail = data?.data

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-seller-detail', sellerProfileId] })
    queryClient.invalidateQueries({ queryKey: ['admin-all-sellers'] })
  }

  const tierMutation = useMutation({
    mutationFn: (tier: string) => sellerService.setSellerTier(sellerProfileId, tier),
    onSuccess: () => {
      toast.success('Seller tier updated')
      invalidate()
      setPendingTier(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update tier')
    },
  })

  const suspendMutation = useMutation({
    mutationFn: () =>
      sellerService.suspendSellerProfile(sellerProfileId, {
        suspensionReason: 'Suspended from seller detail page',
      }),
    onSuccess: () => {
      toast.success('Seller suspended')
      invalidate()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to suspend seller')
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: () => sellerService.reactivateSellerProfile(sellerProfileId),
    onSuccess: () => {
      toast.success('Seller reactivated')
      invalidate()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to reactivate seller')
    },
  })

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-40 w-full' />
        <Skeleton className='h-40 w-full' />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className='space-y-4'>
        <Button variant='ghost' size='sm' onClick={() => router.back()}>
          <ArrowLeft className='mr-2 h-4 w-4' /> Back
        </Button>
        <p className='text-muted-foreground'>Seller not found.</p>
      </div>
    )
  }

  const { sellerProfile, verificationRequests, storeProductCount, discoverPostCount, earningsSummary } = detail
  const displayName =
    sellerProfile.display_name || `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || sellerProfile.email

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <Button variant='ghost' size='sm' onClick={() => router.back()}>
          <ArrowLeft className='mr-2 h-4 w-4' /> Back to sellers
        </Button>
        <div className='flex gap-2'>
          <Button variant='outline' disabled={!canManage} onClick={() => setTicketDialogOpen(true)}>
            <MessageSquarePlus className='mr-2 h-4 w-4' /> New ticket
          </Button>
          {sellerProfile.is_suspended ? (
            <Button variant='outline' disabled={!canManage || reactivateMutation.isPending} onClick={() => reactivateMutation.mutate()}>
              <RotateCcw className='mr-2 h-4 w-4' /> Reactivate
            </Button>
          ) : (
            <Button variant='destructive' disabled={!canManage || suspendMutation.isPending} onClick={() => suspendMutation.mutate()}>
              <ShieldAlert className='mr-2 h-4 w-4' /> Suspend
            </Button>
          )}
        </div>
      </div>

      {ticketDialogOpen && (
        <NewTicketDialog sellerProfileId={sellerProfileId} onClose={() => setTicketDialogOpen(false)} />
      )}

      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <CardTitle className='flex items-center gap-2 text-xl'>
                {displayName}
                {sellerProfile.verification_status === 'approved' && (
                  <BadgeCheck className='h-5 w-5 text-emerald-600' />
                )}
              </CardTitle>
              <CardDescription>
                {sellerProfile.handle ? `@${sellerProfile.handle} · ` : ''}
                {sellerProfile.email}
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Badge
                variant={
                  sellerProfile.is_suspended
                    ? 'destructive'
                    : sellerProfile.verification_status === 'approved'
                      ? 'default'
                      : 'secondary'
                }
              >
                {sellerProfile.is_suspended ? 'suspended' : sellerProfile.verification_status}
              </Badge>
              <Select
                value={pendingTier ?? sellerProfile.tier}
                onValueChange={(value: string) => {
                  setPendingTier(value)
                  tierMutation.mutate(value)
                }}
                disabled={!canManage || tierMutation.isPending}
              >
                <SelectTrigger className='w-36'>
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
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 sm:grid-cols-4'>
            <div className='rounded-lg border p-3'>
              <p className='text-xs text-muted-foreground'>Listing limit</p>
              <p className='mt-1 text-lg font-semibold'>{sellerProfile.max_active_listings}</p>
            </div>
            <div className='rounded-lg border p-3'>
              <p className='text-xs text-muted-foreground'>Price cap</p>
              <p className='mt-1 text-lg font-semibold'>
                {sellerProfile.max_product_price ? formatCurrency(Number(sellerProfile.max_product_price)) : 'Custom'}
              </p>
            </div>
            <div className='rounded-lg border p-3'>
              <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                <Package className='h-3.5 w-3.5' /> Store products
              </p>
              <p className='mt-1 text-lg font-semibold'>{storeProductCount}</p>
            </div>
            <div className='rounded-lg border p-3'>
              <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                <Clapperboard className='h-3.5 w-3.5' /> Discover posts
              </p>
              <p className='mt-1 text-lg font-semibold'>{discoverPostCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Wallet className='h-5 w-5 text-emerald-600' /> Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {earningsSummary ? (
            <div className='grid gap-4 sm:grid-cols-3'>
              <div>
                <p className='text-xs text-muted-foreground'>Pending</p>
                <p className='text-lg font-semibold'>{formatCurrency(earningsSummary.pendingBalance)}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Owed (confirmed)</p>
                <p className='text-lg font-semibold text-emerald-700'>
                  {formatCurrency(earningsSummary.confirmedUnpaidBalance)}
                </p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Lifetime paid</p>
                <p className='text-lg font-semibold'>{formatCurrency(earningsSummary.lifetimePaid)}</p>
              </div>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>Earnings data isn&apos;t available for this seller yet.</p>
          )}
          <Button asChild variant='link' className='mt-2 h-auto p-0'>
            <Link href='/sellers/payouts'>Open payouts &rarr;</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification history</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {verificationRequests.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No verification requests yet.</p>
          ) : (
            verificationRequests.map((request) => (
              <div key={request.id} className='rounded-lg border p-3'>
                <div className='flex items-center justify-between'>
                  <p className='font-medium'>{request.requested_tier} tier request</p>
                  <Badge variant='outline'>{request.status}</Badge>
                </div>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {request.created_at ? format(parseISO(request.created_at), 'MMM d, yyyy') : ''}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SellerDetailPage() {
  return (
    <RequirePagePermission permission='sellers.view'>
      <SellerDetailContent />
    </RequirePagePermission>
  )
}
