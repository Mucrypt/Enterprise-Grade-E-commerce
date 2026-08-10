'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Coupon {
  id: string
  code: string
  name: string
  coupon_type: string
  discount_value: number
  is_active: boolean
  usage_count: number
  usage_limit: number | null
}

interface CouponPickerProps {
  selectedCouponId: string | null
  onChange: (couponId: string | null) => void
}

/**
 * Reuses the existing coupon system (GET /coupons) exactly as the coupons
 * page itself does -- no second discount engine, per PROMOTION-OPS-1's
 * explicit instruction. Only active coupons are offered.
 */
export function CouponPicker({ selectedCouponId, onChange }: CouponPickerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'coupon-picker'],
    queryFn: () => apiClient.get<{ coupons: Coupon[] }>('/coupons?status=active&limit=100'),
  })

  const coupons = data?.coupons || []

  return (
    <Select
      value={selectedCouponId || 'none'}
      onValueChange={(value: string) => onChange(value === 'none' ? null : value)}
      disabled={isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder='No coupon attached' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='none'>No coupon</SelectItem>
        {coupons.map((coupon) => (
          <SelectItem key={coupon.id} value={coupon.id}>
            {coupon.code} -- {coupon.coupon_type === 'percentage' ? `${coupon.discount_value}% off` : `€${coupon.discount_value} off`}
            {coupon.usage_limit ? ` (${coupon.usage_count}/${coupon.usage_limit} used)` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
