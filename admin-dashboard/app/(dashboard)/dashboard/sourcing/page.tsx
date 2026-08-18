'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import sourcingService, { SourcedProductStatus } from '@/services/sourcing.service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Key } from 'lucide-react'

const STATUS_LABEL: Record<SourcedProductStatus, string> = {
  captured: 'Captured',
  rewriting: 'Rewriting...',
  ready_for_review: 'Ready for review',
  review_edited: 'Edited',
  committed: 'Published',
  rewrite_failed: 'Rewrite failed',
  discarded: 'Discarded',
}

const STATUS_VARIANT: Record<SourcedProductStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  captured: 'outline',
  rewriting: 'outline',
  ready_for_review: 'secondary',
  review_edited: 'secondary',
  committed: 'default',
  rewrite_failed: 'destructive',
  discarded: 'outline',
}

/**
 * SOURCING-1 -- drafts list. Every row here is a captured Alibaba/Amazon
 * product still under review; nothing here is a live TechTools product
 * until a human explicitly commits it (see [id]/page.tsx).
 */
function SourcingDraftsPageContent() {
  const [statusFilter, setStatusFilter] = useState<SourcedProductStatus | 'all'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['sourcing', 'products', statusFilter],
    queryFn: () => sourcingService.listSourcedProducts(statusFilter === 'all' ? undefined : statusFilter),
  })

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Sourcing</h1>
          <p className='text-muted-foreground'>
            Products captured from Alibaba/Amazon via the browser extension. Nothing here is live until you review and commit it.
          </p>
        </div>
        <Link href='/dashboard/sourcing/tokens'>
          <Button variant='outline' className='gap-1.5'>
            <Key className='h-4 w-4' /> Extension tokens
          </Button>
        </Link>
      </div>

      <Tabs value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as SourcedProductStatus | 'all')}>
        <TabsList>
          <TabsTrigger value='all'>All</TabsTrigger>
          <TabsTrigger value='ready_for_review'>Ready for review</TabsTrigger>
          <TabsTrigger value='review_edited'>Edited</TabsTrigger>
          <TabsTrigger value='rewrite_failed'>Rewrite failed</TabsTrigger>
          <TabsTrigger value='committed'>Published</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Skeleton className='h-64 rounded-lg' />
      ) : (
        <Card>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Cost (EUR)</TableHead>
                  <TableHead className='text-right'>Suggested Sale</TableHead>
                  <TableHead>Captured</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.products || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className='py-8 text-center text-sm text-muted-foreground'>
                      No sourced products yet -- use the browser extension on a real Alibaba/Amazon product page to import one.
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.products.map((p) => (
                    <TableRow key={p.id} className='cursor-pointer'>
                      <TableCell>
                        <Link href={`/dashboard/sourcing/${p.id}`} className='flex items-center gap-2 hover:underline'>
                          {p.captured_images?.[0]?.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.captured_images[0].url} alt='' className='h-8 w-8 rounded object-cover' />
                          )}
                          <span className='line-clamp-1 max-w-xs'>{p.review_title || p.rewritten_title || p.captured_title}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className='capitalize'>
                          {p.source_platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                      </TableCell>
                      <TableCell className='text-right'>{p.captured_cost_price_eur ? `€${Number(p.captured_cost_price_eur).toFixed(2)}` : '—'}</TableCell>
                      <TableCell className='text-right'>
                        {p.final_sale_price
                          ? `€${Number(p.final_sale_price).toFixed(2)}`
                          : p.suggested_sale_price
                            ? `€${Number(p.suggested_sale_price).toFixed(2)} (suggested)`
                            : '—'}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>{new Date(p.captured_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function SourcingDraftsPage() {
  return (
    <RequirePagePermission permission='sourcing.view'>
      <SourcingDraftsPageContent />
    </RequirePagePermission>
  )
}
