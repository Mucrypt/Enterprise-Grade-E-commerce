import { useEffect, useState } from 'react'
import { DollarSign, Loader2, Wallet } from 'lucide-react'
import { sellerEarningsApi, type SellerEarningsSummary, type SellerLedgerEntry } from '../../api'
import { formatPrice } from '../../utils'

const REASON_LABEL: Record<string, string> = {
  earning_confirmed: 'Earning confirmed',
  earning_clawback: 'Clawed back',
  payout_sent: 'Payout sent',
}

export default function EarningsTab() {
  const [summary, setSummary] = useState<SellerEarningsSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [ledger, setLedger] = useState<SellerLedgerEntry[]>([])
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerHasMore, setLedgerHasMore] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const loadLedger = async (page: number) => {
    setLedgerLoading(true)
    try {
      const result = await sellerEarningsApi.getLedger({ page, limit: 20 })
      setLedger((current) => (page === 1 ? result.entries : [...current, ...result.entries]))
      setLedgerPage(result.page)
      setLedgerHasMore(result.hasMore)
    } catch {
      // Soft failure -- the rest of the tab still works.
    } finally {
      setLedgerLoading(false)
    }
  }

  useEffect(() => {
    sellerEarningsApi
      .getSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
    loadLedger(1)
  }, [])

  const handleLoadMore = async () => {
    if (!ledgerHasMore || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      await loadLedger(ledgerPage + 1)
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
          <Wallet className='h-5 w-5 text-orange-600' /> Earnings
        </h2>
        <p className='mt-1 text-sm text-gray-500'>
          What you&apos;ve earned from your own store products. Balances are computed live from
          your real payout history -- never an estimate.
        </p>

        {summaryLoading && !summary ? (
          <div className='mt-5 flex items-center gap-2 text-sm text-gray-500'>
            <Loader2 className='h-4 w-4 animate-spin' /> Loading your earnings...
          </div>
        ) : (
          <>
            <div className='mt-5 grid gap-3 sm:grid-cols-3'>
              <div className='rounded-2xl border border-gray-100 bg-slate-50 p-4'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-gray-500'>Pending</p>
                <p className='mt-1 text-2xl font-bold text-slate-900'>
                  {formatPrice(summary?.pendingBalance ?? 0)}
                </p>
                <p className='mt-1 text-xs text-gray-500'>Not yet confirmed -- still inside the payout hold period.</p>
              </div>
              <div className='rounded-2xl border border-gray-100 bg-slate-50 p-4'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-gray-500'>Owed to you</p>
                <p className='mt-1 text-2xl font-bold text-emerald-700'>
                  {formatPrice(summary?.confirmedUnpaidBalance ?? 0)}
                </p>
                <p className='mt-1 text-xs text-gray-500'>Confirmed and ready for payout.</p>
              </div>
              <div className='rounded-2xl border border-gray-100 bg-slate-50 p-4'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-gray-500'>Lifetime paid</p>
                <p className='mt-1 text-2xl font-bold text-slate-900'>{formatPrice(summary?.lifetimePaid ?? 0)}</p>
                <p className='mt-1 text-xs text-gray-500'>Total sent to you so far.</p>
              </div>
            </div>

            {summary?.tier ? (
              <p className='mt-4 text-xs text-gray-500'>
                Current tier: <span className='font-semibold text-slate-700'>{summary.tier}</span>
                {summary.commissionRate !== null && (
                  <> -- {summary.commissionRate}% platform commission on new sales.</>
                )}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
          <DollarSign className='h-5 w-5 text-orange-600' /> Payout history
        </h2>

        <div className='mt-5 space-y-2'>
          {ledgerLoading && ledger.length === 0 ? (
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <Loader2 className='h-4 w-4 animate-spin' /> Loading your history...
            </div>
          ) : ledger.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500'>
              Nothing here yet -- entries appear once an order confirms and clears its hold period.
            </div>
          ) : (
            ledger.map((entry) => {
              const amount = Number(entry.delta_amount)
              return (
                <div
                  key={entry.id}
                  className='flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3'
                >
                  <div>
                    <p className='text-sm font-medium text-slate-900'>
                      {REASON_LABEL[entry.reason] || entry.reason}
                    </p>
                    <p className='text-xs text-gray-500'>
                      {new Date(entry.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {amount >= 0 ? '+' : ''}
                    {formatPrice(amount)}
                  </p>
                </div>
              )
            })
          )}
        </div>

        {ledgerHasMore ? (
          <div className='mt-5'>
            <button
              type='button'
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' /> Loading more
                </>
              ) : (
                'Load more history'
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
