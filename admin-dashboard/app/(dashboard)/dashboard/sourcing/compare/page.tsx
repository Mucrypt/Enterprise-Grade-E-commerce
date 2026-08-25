'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import sourcingService from '@/services/sourcing.service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ImageOff, X, ExternalLink, Trophy } from 'lucide-react'

/**
 * SOURCING-1 -- side-by-side comparison of a few candidate imports before
 * deciding which one to actually commit. This is deliberately the scoped-
 * down, honestly-buildable answer to "AutoDS's Marketplace has profit/
 * demand scores for every product" -- we don't have (and won't fake) a
 * cross-market data feed, but we DO already capture real cost/margin data
 * per draft, so comparing several side-by-side is genuine, useful signal
 * built entirely from data this pipeline already has.
 */
function SourcingComparePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean)

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['sourcing', 'product', id],
      queryFn: () => sourcingService.getSourcedProduct(id),
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const products = queries.map((q) => q.data?.product).filter((p): p is NonNullable<typeof p> => !!p)

  const removeFromCompare = (id: string) => {
    const remaining = ids.filter((existing) => existing !== id)
    if (remaining.length < 2) {
      router.push('/dashboard/sourcing')
      return
    }
    router.push(`/dashboard/sourcing/compare?ids=${remaining.join(',')}`)
  }

  const marginOf = (p: (typeof products)[number]) => {
    const cost = Number(p.final_cost_price || p.captured_cost_price_eur || 0)
    const sale = Number(p.final_sale_price || p.suggested_sale_price || 0)
    if (!cost || !sale) return null
    return ((sale - cost) / sale) * 100
  }

  const margins = products.map(marginOf)
  const bestMargin = margins.some((m) => m !== null) ? Math.max(...margins.filter((m): m is number => m !== null)) : null

  const rows: { label: string; render: (p: (typeof products)[number]) => ReactNode }[] = [
    {
      label: 'Platform',
      render: (p) => (
        <Badge variant='outline' className='capitalize'>
          {p.source_platform}
        </Badge>
      ),
    },
    { label: 'Supplier', render: (p) => p.captured_supplier_name || '—' },
    {
      label: 'Status',
      render: (p) => <span className='capitalize'>{p.status.replace(/_/g, ' ')}</span>,
    },
    {
      label: 'Cost (EUR)',
      render: (p) => {
        const cost = p.final_cost_price || p.captured_cost_price_eur
        return cost ? `€${Number(cost).toFixed(2)}` : '—'
      },
    },
    {
      label: 'Sale price (EUR)',
      render: (p) => {
        const sale = p.final_sale_price || p.suggested_sale_price
        return sale ? `€${Number(sale).toFixed(2)}` : '—'
      },
    },
    {
      label: 'Margin',
      render: (p) => {
        const margin = marginOf(p)
        if (margin === null) return '—'
        const isBest = bestMargin !== null && margin === bestMargin
        return (
          <span className={`inline-flex items-center gap-1 font-medium ${isBest ? 'text-green-600' : ''}`}>
            {isBest && <Trophy className='h-3.5 w-3.5' />}
            {margin.toFixed(1)}%
          </span>
        )
      },
    },
    {
      label: 'AI confidence',
      render: (p) => (p.rewrite_confidence !== null ? `${p.rewrite_confidence}/100` : '—'),
    },
    {
      label: 'MOQ price tiers',
      render: (p) =>
        p.captured_price_tiers?.length > 0 ? (
          <div className='space-y-0.5 text-xs'>
            {p.captured_price_tiers.slice(0, 3).map((tier, i) => (
              <div key={i}>
                {tier.minQty}
                {tier.maxQty ? `–${tier.maxQty}` : '+'}: {tier.price} {tier.currency}
              </div>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Link href='/dashboard/sourcing'>
          <Button variant='ghost' size='icon'>
            <ArrowLeft className='h-4 w-4' />
          </Button>
        </Link>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Compare drafts</h1>
          <p className='text-muted-foreground'>Side-by-side, so you can pick the strongest candidate before committing.</p>
        </div>
      </div>

      {isLoading ? (
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
          {ids.map((id) => (
            <Skeleton key={id} className='h-96 rounded-lg' />
          ))}
        </div>
      ) : products.length < 2 ? (
        <Card>
          <CardContent className='py-16 text-center text-sm text-muted-foreground'>
            Need at least 2 valid drafts to compare -- go back and select some from the Drafts list.
          </CardContent>
        </Card>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full min-w-160 border-separate border-spacing-0'>
            <thead>
              <tr>
                <th className='w-40' />
                {products.map((p) => (
                  <th key={p.id} className='px-2 pb-3 text-left align-bottom'>
                    <Card className='overflow-hidden'>
                      <div className='relative aspect-square w-full bg-muted'>
                        {p.captured_images?.[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.captured_images[0].url} alt='' className='h-full w-full object-cover' />
                        ) : (
                          <div className='flex h-full w-full items-center justify-center'>
                            <ImageOff className='h-6 w-6 text-muted-foreground' />
                          </div>
                        )}
                        <button
                          onClick={() => removeFromCompare(p.id)}
                          className='absolute right-1 top-1 rounded-full bg-background/90 p-1 hover:bg-background'
                          title='Remove from comparison'
                        >
                          <X className='h-3.5 w-3.5' />
                        </button>
                      </div>
                      <CardContent className='space-y-1.5 p-2.5'>
                        <p className='line-clamp-2 min-h-9 text-xs font-medium leading-tight'>
                          {p.review_title || p.rewritten_title || p.captured_title}
                        </p>
                        <Link href={`/dashboard/sourcing/${p.id}`}>
                          <Button variant='outline' size='sm' className='w-full gap-1 text-xs'>
                            Open <ExternalLink className='h-3 w-3' />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className='border-t'>
                  <td className='py-3 pr-4 text-sm font-medium text-muted-foreground'>{row.label}</td>
                  {products.map((p) => (
                    <td key={p.id} className='px-2 py-3 text-sm'>
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function SourcingComparePage() {
  return (
    <RequirePagePermission permission='sourcing.view'>
      <SourcingComparePageContent />
    </RequirePagePermission>
  )
}
