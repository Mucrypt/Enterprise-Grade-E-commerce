'use client'

import { useParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import supplierService from '@/services/supplier.service'
import sourcingService from '@/services/sourcing.service'
import { EnhancedProductForm } from '@/components/products/EnhancedProductForm'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Package, ExternalLink, PackageSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

export default function EditProductPage() {
  const params = useParams()
  const productId = params.id as string
  const [adCostPerOrder, setAdCostPerOrder] = useState('')
  const [paymentFee, setPaymentFee] = useState('')
  const [expectedRefundCost, setExpectedRefundCost] = useState('')
  const [marginFloorPercent, setMarginFloorPercent] = useState('10')

  const {
    data: productData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await productService.getProduct(productId)
      return response?.data?.product
    },
    enabled: !!productId,
  })

  const { data: economicsResponse, refetch: refetchEconomics } = useQuery({
    queryKey: ['product-economics', productId],
    queryFn: () => supplierService.getProductEconomics(productId),
    enabled: Boolean(productId),
    retry: false,
  })

  // SOURCING-1 -- if this product came from the Alibaba/Amazon importer,
  // surface where it came from and a way to manually recheck the source
  // listing. Deliberately not automatic: the backend never re-fetches
  // Alibaba/Amazon on its own, so "recheck" just reopens the original URL
  // for the founder to glance at and re-import if something changed.
  const { data: sourcingOriginResponse } = useQuery({
    queryKey: ['product-sourcing-origin', productId],
    queryFn: () => sourcingService.getSourcedOriginForProduct(productId),
    enabled: Boolean(productId),
    retry: false,
  })
  const sourcedOrigin = sourcingOriginResponse?.sourced

  const recomputeMutation = useMutation({
    mutationFn: () =>
      supplierService.recomputeProductEconomics(productId, {
        adCostPerOrder: adCostPerOrder ? Number(adCostPerOrder) : undefined,
        paymentFee: paymentFee ? Number(paymentFee) : undefined,
        expectedRefundCost: expectedRefundCost
          ? Number(expectedRefundCost)
          : undefined,
      }),
    onSuccess: () => {
      toast.success('Product economics recomputed')
      refetchEconomics()
    },
    onError: () => {
      toast.error('Failed to recompute product economics')
    },
  })

  const autoPauseMutation = useMutation({
    mutationFn: () =>
      supplierService.evaluateProductAutoPause(productId, {
        marginFloorPercent: Number(marginFloorPercent || '10'),
      }),
    onSuccess: (response) => {
      const paused = response?.data?.shouldPause
      toast.success(paused ? 'Product auto-paused' : 'Product remains active')
      refetchEconomics()
    },
    onError: () => {
      toast.error('Failed to evaluate auto-pause')
    },
  })

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-4'>
          <Skeleton className='h-10 w-10' />
          <div>
            <Skeleton className='h-8 w-64' />
            <Skeleton className='h-4 w-48 mt-2' />
          </div>
        </div>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <div className='lg:col-span-2 space-y-6'>
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-96' />
          </div>
          <div className='space-y-6'>
            <Skeleton className='h-40' />
            <Skeleton className='h-32' />
          </div>
        </div>
      </div>
    )
  }

  if (error || !productData) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <Package className='h-16 w-16 text-muted-foreground mb-4' />
        <h2 className='text-xl font-semibold mb-2'>Product Not Found</h2>
        <p className='text-muted-foreground mb-4'>
          The product you&apos;re trying to edit doesn&apos;t exist or has been
          deleted.
        </p>
        <Link href='/products'>
          <Button>Back to Products</Button>
        </Link>
      </div>
    )
  }

  const economics = economicsResponse?.data?.economics
  const flags = economicsResponse?.data?.flags

  return (
    <TooltipProvider>
      <div className='space-y-6'>
        {sourcedOrigin && (
          <Card className='border-orange-300 bg-orange-50/50 dark:bg-orange-950/20'>
            <CardContent className='flex flex-wrap items-center justify-between gap-3 py-4'>
              <div className='flex items-center gap-2 text-sm'>
                <PackageSearch className='h-4 w-4 shrink-0 text-orange-600' />
                <span>
                  Sourced from <Badge variant='outline' className='mx-1 capitalize'>{sourcedOrigin.sourcePlatform}</Badge>
                  {sourcedOrigin.capturedSupplierName ? ` -- ${sourcedOrigin.capturedSupplierName}` : ''}
                </span>
              </div>
              <div className='flex gap-2'>
                <a href={sourcedOrigin.sourceUrl} target='_blank' rel='noreferrer'>
                  <Button variant='outline' size='sm' className='gap-1.5'>
                    <ExternalLink className='h-3.5 w-3.5' /> Recheck price on {sourcedOrigin.sourcePlatform}
                  </Button>
                </a>
                <Link href={`/dashboard/sourcing/${sourcedOrigin.id}`}>
                  <Button variant='ghost' size='sm'>
                    View import record
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Product Economics</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-3 md:grid-cols-4'>
              <div className='space-y-1'>
                <Label>Ad Cost / Order</Label>
                <Input
                  type='number'
                  value={adCostPerOrder}
                  onChange={(event) => setAdCostPerOrder(event.target.value)}
                  placeholder='0.00'
                />
              </div>
              <div className='space-y-1'>
                <Label>Payment Fee</Label>
                <Input
                  type='number'
                  value={paymentFee}
                  onChange={(event) => setPaymentFee(event.target.value)}
                  placeholder='0.00'
                />
              </div>
              <div className='space-y-1'>
                <Label>Expected Refund Cost</Label>
                <Input
                  type='number'
                  value={expectedRefundCost}
                  onChange={(event) => setExpectedRefundCost(event.target.value)}
                  placeholder='0.00'
                />
              </div>
              <div className='space-y-1'>
                <Label>Auto-Pause Margin Floor %</Label>
                <Input
                  type='number'
                  value={marginFloorPercent}
                  onChange={(event) => setMarginFloorPercent(event.target.value)}
                  placeholder='10'
                />
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => recomputeMutation.mutate()}
                disabled={recomputeMutation.isPending}
              >
                {recomputeMutation.isPending ? 'Recomputing...' : 'Recompute Economics'}
              </Button>
              <Button
                type='button'
                onClick={() => autoPauseMutation.mutate()}
                disabled={autoPauseMutation.isPending}
              >
                {autoPauseMutation.isPending
                  ? 'Evaluating...'
                  : 'Evaluate Auto-Pause'}
              </Button>
            </div>

            <div className='grid gap-3 md:grid-cols-4 text-sm'>
              <div className='rounded border p-3'>
                <p className='text-muted-foreground'>Sell Price</p>
                <p className='font-semibold'>
                  ${Number(economics?.sell_price || 0).toFixed(2)}
                </p>
              </div>
              <div className='rounded border p-3'>
                <p className='text-muted-foreground'>Landed Cost</p>
                <p className='font-semibold'>
                  ${Number(economics?.landed_cost || 0).toFixed(2)}
                </p>
              </div>
              <div className='rounded border p-3'>
                <p className='text-muted-foreground'>Contribution Margin</p>
                <p className='font-semibold'>
                  ${Number(economics?.contribution_margin || 0).toFixed(2)}
                </p>
              </div>
              <div className='rounded border p-3'>
                <p className='text-muted-foreground'>Margin %</p>
                <p className='font-semibold'>
                  {Number(economics?.margin_percent || 0).toFixed(2)}%
                </p>
              </div>
            </div>

            <div className='rounded border p-3 text-sm'>
              <p>
                Auto-pause: <span className='font-semibold'>{flags?.auto_pause ? 'Yes' : 'No'}</span>
              </p>
              {flags?.pause_reason && (
                <p className='text-muted-foreground mt-1'>{flags.pause_reason}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <EnhancedProductForm product={productData} mode='edit' />
      </div>
    </TooltipProvider>
  )
}
