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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Key, ImageOff, PackageSearch, Clock3, AlertTriangle, CheckCircle2 } from 'lucide-react'

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

  const { data: allData } = useQuery({
    queryKey: ['sourcing', 'products', 'all'],
    queryFn: () => sourcingService.listSourcedProducts(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['sourcing', 'products', statusFilter],
    queryFn: () => sourcingService.listSourcedProducts(statusFilter === 'all' ? undefined : statusFilter),
  })

  const all = allData?.products || []
  const needsReview = all.filter((p) => p.status === 'ready_for_review' || p.status === 'review_edited').length
  const needsAttention = all.filter((p) => p.status === 'rewrite_failed').length
  const published = all.filter((p) => p.status === 'committed').length

  const stats = [
    { label: 'Total drafts', value: all.length, icon: PackageSearch, tone: 'text-foreground' },
    { label: 'Ready for review', value: needsReview, icon: Clock3, tone: 'text-amber-600' },
    { label: 'Needs attention', value: needsAttention, icon: AlertTriangle, tone: 'text-destructive' },
    { label: 'Published', value: published, icon: CheckCircle2, tone: 'text-green-600' },
  ]

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

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className='flex items-center justify-between p-4'>
              <div>
                <p className='text-sm text-muted-foreground'>{stat.label}</p>
                <p className='text-2xl font-bold'>{stat.value}</p>
              </div>
              <stat.icon className={`h-7 w-7 ${stat.tone}`} />
            </CardContent>
          </Card>
        ))}
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
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className='h-56 rounded-lg' />
          ))}
        </div>
      ) : (data?.products || []).length === 0 ? (
        <Card>
          <CardContent className='py-16 text-center text-sm text-muted-foreground'>
            No sourced products yet -- use the browser extension on a real Alibaba/Amazon product page to import one.
          </CardContent>
        </Card>
      ) : (
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
          {data!.products.map((p) => {
            const margin =
              p.captured_cost_price_eur && p.final_sale_price
                ? (((Number(p.final_sale_price) - Number(p.captured_cost_price_eur)) / Number(p.final_sale_price)) * 100).toFixed(0)
                : p.suggested_margin_percent
                  ? Number(p.suggested_margin_percent).toFixed(0)
                  : null

            return (
              <Link key={p.id} href={`/dashboard/sourcing/${p.id}`}>
                <Card className='h-full overflow-hidden transition-shadow hover:shadow-md'>
                  <div className='relative aspect-square w-full bg-muted'>
                    {p.captured_images?.[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.captured_images[0].url} alt='' className='h-full w-full object-cover' />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center'>
                        <ImageOff className='h-8 w-8 text-muted-foreground' />
                      </div>
                    )}
                    <Badge variant='outline' className='absolute left-2 top-2 bg-background/90 capitalize'>
                      {p.source_platform}
                    </Badge>
                  </div>
                  <CardContent className='space-y-2 p-3'>
                    <p className='line-clamp-2 min-h-10 text-sm font-medium'>{p.review_title || p.rewritten_title || p.captured_title}</p>
                    <div className='flex items-center justify-between'>
                      <Badge variant={STATUS_VARIANT[p.status]} className='text-[11px]'>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                      {margin && <span className='text-xs font-medium text-green-600'>{margin}% margin</span>}
                    </div>
                    <div className='flex items-baseline justify-between text-xs text-muted-foreground'>
                      <span>{p.captured_cost_price_eur ? `Cost €${Number(p.captured_cost_price_eur).toFixed(2)}` : 'Cost —'}</span>
                      <span className='font-semibold text-foreground'>
                        {p.final_sale_price
                          ? `€${Number(p.final_sale_price).toFixed(2)}`
                          : p.suggested_sale_price
                            ? `€${Number(p.suggested_sale_price).toFixed(2)}*`
                            : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
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
