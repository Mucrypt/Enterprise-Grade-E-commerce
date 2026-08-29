'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Wallet, Info } from 'lucide-react'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import affiliateService, { StoreCreditLedgerEntry, StoreCreditLedgerReason } from '@/services/affiliate.service'
import { formatCurrency } from '@/components/analytics/format'
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
import { Skeleton } from '@/components/ui/skeleton'

const REASON_LABEL: Record<StoreCreditLedgerReason, string> = {
  affiliate_commission: 'Commission earned',
  affiliate_commission_clawback: 'Commission clawed back',
  redeemed_at_checkout: 'Redeemed at checkout',
  manual_adjustment: 'Manual adjustment',
}

function entryName(entry: StoreCreditLedgerEntry) {
  const name = [entry.first_name, entry.last_name].filter(Boolean).join(' ').trim()
  return name || entry.email
}

function PayoutsPageContent() {
  const [page, setPage] = useState(1)
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-ledger', page],
    queryFn: () => affiliateService.getStoreCreditLedger({ page, limit }),
  })
  const entries = data?.data?.entries || []
  const total = data?.data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Payouts</h1>
        <p className='text-muted-foreground'>
          The store-credit ledger backing the affiliate program&apos;s payouts.
        </p>
      </div>

      <Card className='border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'>
        <CardContent className='pt-6 flex gap-3 text-sm'>
          <Info className='h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400' />
          <p className='text-blue-900 dark:text-blue-200'>
            Store-credit issuance is fully automatic -- a background worker confirms commissions
            once their hold period elapses and credits them here. This page is for visibility and
            audit only; there is no create/edit/delete action in this version.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>{total} entr{total === 1 ? 'y' : 'ies'}, most recent first</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-4'>
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className='h-14 w-full' />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className='text-center py-12'>
              <Wallet className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold'>No ledger entries yet</h3>
              <p className='text-muted-foreground'>
                Entries appear here as commissions are confirmed and credited.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Affiliate</TableHead>
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
                        <TableCell>
                          <div className='font-medium'>{entryName(entry)}</div>
                          <div className='text-xs text-muted-foreground'>{entry.email}</div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            amount >= 0
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-red-700 dark:text-red-400'
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

              {totalPages > 1 && (
                <div className='flex items-center justify-between mt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
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
    </div>
  )
}

export default function PayoutsPage() {
  return (
    <RequirePagePermission permission='affiliates.payouts'>
      <PayoutsPageContent />
    </RequirePagePermission>
  )
}
