'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { EnhancedProductForm } from '@/components/products/EnhancedProductForm'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function EditProductPage() {
  const params = useParams()
  const productId = params.id as string

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

  return (
    <TooltipProvider>
      <EnhancedProductForm product={productData} mode='edit' />
    </TooltipProvider>
  )
}
