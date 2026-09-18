'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Wallet, Info, ChevronRight } from 'lucide-react'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { useStaffAccess } from '@/contexts/StaffAccessContext'
import sellerPayoutService, { SellerPayoutBalance } from '@/services/seller-payout.service'
import { formatCurrency } from '@/components/analytics/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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

const REASON_LABEL: Record<string, string> = {
  earning_confirmed: 'Earning confirmed',
  earning_clawback: 'Clawed back',
  payout_sent: 'Payout sent',
}

function RecordPayoutDialog({
  seller,
  onClose,
}: {
  seller: SellerPayoutBalance
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer')
  const [payoutReference, setPayoutReference] = useState('')
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['seller-eligible-earnings', seller.seller_profile_id],
    queryFn: async () => {
      const res = await sellerPayoutService.getEligibleEarnings(seller.seller_profile_id)
      const earnings = res.data
      // Pre-check everything by default -- the common case is "pay
      // everything owed"; the admin can uncheck specific earnings to
      // hold one back.
      setSelected(new Set(earnings.map((e) => e.id)))
      return earnings
    },
  })
  const earnings = data || []

  const total = useMemo(
    () => earnings.filter((e) => selected.has(e.id)).reduce((sum, e) => sum + Number(e.seller_net_amount), 0),
    [earnings, selected],
  )

  const mutation = useMutation({
    mutationFn: () =>
      sellerPayoutService.recordPayoutBatch(seller.seller_profile_id, {
        amount: Math.round(total * 100) / 100,
        payoutMethod,
        payoutReference: payoutReference || undefined,
        notes: notes || undefined,
        earningIds: Array.from(selected),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-payout-balances'] })
      toast.success(`Payout of ${formatCurrency(total)} recorded for ${seller.display_name || seller.handle}`)
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to record payout')
    },
  })

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className='max-w-2xl max-h-[85vh] flex flex-col'>
        <DialogHeader>
          <DialogTitle>Record payout -- {seller.display_name || seller.handle}</DialogTitle>
          <DialogDescription>
            This records a payout you&apos;ve already sent (bank transfer, PayPal, etc.) -- it doesn&apos;t send money itself.
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto space-y-4'>
          {isLoading ? (
            <div className='space-y-2'>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : earnings.length === 0 ? (
            <p className='text-muted-foreground text-sm py-4'>No confirmed, unbatched earnings for this seller.</p>
          ) : (
            <div className='space-y-1 border rounded-lg p-2'>
              {earnings.map((earning) => (
                <div key={earning.id} className='flex items-center gap-3 p-2 rounded-md hover:bg-muted/50'>
                  <Checkbox checked={selected.has(earning.id)} onCheckedChange={() => toggle(earning.id)} />
                  <div className='flex-1 min-w-0'>
                    <div className='text-sm font-medium'>Order {earning.order_number}</div>
                    <div className='text-xs text-muted-foreground'>
                      {formatCurrency(Number(earning.gross_item_amount))} gross &middot; {earning.commission_rate_snapshot}% commission &middot; confirmed{' '}
                      {format(parseISO(earning.confirmed_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className='text-sm font-semibold'>{formatCurrency(Number(earning.seller_net_amount))}</div>
                </div>
              ))}
            </div>
          )}

          <div className='flex items-center justify-between border-t pt-3'>
            <span className='text-sm font-medium'>Total to record</span>
            <span className='text-lg font-bold'>{formatCurrency(total)}</span>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <Label>Payout method</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='bank_transfer'>Bank transfer</SelectItem>
                  <SelectItem value='paypal'>PayPal</SelectItem>
                  <SelectItem value='other'>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input
                value={payoutReference}
                onChange={(e) => setPayoutReference(e.target.value)}
                placeholder='e.g. bank confirmation #'
              />
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={selected.size === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Recording...' : `Record payout of ${formatCurrency(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SellerLedgerDrilldown({ seller, onClose }: { seller: SellerPayoutBalance; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-payout-ledger', seller.seller_profile_id],
    queryFn: () => sellerPayoutService.getLedger(seller.seller_profile_id, { limit: 50 }),
  })
  const entries = data?.data || []

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className='max-w-2xl max-h-[85vh] flex flex-col'>
        <DialogHeader>
          <DialogTitle>Ledger -- {seller.display_name || seller.handle}</DialogTitle>
        </DialogHeader>
        <div className='flex-1 overflow-y-auto'>
          {isLoading ? (
            <div className='space-y-2'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className='text-muted-foreground text-sm py-4'>No ledger entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-right'>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const amount = Number(entry.delta_amount)
                  return (
                    <TableRow key={entry.id}>
                      <TableCell
                        className={`text-right font-medium ${
                          amount >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {amount >= 0 ? '+' : ''}
                        {formatCurrency(amount)}
                      </TableCell>
                      <TableCell className='text-sm'>{REASON_LABEL[entry.reason] || entry.reason}</TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {format(parseISO(entry.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SellerPayoutsPageContent() {
  const { hasPermission } = useStaffAccess()
  const canManage = hasPermission('sellers.payouts.manage')
  const [payoutSeller, setPayoutSeller] = useState<SellerPayoutBalance | null>(null)
  const [ledgerSeller, setLedgerSeller] = useState<SellerPayoutBalance | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['seller-payout-balances'],
    queryFn: () => sellerPayoutService.getBalances(),
  })
  const balances = data?.data

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Seller Payouts</h1>
        <p className='text-muted-foreground'>Sellers currently owed money, and their full earnings history.</p>
      </div>

      <Card className='border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'>
        <CardContent className='pt-6 flex gap-3 text-sm'>
          <Info className='h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400' />
          <p className='text-blue-900 dark:text-blue-200'>
            Earnings confirm automatically once an order is safely past its return window (per-tier hold period).
            &quot;Record payout&quot; only logs a payout you&apos;ve already sent via bank transfer, PayPal, etc. --
            it doesn&apos;t move any money itself.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sellers owed money</CardTitle>
          <CardDescription>Sorted by amount currently owed, highest first</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-4'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-14 w-full' />
              ))}
            </div>
          ) : !balances || balances.length === 0 ? (
            <div className='text-center py-12'>
              <Wallet className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold'>No sellers currently owed anything</h3>
              <p className='text-muted-foreground'>Confirmed, unpaid earnings will show up here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className='text-right'>Pending</TableHead>
                  <TableHead className='text-right'>Owed now</TableHead>
                  <TableHead className='text-right'>Lifetime paid</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((seller) => (
                  <TableRow key={seller.seller_profile_id}>
                    <TableCell>
                      <div className='font-medium'>{seller.display_name || seller.handle || 'Unnamed seller'}</div>
                      {seller.handle && <div className='text-xs text-muted-foreground'>@{seller.handle}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline' className='capitalize'>
                        {seller.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right text-muted-foreground'>
                      {formatCurrency(Number(seller.pending_balance))}
                    </TableCell>
                    <TableCell className='text-right font-semibold'>
                      {formatCurrency(Number(seller.confirmed_unpaid_balance))}
                    </TableCell>
                    <TableCell className='text-right text-muted-foreground'>
                      {formatCurrency(Number(seller.lifetime_paid))}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <Button variant='ghost' size='sm' onClick={() => setLedgerSeller(seller)}>
                          Ledger <ChevronRight className='h-3.5 w-3.5 ml-1' />
                        </Button>
                        {canManage && Number(seller.confirmed_unpaid_balance) > 0 && (
                          <Button size='sm' onClick={() => setPayoutSeller(seller)}>
                            Record payout
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {payoutSeller && <RecordPayoutDialog seller={payoutSeller} onClose={() => setPayoutSeller(null)} />}
      {ledgerSeller && <SellerLedgerDrilldown seller={ledgerSeller} onClose={() => setLedgerSeller(null)} />}
    </div>
  )
}

export default function SellerPayoutsPage() {
  return (
    <RequirePagePermission permission='sellers.payouts.view'>
      <SellerPayoutsPageContent />
    </RequirePagePermission>
  )
}
