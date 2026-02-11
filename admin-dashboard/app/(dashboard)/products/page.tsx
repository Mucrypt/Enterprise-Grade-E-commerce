'use client'

import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { Button } from '@/components/ui/button'
import { Plus, Package } from 'lucide-react'
import Link from 'next/link'
import { ProductTable } from '@/components/products/ProductTable'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function ProductsPage() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productService.getProducts()
      return response?.data?.items || []
    },
  })

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-12 w-64' />
        <Skeleton className='h-96 w-full' />
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <h1 className='text-3xl font-bold'>Products</h1>
          <Link href='/products/new'>
            <Button>
              <Plus className='w-4 h-4 mr-2' />
              Add Product
            </Button>
          </Link>
        </div>

        <Card className='border-dashed'>
          <CardHeader className='text-center py-12'>
            <div className='mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
              <Package className='w-8 h-8 text-gray-400' />
            </div>
            <CardTitle>No products yet</CardTitle>
            <CardDescription className='max-w-md mx-auto mt-2'>
              Get started by creating your first product. You can add images,
              set prices, manage inventory, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className='text-center pb-12'>
            <Link href='/products/new'>
              <Button size='lg'>
                <Plus className='w-4 h-4 mr-2' />
                Create Your First Product
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-gray-100'>
            Products
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-2'>
            Manage your product catalog, inventory, and pricing
          </p>
        </div>
        <Link href='/products/new'>
          <Button>
            <Plus className='w-4 h-4 mr-2' />
            Add Product
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className='p-0'>
          <ProductTable products={products} />
        </CardContent>
      </Card>
    </div>
  )
}
