import { formatPrice } from '../../utils'
import { getDisplayPricing } from '../../utils/pricing'
import { Badge } from '../ui/Badge'

interface PriceBlockProps {
  basePrice: number | string
  salePrice: number | string | null
}

export function PriceBlock({ basePrice, salePrice }: PriceBlockProps) {
  const pricing = getDisplayPricing(basePrice, salePrice)

  return (
    <div className='rounded-xl bg-orange-50 p-4'>
      <div className='flex flex-wrap items-baseline gap-3'>
        <span className='text-3xl font-bold text-orange-600'>{formatPrice(pricing.sellingPrice)}</span>
        {pricing.compareAtPrice !== null && (
          <>
            <span className='text-lg text-gray-400 line-through'>{formatPrice(pricing.compareAtPrice)}</span>
            <Badge variant='sale'>SAVE {formatPrice(pricing.discountAmount!)}</Badge>
          </>
        )}
      </div>
      {pricing.discountPercent !== null && pricing.discountPercent > 0 && (
        <p className='mt-2 text-sm text-orange-600'>🔥 Limited time offer — {pricing.discountPercent}% off!</p>
      )}
    </div>
  )
}
