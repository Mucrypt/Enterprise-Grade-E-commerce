'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Users2,
  Search,
  Copy,
  MoreHorizontal,
  Eye,
  Ban,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import affiliateService, { Affiliate, AffiliateConversion, AffiliateStatus } from '@/services/affiliate.service'
import { formatCurrency } from '@/components/analytics/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface Filters {
  search: string
  status: AffiliateStatus | 'all'
  page: number
  limit: number
}

const CONVERSION_STATUS_VARIANT: Record<
  AffiliateConversion['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'secondary',
  confirmed: 'default',
  cancelled: 'destructive',
  paid: 'outline',
}

function affiliateDisplayName(affiliate: Affiliate) {
  const name = [affiliate.first_name, affiliate.last_name].filter(Boolean).join(' ').trim()
  return name || affiliate.email
}

function AffiliatesPageContent() {
  const queryClient = useQueryClient()
  // ADMIN-PLATFORM-2-era pages typically gate an in-page action button with
  // either PermissionGate or useStaffAccess().hasPermission directly (see
  // dashboard/promotions/connections/page.tsx). Used directly here since
  // the Suspend/Reactivate action lives inside a DropdownMenuItem, not a
  // standalone block PermissionGate wraps more naturally. The server
  // (requirePermissionOrLegacyRole('affiliates.manage', ...)) is the real
  // enforcement point regardless.
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('affiliates.manage')

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    page: 1,
    limit: 20,
  })
  const [viewingAffiliate, setViewingAffiliate] = useState<Affiliate | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['affiliates', filters],
    queryFn: () =>
      affiliateService.listAffiliates({
        page: filters.page,
        limit: filters.limit,
        search: filters.search || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
      }),
  })
  const affiliates = data?.data?.affiliates || []
  const total = data?.data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / filters.limit))

  const { data: conversionsData, isLoading: conversionsLoading } = useQuery({
    queryKey: ['affiliate-conversions', viewingAffiliate?.id],
    queryFn: () => affiliateService.getAffiliateConversions(viewingAffiliate!.id),
    enabled: !!viewingAffiliate,
  })
  const conversions = conversionsData?.data?.conversions || []

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AffiliateStatus }) =>
      affiliateService.updateAffiliateStatus(id, status),
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'active' ? 'Affiliate reactivated.' : 'Affiliate suspended.')
      queryClient.invalidateQueries({ queryKey: ['affiliates'] })
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) =>
      toast.error(error.response?.data?.error || 'Failed to update affiliate status.'),
  })

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Referral code copied.')
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Affiliates</h1>
        <p className='text-muted-foreground'>
          Everyone enrolled in the referral program -- clicks, conversions, and lifetime earnings
          per affiliate. Suspending an affiliate stops new click tracking and commission accrual
          for their referral code without deleting their history.
        </p>
      </div>

      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-wrap gap-4'>
            <div className='flex-1 min-w-50'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='Search by name, email, or referral code...'
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                  className='pl-9'
                />
              </div>
            </div>
            <Select
              value={filters.status}
              onValueChange={(value: string) =>
                setFilters({ ...filters, status: value as Filters['status'], page: 1 })
              }
            >
              <SelectTrigger className='w-45'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All statuses</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='suspended'>Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Affiliate directory</CardTitle>
          <CardDescription>{total} affiliate{total === 1 ? '' : 's'} enrolled</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-4'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : affiliates.length === 0 ? (
            <div className='text-center py-12'>
              <Users2 className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold'>No affiliates found</h3>
              <p className='text-muted-foreground'>Try adjusting your search or status filter.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Referral code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-right'>Clicks</TableHead>
                    <TableHead className='text-right'>Conversions</TableHead>
                    <TableHead className='text-right'>Total earned</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className='w-16'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((affiliate) => (
                    <TableRow key={affiliate.id}>
                      <TableCell className='font-medium'>{affiliateDisplayName(affiliate)}</TableCell>
                      <TableCell className='text-sm text-muted-foreground'>{affiliate.email}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <code className='font-mono text-xs bg-muted px-2 py-1 rounded'>
                            {affiliate.referral_code}
                          </code>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7'
                            onClick={() => copyCode(affiliate.referral_code)}
                          >
                            <Copy className='h-3 w-3' />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {affiliate.status === 'active' ? (
                          <Badge className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'>
                            Active
                          </Badge>
                        ) : (
                          <Badge variant='secondary'>Suspended</Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>{affiliate.total_clicks}</TableCell>
                      <TableCell className='text-right'>{affiliate.total_conversions}</TableCell>
                      <TableCell className='text-right font-medium'>
                        {formatCurrency(Number(affiliate.total_earned))}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {format(parseISO(affiliate.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon'>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setViewingAffiliate(affiliate)}>
                              <Eye className='mr-2 h-4 w-4' />
                              View conversions
                            </DropdownMenuItem>
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                {affiliate.status === 'active' ? (
                                  <DropdownMenuItem
                                    className='text-destructive'
                                    onClick={() =>
                                      statusMutation.mutate({ id: affiliate.id, status: 'suspended' })
                                    }
                                  >
                                    <Ban className='mr-2 h-4 w-4' />
                                    Suspend
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({ id: affiliate.id, status: 'active' })
                                    }
                                  >
                                    <CheckCircle className='mr-2 h-4 w-4' />
                                    Reactivate
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className='flex items-center justify-between mt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Showing {(filters.page - 1) * filters.limit + 1} to{' '}
                    {Math.min(filters.page * filters.limit, total)} of {total} affiliates
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                      disabled={filters.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                      disabled={filters.page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingAffiliate} onOpenChange={(open: boolean) => !open && setViewingAffiliate(null)}>
        <DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              Conversions -- {viewingAffiliate ? affiliateDisplayName(viewingAffiliate) : ''}
            </DialogTitle>
            <DialogDescription>
              Every order attributed to referral code{' '}
              <code className='font-mono'>{viewingAffiliate?.referral_code}</code>, most recent first.
            </DialogDescription>
          </DialogHeader>

          {conversionsLoading ? (
            <div className='space-y-3'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : conversions.length === 0 ? (
            <p className='text-sm text-muted-foreground py-8 text-center'>
              No conversions yet for this affiliate.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className='text-right'>Order value</TableHead>
                  <TableHead className='text-right'>Rate</TableHead>
                  <TableHead className='text-right'>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions.map((conversion) => (
                  <TableRow key={conversion.id}>
                    <TableCell className='font-mono text-xs'>{conversion.order_id}</TableCell>
                    <TableCell className='text-right'>
                      {formatCurrency(Number(conversion.order_value))}
                    </TableCell>
                    <TableCell className='text-right'>
                      {Number(conversion.commission_rate_snapshot)}%
                    </TableCell>
                    <TableCell className='text-right font-medium'>
                      {formatCurrency(Number(conversion.commission_amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CONVERSION_STATUS_VARIANT[conversion.status]} className='capitalize'>
                        {conversion.status}
                      </Badge>
                      {conversion.status === 'cancelled' && conversion.cancelled_reason && (
                        <p className='text-xs text-muted-foreground mt-1'>{conversion.cancelled_reason}</p>
                      )}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {format(parseISO(conversion.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AffiliatesPage() {
  return (
    <RequirePagePermission permission='affiliates.view'>
      <AffiliatesPageContent />
    </RequirePagePermission>
  )
}
