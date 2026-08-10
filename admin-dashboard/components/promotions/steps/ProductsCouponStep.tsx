'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import promotionService, { CampaignDetail } from '@/services/promotion.service'
import { ProductPicker } from '../ProductPicker'
import { CouponPicker } from '../CouponPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface StepProps {
  campaign: CampaignDetail
  isEditable: boolean
  onSaved: () => void
}

export function ProductsCouponStep({ campaign, isEditable, onSaved }: StepProps) {
  const [productIds, setProductIds] = useState<string[]>(campaign.products.map((p) => p.productId).filter(Boolean) as string[])
  const [couponId, setCouponId] = useState<string | null>(campaign.couponId)

  const mutation = useMutation({
    mutationFn: () =>
      promotionService.updateCampaign(campaign.id, {
        couponId,
        products: productIds.map((productId) => ({ productId })),
      }),
    onSuccess: () => {
      toast.success('Products and offer saved.')
      onSaved()
    },
    onError: () => toast.error('Failed to save -- please try again.'),
  })

  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductPicker selectedProductIds={productIds} onChange={setProductIds} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Offer (optional)</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-sm text-muted-foreground'>
            Attach an existing coupon, or create one first from Marketing &gt; Coupons and come back here.
          </p>
          <CouponPicker selectedCouponId={couponId} onChange={setCouponId} />
        </CardContent>
      </Card>
      {isEditable && (
        <div className='lg:col-span-2'>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  )
}
